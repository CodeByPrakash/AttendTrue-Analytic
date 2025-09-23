import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import dbConnect from '../../../lib/couchdb';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const nano = await dbConnect();
      const db = nano.db.use('smartattend');
      const { q = '' } = req.query;
      const query = (q || '').toString().trim().toLowerCase();

      // Institute scoping for admin
      let instituteFilter = {};
      if (session.user.role !== 'superadmin') {
        const adminDoc = await db.get(session.user.id).catch(() => null);
        if (!adminDoc) return res.status(401).json({ message: 'Unauthorized' });
        instituteFilter.instituteId = adminDoc.instituteId || '';
      }
      // Pending approvals
      const pendingRes = await db.find({ selector: { type: 'user', role: 'student', faceScanStatus: 'pending', ...instituteFilter }, limit: 10000 });
      let pending = (pendingRes.docs || []).map(doc => ({
        _id: doc._id,
        name: doc.name || doc.fullName || doc.firstName || doc.email,
        email: doc.email,
        profileImageUrl: doc.profile?.imageUrl || null
      }));
      if (query) {
        pending = pending.filter(s => [s.name, s.email].filter(Boolean).some(v => v.toLowerCase().includes(query)));
      }

      // Recent approvals/rejections
      const recentRes = await db.find({ selector: { type: 'user', role: 'student', faceScanStatus: { '$in': ['approved','rejected'] }, ...instituteFilter }, limit: 10000 });
      let recentRaw = recentRes.docs || [];
      let recent = recentRaw.map(doc => ({
        _id: doc._id,
        name: doc.name || doc.fullName || doc.firstName || doc.email,
        email: doc.email,
        profileImageUrl: doc.profile?.imageUrl || null,
        status: doc.faceScanStatus || 'approved',
        reviewedAt: doc.faceScanReviewedAt || doc.updatedAt || doc._rev
      }));
      if (query) {
        recent = recent.filter(s => [s.name, s.email].filter(Boolean).some(v => v.toLowerCase().includes(query)));
      }
      // Sort by reviewedAt desc when possible
      recent.sort((a, b) => new Date(b.reviewedAt || 0) - new Date(a.reviewedAt || 0));
      recent = recent.slice(0, 25);

      res.status(200).json({ pending, recent });
    } catch (error) {
      console.error('Approvals GET error', error);
      res.status(500).json({ message: 'Error fetching approvals.' });
    }
  }

  if (req.method === 'POST') {
    const { studentId, action, descriptor } = req.body; // action: 'approve' or 'reject'
    if (!studentId || !action) {
      return res.status(400).json({ message: 'Missing studentId or action.' });
    }

    try {
      const nano = await dbConnect();
      const db = nano.db.use('smartattend');
      const studentDoc = await db.get(studentId);
      // Institute scoping for admin
      if (session.user.role !== 'superadmin') {
        const adminDoc = await db.get(session.user.id).catch(() => null);
        if (!adminDoc || (adminDoc.instituteId || '') !== (studentDoc.instituteId || '')) {
          return res.status(403).json({ message: 'Forbidden' });
        }
      }

      const nowIso = new Date().toISOString();
      if (action === 'approve') {
        const pending = studentDoc.biometrics?.pendingFaceDescriptor;
        const finalDescriptor = Array.isArray(descriptor) && descriptor.length ? descriptor : pending;
        if (!finalDescriptor) {
          return res.status(400).json({ message: 'No pending scan to approve.' });
        }
        studentDoc.biometrics = studentDoc.biometrics || {};
        studentDoc.biometrics.faceDescriptor = finalDescriptor;
        if (studentDoc.biometrics.pendingFaceDescriptor) delete studentDoc.biometrics.pendingFaceDescriptor;
        studentDoc.faceScanStatus = 'approved';
        studentDoc.faceScanReviewedAt = nowIso;
      } else if (action === 'reject') {
        studentDoc.faceScanStatus = 'rejected';
        if (studentDoc.biometrics) delete studentDoc.biometrics.pendingFaceDescriptor;
        studentDoc.faceScanReviewedAt = nowIso;
      } else {
        return res.status(400).json({ message: 'Invalid action.' });
      }

      await db.insert(studentDoc);
      res.status(200).json({ message: `Scan for ${studentDoc.name} has been ${action}d.` });

    } catch (error) {
      res.status(500).json({ message: 'Error processing request.' });
    }
  }
}
