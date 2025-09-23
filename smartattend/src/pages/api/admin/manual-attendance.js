import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import dbConnect from '../../../lib/couchdb';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { sessionId, studentId, status, reason } = req.body || {};
  if (!sessionId || !studentId || !status) {
    return res.status(400).json({ message: 'sessionId, studentId and status are required' });
  }
  if (!['present', 'left_early'].includes(status)) {
    return res.status(400).json({ message: 'Unsupported status. Use present or left_early.' });
  }

  try {
    const nano = await dbConnect();
    const db = nano.db.use('smartattend');

    const [studentDoc, sessionDoc] = await Promise.all([
      db.get(studentId).catch(() => null),
      db.get(sessionId).catch(() => null),
    ]);
    if (!studentDoc || studentDoc.type !== 'user' || studentDoc.role !== 'student') {
      return res.status(404).json({ message: 'Student not found' });
    }
    if (!sessionDoc || sessionDoc.type !== 'session') {
      return res.status(404).json({ message: 'Session not found' });
    }
    const courseDoc = await db.get(sessionDoc.courseId).catch(() => null);
    if (!courseDoc || courseDoc.type !== 'course') {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Institute scoping: ensure admin and student/course align unless superadmin
    if (session.user.role !== 'superadmin') {
      const adminDoc = await db.get(session.user.id).catch(() => null);
      const instituteId = adminDoc?.instituteId || '';
      if ((studentDoc.instituteId || '') !== instituteId || (courseDoc.instituteId || '') !== instituteId) {
        return res.status(403).json({ message: 'Forbidden' });
      }
    }

    const attendanceId = `attendance:${studentId}:${sessionId}`;
    let attendanceDoc = null;
    try { attendanceDoc = await db.get(attendanceId); } catch (e) { if (e.statusCode !== 404) throw e; }

    const now = new Date().toISOString();
    if (!attendanceDoc) {
      const doc = {
        _id: attendanceId,
        type: 'attendance',
        studentId,
        sessionId,
        timestamp: now,
        method: 'manual',
        status,
        leftEarlyAt: status === 'left_early' ? now : null,
        manualUpdates: [{ by: session.user.id, role: 'admin', at: now, status, reason: reason || '' }]
      };
      await db.insert(doc);
    } else {
      const updated = { ...attendanceDoc };
      const prevStatus = updated.status || 'present';
      updated.status = status;
      if (status === 'left_early') updated.leftEarlyAt = now; else delete updated.leftEarlyAt;
      updated.manualUpdates = Array.isArray(updated.manualUpdates) ? updated.manualUpdates : [];
      updated.manualUpdates.push({ by: session.user.id, role: 'admin', at: now, status, reason: reason || '' });
      await db.insert(updated);
      try {
        const sDoc = await db.get(sessionId);
        if (!sDoc.attendanceStats) sDoc.attendanceStats = { totalStudents: 0, presentStudents: 0, validationAttempts: 0, securityViolations: 0, lastUpdate: now };
        if (prevStatus !== 'present' && status === 'present') sDoc.attendanceStats.presentStudents += 1;
        if (prevStatus === 'present' && status !== 'present') sDoc.attendanceStats.presentStudents = Math.max(0, (sDoc.attendanceStats.presentStudents || 0) - 1);
        sDoc.attendanceStats.lastUpdate = now;
        await db.insert(sDoc);
      } catch {}
    }

    return res.status(200).json({ message: 'Attendance updated' });
  } catch (error) {
    console.error('Admin manual attendance error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
