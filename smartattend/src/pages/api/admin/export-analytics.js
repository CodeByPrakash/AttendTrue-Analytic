// src/pages/api/admin/export-analytics.js

import { getAuthenticatedUser } from '../../../lib/auth-helper';
import dbConnect from '../../../lib/couchdb';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const user = await getAuthenticatedUser({ req, res });
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { format, reportType, dateRange, filters } = req.body;

  if (!format || !reportType) {
    return res.status(400).json({ message: 'Format and report type are required' });
  }

  try {
    const nano = await dbConnect();
    const db = nano.db.use('smartattend');

    let reportData;
    
    switch (reportType) {
      case 'attendance_summary':
        reportData = await generateAttendanceSummary(db, dateRange, filters);
        break;
      case 'student_performance':
        reportData = await generateStudentPerformanceReport(db, dateRange, filters);
        break;
      case 'course_analytics':
        reportData = await generateCourseAnalyticsReport(db, dateRange, filters);
        break;
      case 'at_risk_students':
        reportData = await generateAtRiskStudentsReport(db, dateRange, filters);
        break;
      case 'security_audit':
        reportData = await generateSecurityAuditReport(db, dateRange, filters);
        break;
      default:
        return res.status(400).json({ message: 'Invalid report type' });
    }

    if (format === 'csv') {
      const csv = generateCSV(reportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${reportType}_${new Date().toISOString().split('T')[0]}.csv"`);
      return res.status(200).send(csv);
    } else if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${reportType}_${new Date().toISOString().split('T')[0]}.json"`);
      return res.status(200).json(reportData);
    } else {
      return res.status(400).json({ message: 'Unsupported format' });
    }

  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}

async function generateAttendanceSummary(db, dateRange, filters) {
  const query = {
    type: 'attendance',
    ...(dateRange && {
      timestamp: {
        $gte: dateRange.start,
        $lte: dateRange.end
      }
    })
  };

  const attendanceResult = await db.find({ selector: query });
  const attendance = attendanceResult.docs;

  // Get sessions and students for context
  const sessionIds = [...new Set(attendance.map(a => a.sessionId))];
  const studentIds = [...new Set(attendance.map(a => a.studentId))];

  const sessionsResult = await db.find({
    selector: { type: 'session', _id: { $in: sessionIds } }
  });
  
  const studentsResult = await db.find({
    selector: { type: 'user', role: 'student', _id: { $in: studentIds } }
  });

  const sessions = sessionsResult.docs;
  const students = studentsResult.docs;

  return {
    summary: {
      totalAttendanceRecords: attendance.length,
      totalStudents: students.length,
      totalSessions: sessions.length,
      attendanceRate: attendance.length / (students.length * sessions.length) * 100
    },
    attendanceByMethod: getAttendanceByMethod(attendance),
    attendanceByDate: getAttendanceByDate(attendance, sessions),
    topPerformers: getTopPerformers(attendance, students),
    reportGenerated: new Date().toISOString(),
    dateRange,
    filters
  };
}

async function generateStudentPerformanceReport(db, dateRange, filters) {
  const studentsResult = await db.find({ 
    selector: { 
      type: 'user', 
      role: 'student',
      ...(filters?.department && { department: filters.department }),
      ...(filters?.course && { course: filters.course })
    } 
  });

  const students = studentsResult.docs;
  const studentIds = students.map(s => s._id);

  const attendanceResult = await db.find({
    selector: {
      type: 'attendance',
      studentId: { $in: studentIds },
      ...(dateRange && {
        timestamp: {
          $gte: dateRange.start,
          $lte: dateRange.end
        }
      })
    }
  });

  const attendance = attendanceResult.docs;

  return students.map(student => {
    const studentAttendance = attendance.filter(a => a.studentId === student._id);
    const attendanceRate = (studentAttendance.length / Math.max(1, attendance.length)) * 100;
    
    return {
      studentId: student._id,
      name: student.name || `${student.firstName} ${student.lastName}`,
      email: student.email,
      department: student.department || 'N/A',
      totalAttendance: studentAttendance.length,
      attendanceRate: parseFloat(attendanceRate.toFixed(2)),
      preferredMethod: getMostUsedMethod(studentAttendance),
      lastAttendance: getLastAttendance(studentAttendance),
      riskLevel: getRiskLevel(attendanceRate),
      gamificationStats: student.gamificationStats || null
    };
  });
}

async function generateCourseAnalyticsReport(db, dateRange, filters) {
  const coursesResult = await db.find({ 
    selector: { 
      type: 'course',
      ...(filters?.teacherId && { teacherId: filters.teacherId })
    } 
  });

  const courses = coursesResult.docs;
  const courseIds = courses.map(c => c._id);

  const sessionsResult = await db.find({
    selector: {
      type: 'session',
      courseId: { $in: courseIds },
      ...(dateRange && {
        startTime: {
          $gte: dateRange.start,
          $lte: dateRange.end
        }
      })
    }
  });

  const sessions = sessionsResult.docs;
  const sessionIds = sessions.map(s => s._id);

  const attendanceResult = await db.find({
    selector: {
      type: 'attendance',
      sessionId: { $in: sessionIds }
    }
  });

  const attendance = attendanceResult.docs;

  return courses.map(course => {
    const courseSessions = sessions.filter(s => s.courseId === course._id);
    const courseAttendance = attendance.filter(a => 
      courseSessions.some(s => s._id === a.sessionId)
    );

    return {
      courseId: course._id,
      courseName: course.name,
      teacherId: course.teacherId,
      totalSessions: courseSessions.length,
      totalAttendance: courseAttendance.length,
      averageAttendancePerSession: courseSessions.length > 0 
        ? parseFloat((courseAttendance.length / courseSessions.length).toFixed(2))
        : 0,
      enrolledStudents: course.students?.length || 0,
      attendanceRate: course.students?.length && courseSessions.length
        ? parseFloat(((courseAttendance.length / (course.students.length * courseSessions.length)) * 100).toFixed(2))
        : 0
    };
  });
}

async function generateAtRiskStudentsReport(db, dateRange, filters) {
  const threshold = filters?.threshold || 75; // Default 75% threshold
  const performanceReport = await generateStudentPerformanceReport(db, dateRange, filters);
  
  const atRiskStudents = performanceReport.filter(student => 
    student.attendanceRate < threshold
  );

  // Add additional risk factors
  const enhancedRiskData = atRiskStudents.map(student => ({
    ...student,
    riskFactors: {
      lowAttendance: student.attendanceRate < threshold,
      noRecentAttendance: !student.lastAttendance || 
        (new Date() - new Date(student.lastAttendance)) > (7 * 24 * 60 * 60 * 1000),
      inconsistentMethod: getMethodConsistency(student),
      lowEngagement: student.gamificationStats?.totalPoints < 50
    },
    recommendedActions: generateRecommendedActions(student),
    urgencyLevel: getUrgencyLevel(student.attendanceRate)
  }));

  return {
    summary: {
      totalAtRiskStudents: enhancedRiskData.length,
      criticallyAtRisk: enhancedRiskData.filter(s => s.urgencyLevel === 'critical').length,
      moderatelyAtRisk: enhancedRiskData.filter(s => s.urgencyLevel === 'moderate').length,
      threshold: threshold
    },
    students: enhancedRiskData,
    reportGenerated: new Date().toISOString()
  };
}

async function generateSecurityAuditReport(db, dateRange, filters) {
  const attendanceResult = await db.find({
    selector: {
      type: 'attendance',
      ...(dateRange && {
        timestamp: {
          $gte: dateRange.start,
          $lte: dateRange.end
        }
      })
    }
  });

  const attendance = attendanceResult.docs;

  const securityMetrics = {
    totalValidations: attendance.length,
    methodBreakdown: getAttendanceByMethod(attendance),
    multiFactor: attendance.filter(a => a.method === 'multi-factor').length,
    proximityValidations: attendance.filter(a => 
      a.validationData?.networkValidation?.overall
    ).length,
    biometricValidations: attendance.filter(a => 
      a.validationData?.biometricUsed
    ).length,
    suspiciousActivity: attendance.filter(a => 
      a.validationData?.spoofingCheck?.isSuspicious
    ).length,
    failedValidations: attendance.filter(a => 
      a.validationData?.networkValidation && 
      !a.validationData.networkValidation.overall
    ).length
  };

  const securityScore = calculateSecurityScore(securityMetrics);

  return {
    summary: securityMetrics,
    securityScore: securityScore,
    recommendations: generateSecurityRecommendations(securityMetrics),
    reportGenerated: new Date().toISOString(),
    dateRange
  };
}

// Utility functions
function getAttendanceByMethod(attendance) {
  const methods = {};
  attendance.forEach(record => {
    methods[record.method] = (methods[record.method] || 0) + 1;
  });
  return methods;
}

function getAttendanceByDate(attendance, sessions) {
  const dailyData = {};
  
  sessions.forEach(session => {
    const date = new Date(session.startTime).toISOString().split('T')[0];
    const sessionAttendance = attendance.filter(a => a.sessionId === session._id);
    
    dailyData[date] = {
      totalSessions: (dailyData[date]?.totalSessions || 0) + 1,
      totalAttendance: (dailyData[date]?.totalAttendance || 0) + sessionAttendance.length
    };
  });

  return dailyData;
}

function getTopPerformers(attendance, students) {
  const studentAttendance = {};
  
  attendance.forEach(record => {
    studentAttendance[record.studentId] = (studentAttendance[record.studentId] || 0) + 1;
  });

  return Object.entries(studentAttendance)
    .map(([studentId, count]) => ({
      studentId,
      name: students.find(s => s._id === studentId)?.name || 'Unknown',
      attendanceCount: count
    }))
    .sort((a, b) => b.attendanceCount - a.attendanceCount)
    .slice(0, 10);
}

function getMostUsedMethod(studentAttendance) {
  const methods = getAttendanceByMethod(studentAttendance);
  return Object.entries(methods).reduce((a, b) => methods[a] > methods[b] ? a : b, 'none');
}

function getLastAttendance(studentAttendance) {
  if (studentAttendance.length === 0) return null;
  return studentAttendance.sort((a, b) => 
    new Date(b.timestamp) - new Date(a.timestamp)
  )[0].timestamp;
}

function getRiskLevel(attendanceRate) {
  if (attendanceRate < 60) return 'high';
  if (attendanceRate < 75) return 'medium';
  return 'low';
}

function getUrgencyLevel(attendanceRate) {
  if (attendanceRate < 50) return 'critical';
  if (attendanceRate < 70) return 'moderate';
  return 'low';
}

function getMethodConsistency(student) {
  // Placeholder - would need actual method usage data
  return 'consistent';
}

function generateRecommendedActions(student) {
  const actions = [];
  
  if (student.attendanceRate < 50) {
    actions.push('Immediate academic counseling required');
    actions.push('Contact student and parents/guardians');
  }
  
  if (student.attendanceRate < 75) {
    actions.push('Schedule meeting with academic advisor');
    actions.push('Implement attendance improvement plan');
  }
  
  if (!student.lastAttendance) {
    actions.push('Follow up on current enrollment status');
  }

  return actions;
}

function calculateSecurityScore(metrics) {
  let score = 100;
  
  // Deduct points for security issues
  score -= (metrics.suspiciousActivity / metrics.totalValidations) * 30;
  score -= (metrics.failedValidations / metrics.totalValidations) * 20;
  
  // Add points for good security practices
  score += (metrics.multiFactor / metrics.totalValidations) * 10;
  score += (metrics.biometricValidations / metrics.totalValidations) * 5;
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

function generateSecurityRecommendations(metrics) {
  const recommendations = [];
  
  if (metrics.suspiciousActivity > 0) {
    recommendations.push('Investigate suspicious validation attempts');
  }
  
  if (metrics.multiFactor / metrics.totalValidations < 0.5) {
    recommendations.push('Encourage more multi-factor authentication usage');
  }
  
  if (metrics.failedValidations / metrics.totalValidations > 0.1) {
    recommendations.push('Review and improve proximity validation systems');
  }

  return recommendations;
}

function generateCSV(data) {
  if (!data || typeof data !== 'object') return '';
  
  // Handle different report types
  if (data.students) {
    // Student performance report
    const headers = ['Student ID', 'Name', 'Email', 'Department', 'Attendance Rate', 'Risk Level'];
    const rows = data.students.map(student => [
      student.studentId,
      student.name,
      student.email,
      student.department,
      student.attendanceRate,
      student.riskLevel
    ]);
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
  
  if (data.summary) {
    // Convert object to CSV format
    const entries = Object.entries(data.summary);
    return entries.map(([key, value]) => `${key},${value}`).join('\n');
  }
  
  // Fallback for other data types
  return JSON.stringify(data, null, 2);
}
