import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import dbConnect from '../../../lib/couchdb';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method Not Allowed' });
  const { sessionId } = req.query;
  if (!sessionId) return res.status(400).json({ message: 'sessionId required' });

  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const nano = await dbConnect();
    const db = nano.db.use('smartattend');
    const sDoc = await db.get(sessionId);
    if (!sDoc || sDoc.type !== 'session') return res.status(404).json({ message: 'Session not found' });
    const courseDoc = await db.get(sDoc.courseId).catch(() => null);
    if (!courseDoc) return res.status(404).json({ message: 'Course not found' });
    if (session.user.role !== 'superadmin') {
      const adminDoc = await db.get(session.user.id).catch(() => null);
      const instituteId = adminDoc?.instituteId || '';
      if ((courseDoc.instituteId || '') !== instituteId) return res.status(403).json({ message: 'Forbidden' });
    }
    const result = await db.find({ selector: { type: 'attendance', sessionId } });
    const map = {};
    for (const doc of result.docs) {
      map[doc.studentId] = { status: doc.status || 'present', method: doc.method, timestamp: doc.timestamp, leftEarlyAt: doc.leftEarlyAt || null };
    }
    return res.status(200).json({ attendance: map });
  } catch (error) {
    console.error('Admin session attendance error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
