import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]';
import dbConnect from '../../../../../lib/couchdb';
import { calculateAttendanceScore, calculateStreak, generateLeaderboardAndRank } from '../../../../../utils/gamification';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { id } = req.query; // student user id
  try {
    const nano = await dbConnect();
    const db = nano.db.use('smartattend');

    const student = await db.get(id).catch(() => null);
    if (!student || student.type !== 'user' || student.role !== 'student') {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Institute scoping: non-superadmin must match institute
    if (session.user.role !== 'superadmin') {
      const adminDoc = await db.get(session.user.id).catch(() => null);
      if (!adminDoc || (adminDoc.instituteId || '') !== (student.instituteId || '')) {
        return res.status(403).json({ message: 'Forbidden' });
      }
    }

    const [studentAttendanceResult, allAttendanceResult, allSessionsResult, allCoursesResult, allStudentsResult] = await Promise.all([
      db.find({ selector: { type: 'attendance', studentId: student._id } }),
      db.find({ selector: { type: 'attendance' } }),
      db.find({ selector: { type: 'session' } }),
      db.find({ selector: { type: 'course' } }),
      db.find({ selector: { type: 'user', role: 'student' }, fields: ['_id', 'name'] }),
    ]);

    const studentAttendance = studentAttendanceResult.docs;
    const allAttendance = allAttendanceResult.docs;
    const allSessions = allSessionsResult.docs;
    const allCourses = allCoursesResult.docs;
    const allStudents = allStudentsResult.docs;

    const studentCourseIds = new Set(student.courses || []);
    const sessionsForStudent = allSessions
      .filter((s) => studentCourseIds.has(s.courseId))
      .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

    const attendanceScore = calculateAttendanceScore(studentAttendance.length, sessionsForStudent.length);
    const streak = calculateStreak(studentAttendance, sessionsForStudent);
    const { leaderboard, rank } = generateLeaderboardAndRank(student._id, allAttendance);

    const studentIdToNameMap = allStudents.reduce((map, s) => { map[s._id] = s.name; return map; }, {});
    const enrichedLeaderboard = leaderboard.map((item) => ({ ...item, name: studentIdToNameMap[item.studentId] || 'Unknown' }));

    const statusBreakdown = studentAttendance.reduce((acc, record) => {
      const method = record.method || 'unknown';
      const existing = acc.find((i) => i._id === method);
      if (existing) existing.count++; else acc.push({ _id: method, count: 1 });
      return acc;
    }, []);

    const courseIdToNameMap = allCourses.reduce((map, c) => { map[c._id] = c.name; return map; }, {});
    const attendedSessionIds = new Set(studentAttendance.map((a) => a.sessionId));
    const historySessions = sessionsForStudent.slice(0, 20).reverse();
    const attendanceHistory = historySessions.map((session) => ({
      sessionName: `${courseIdToNameMap[session.courseId] || 'Course'} - ${new Date(session.startTime).toLocaleDateString()}`,
      attended: attendedSessionIds.has(session._id),
    }));

    res.status(200).json({ attendanceScore, rank, streak, leaderboard: enrichedLeaderboard, statusBreakdown, attendanceHistory });
  } catch (error) {
    console.error('Admin student analytics error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
