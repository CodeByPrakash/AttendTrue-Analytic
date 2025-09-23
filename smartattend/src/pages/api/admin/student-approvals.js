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
      const selector = { type: 'user', role: 'student', approvalStatus: 'pending' };
      if (session.user.role !== 'superadmin') {
        // Load approver's doc to read instituteId
        const approverDoc = await db.get(session.user.id).catch(() => null);
        if (approverDoc && approverDoc.instituteId) {
          selector.instituteId = approverDoc.instituteId;
        }
      }
      const result = await db.find({ selector });
      const docs = (result.docs || []).map((doc) => ({
        _id: doc._id,
        name: doc.name,
        email: doc.email,
  studentId: (doc.academic && (doc.academic.rollNo || doc.academic.studentId)) || doc.studentId || '',
  department: (doc.academic && (doc.academic.branch || doc.academic.department)) || doc.department || '',
        phone: (doc.profile && doc.profile.phone) || doc.phone || '',
        registeredAt: doc.registeredAt || null,
        profileImageUrl: (doc.profile && doc.profile.imageUrl) || doc.profileImageUrl || ''
      }));
      res.status(200).json(docs);
    } catch (error) {
      console.error('Error fetching pending students:', error);
      res.status(500).json({ message: 'Error fetching pending students.' });
    }
  }

  if (req.method === 'POST') {
    const { studentId, action } = req.body; // action: 'approve' or 'reject'
    if (!studentId || !action) {
      return res.status(400).json({ message: 'Missing studentId or action.' });
    }

    try {
      const nano = await dbConnect();
      const db = nano.db.use('smartattend');
      const studentDoc = await db.get(studentId);
      if (session.user.role !== 'superadmin') {
        const approverDoc = await db.get(session.user.id).catch(() => null);
        if (approverDoc && approverDoc.instituteId && (studentDoc.instituteId || '') !== approverDoc.instituteId) {
          return res.status(403).json({ message: 'Forbidden' });
        }
      }

      if (action === 'approve') {
        studentDoc.approvalStatus = 'approved';
        studentDoc.isApproved = true;
        studentDoc.approvedBy = session.user.id;
        studentDoc.approvedAt = new Date().toISOString();
      } else if (action === 'reject') {
        studentDoc.approvalStatus = 'rejected';
        studentDoc.isApproved = false;
        studentDoc.rejectedBy = session.user.id;
        studentDoc.rejectedAt = new Date().toISOString();
      } else {
        return res.status(400).json({ message: 'Invalid action.' });
      }

      await db.insert(studentDoc);
      res.status(200).json({ 
        message: `Student ${studentDoc.name} has been ${action}d.`,
        student: {
          id: studentDoc._id,
          name: studentDoc.name,
          email: studentDoc.email,
          approvalStatus: studentDoc.approvalStatus
        }
      });

    } catch (error) {
      console.error('Error processing approval request:', error);
      res.status(500).json({ message: 'Error processing request.' });
    }
  }
}
