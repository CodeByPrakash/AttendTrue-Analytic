import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import dbConnect from '../../../lib/couchdb';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });
  const { sessionId } = req.body || {};
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

    const roster = courseDoc.students || [];
    const existing = await db.find({ selector: { type: 'attendance', sessionId } });
    const attendedIds = new Set(existing.docs.map(d => d.studentId));
    const now = new Date().toISOString();
    const absentees = roster.filter(id => !attendedIds.has(id));
    for (const studentId of absentees) {
      const attendanceId = `attendance:${studentId}:${sessionId}`;
      const doc = { _id: attendanceId, type: 'attendance', studentId, sessionId, timestamp: now, method: 'finalize', status: 'absent' };
      try { await db.insert(doc); } catch (e) { /* ignore conflicts */ }
    }
    sDoc.status = 'ended';
    sDoc.endTime = now;
    await db.insert(sDoc);
    return res.status(200).json({ message: 'Session finalized', markedAbsent: absentees.length });
  } catch (error) {
    console.error('Admin finalize session error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
