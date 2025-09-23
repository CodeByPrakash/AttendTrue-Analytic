import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]';
import dbConnect from '../../../../../lib/couchdb';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { id } = req.query; // teacher user id
  try {
    const nano = await dbConnect();
    const db = nano.db.use('smartattend');

    const teacher = await db.get(id).catch(() => null);
    if (!teacher || teacher.type !== 'user' || teacher.role !== 'teacher') {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    // Institute scoping: non-superadmin must match institute
    if (session.user.role !== 'superadmin') {
      const adminDoc = await db.get(session.user.id).catch(() => null);
      if (!adminDoc || (adminDoc.instituteId || '') !== (teacher.instituteId || '')) {
        return res.status(403).json({ message: 'Forbidden' });
      }
    }

    const coursesResult = await db.find({ selector: { type: 'course', teacherId: teacher._id } });
    const teacherCourses = coursesResult.docs;
    if (!teacherCourses.length) {
      return res.status(200).json({ attendanceByCourse: [], atRiskStudents: [] });
    }
    const courseIds = teacherCourses.map((c) => c._id);

    const sessionsResult = await db.find({ selector: { type: 'session', courseId: { '$in': courseIds } } });
    const allSessionsForTeacher = sessionsResult.docs;
    const sessionIds = allSessionsForTeacher.map((s) => s._id);

    const attendanceResult = await db.find({ selector: { type: 'attendance', sessionId: { '$in': sessionIds } } });
    const allAttendanceForTeacher = attendanceResult.docs;

    const studentsResult = await db.find({ selector: { type: 'user', role: 'student' } });
    const allStudents = studentsResult.docs;
    const studentMap = allStudents.reduce((map, s) => { map[s._id] = s; return map; }, {});

    const courseData = {};
    for (const course of teacherCourses) {
      courseData[course._id] = { courseName: course.name, totalSessions: 0, totalPresent: 0, enrolledStudentIds: new Set(course.students || []) };
    }
    for (const sessionDoc of allSessionsForTeacher) courseData[sessionDoc.courseId].totalSessions++;
    for (const attendance of allAttendanceForTeacher) {
      const sessionDoc = allSessionsForTeacher.find((s) => s._id === attendance.sessionId);
      if (sessionDoc) courseData[sessionDoc.courseId].totalPresent++;
    }
    const attendanceByCourse = Object.values(courseData).map((c) => ({ ...c, presentCount: c.totalPresent }));

    const atRiskStudents = [];
    for (const course of teacherCourses) {
      const sessionsInCourse = allSessionsForTeacher.filter((s) => s.courseId === course._id);
      const totalSessionsInCourse = sessionsInCourse.length;
      if (totalSessionsInCourse === 0) continue;
      const enrolledStudentIds = course.students || [];
      for (const studentId of enrolledStudentIds) {
        const attendedCount = allAttendanceForTeacher.filter((att) => {
          const sessionDoc = allSessionsForTeacher.find((s) => s._id === att.sessionId);
          return sessionDoc && sessionDoc.courseId === course._id && att.studentId === studentId;
        }).length;
        const attendanceRate = (attendedCount / totalSessionsInCourse) * 100;
        if (attendanceRate < 75) {
          const student = studentMap[studentId];
          if (student) {
            atRiskStudents.push({ studentName: student.name, studentEmail: student.email, courseName: course.name, attendanceRate: attendanceRate.toFixed(1) });
          }
        }
      }
    }

    res.status(200).json({ attendanceByCourse, atRiskStudents });
  } catch (error) {
    console.error('Admin teacher analytics error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
