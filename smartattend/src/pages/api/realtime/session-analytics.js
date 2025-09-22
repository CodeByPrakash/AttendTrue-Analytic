// src/pages/api/realtime/session-analytics.js

/**
 * Real-time session analytics API
 * Provides live analytics data for teacher dashboards
 */

import { getAuthenticatedUser } from '../../../lib/auth-helper';
import dbConnect from '../../../lib/couchdb';
import { broadcastSessionUpdate } from '../../../utils/realTimeUpdates';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Authenticate user
  const user = await getAuthenticatedUser({ req });
  if (!user || user.role !== 'teacher') {
    return res.status(401).json({ message: 'Unauthorized - Teacher access required' });
  }

  const { sessionId } = req.query;

  if (!sessionId) {
    return res.status(400).json({ message: 'Session ID required' });
  }

  try {
    const nano = await dbConnect();
    const db = nano.db.use('smartattend');

    // Get session document
    const sessionDoc = await db.get(sessionId);
    
    // Verify teacher owns this session
    if (sessionDoc.teacherId !== user._id) {
      return res.status(403).json({ message: 'Access denied - Not your session' });
    }

    // Get real-time attendance data
    const attendanceQuery = {
      selector: {
        type: 'attendance',
        sessionId: sessionId
      },
      fields: ['studentId', 'timestamp', 'method', 'validationData', 'securityMetrics']
    };

    const attendanceResult = await db.find(attendanceQuery);
    const attendanceRecords = attendanceResult.docs;

    // Calculate real-time statistics
    const analytics = calculateRealTimeAnalytics(sessionDoc, attendanceRecords);

    res.status(200).json({
      sessionId: sessionId,
      timestamp: new Date().toISOString(),
      analytics: analytics,
      lastUpdate: sessionDoc.attendanceStats?.lastUpdate || sessionDoc.startTime
    });

  } catch (error) {
    console.error('Error fetching session analytics:', error);
    if (error.statusCode === 404) {
      return res.status(404).json({ message: 'Session not found' });
    }
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}

/**
 * Calculate comprehensive real-time analytics
 */
function calculateRealTimeAnalytics(sessionDoc, attendanceRecords) {
  const now = new Date();
  const sessionStart = new Date(sessionDoc.startTime);
  const sessionDuration = (now - sessionStart) / (1000 * 60); // minutes

  // Basic attendance stats
  const totalPresent = attendanceRecords.length;
  const uniqueStudents = new Set(attendanceRecords.map(r => r.studentId)).size;
  
  // Method distribution
  const methodCounts = attendanceRecords.reduce((acc, record) => {
    acc[record.method] = (acc[record.method] || 0) + 1;
    return acc;
  }, {});

  // Security analysis
  const securityScores = attendanceRecords
    .filter(r => r.securityMetrics?.overallScore)
    .map(r => r.securityMetrics.overallScore);
  
  const avgSecurityScore = securityScores.length > 0 
    ? securityScores.reduce((a, b) => a + b, 0) / securityScores.length 
    : 0;

  // Risk level distribution
  const riskDistribution = attendanceRecords.reduce((acc, record) => {
    const risk = record.securityMetrics?.riskLevel || 'unknown';
    acc[risk] = (acc[risk] || 0) + 1;
    return acc;
  }, {});

  // Timeline analysis (attendance rate over time)
  const timeline = generateAttendanceTimeline(attendanceRecords, sessionStart, now);

  // Security violations
  const securityViolations = attendanceRecords.filter(r => 
    r.securityMetrics?.flags && r.securityMetrics.flags.length > 0
  ).length;

  // Validation methods effectiveness
  const validationStats = analyzeValidationMethods(attendanceRecords);

  return {
    session: {
      id: sessionDoc._id,
      status: sessionDoc.status,
      duration: Math.round(sessionDuration),
      remainingTime: calculateRemainingTime(sessionDoc.endTime, now)
    },
    attendance: {
      total: totalPresent,
      unique: uniqueStudents,
      percentage: sessionDoc.validationRequirements?.maxStudentsPerSession 
        ? Math.round((uniqueStudents / sessionDoc.validationRequirements.maxStudentsPerSession) * 100)
        : 0,
      rate: sessionDuration > 0 ? Math.round((totalPresent / sessionDuration) * 10) / 10 : 0, // per minute
      trend: calculateAttendanceTrend(attendanceRecords)
    },
    security: {
      averageScore: Math.round(avgSecurityScore * 10) / 10,
      violations: securityViolations,
      riskDistribution: riskDistribution,
      violationRate: totalPresent > 0 ? Math.round((securityViolations / totalPresent) * 100) : 0
    },
    methods: {
      distribution: methodCounts,
      effectiveness: validationStats,
      mostUsed: Object.keys(methodCounts).reduce((a, b) => 
        methodCounts[a] > methodCounts[b] ? a : b, 'unknown')
    },
    timeline: timeline,
    performance: {
      avgValidationTime: calculateAverageValidationTime(attendanceRecords),
      peakAttendanceTime: findPeakAttendanceTime(attendanceRecords),
      efficiency: calculateSystemEfficiency(attendanceRecords, sessionDuration)
    }
  };
}

/**
 * Generate attendance timeline for charting
 */
function generateAttendanceTimeline(records, sessionStart, currentTime) {
  const timeSlots = [];
  const slotDuration = 5; // 5-minute intervals
  const totalSlots = Math.ceil((currentTime - sessionStart) / (slotDuration * 60 * 1000));

  for (let i = 0; i < totalSlots; i++) {
    const slotStart = new Date(sessionStart.getTime() + (i * slotDuration * 60 * 1000));
    const slotEnd = new Date(slotStart.getTime() + (slotDuration * 60 * 1000));
    
    const slotRecords = records.filter(r => {
      const recordTime = new Date(r.timestamp);
      return recordTime >= slotStart && recordTime < slotEnd;
    });

    timeSlots.push({
      timestamp: slotStart.toISOString(),
      count: slotRecords.length,
      cumulative: records.filter(r => new Date(r.timestamp) <= slotEnd).length,
      averageSecurityScore: calculateSlotAvgSecurityScore(slotRecords)
    });
  }

  return timeSlots;
}

/**
 * Calculate remaining session time
 */
function calculateRemainingTime(endTime, currentTime) {
  const remaining = new Date(endTime) - currentTime;
  return Math.max(0, Math.round(remaining / (1000 * 60))); // minutes
}

/**
 * Calculate attendance trend
 */
function calculateAttendanceTrend(records) {
  if (records.length < 2) return 0;

  const sortedRecords = records.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const halfPoint = Math.floor(sortedRecords.length / 2);
  
  const firstHalf = sortedRecords.slice(0, halfPoint);
  const secondHalf = sortedRecords.slice(halfPoint);
  
  const firstHalfRate = firstHalf.length;
  const secondHalfRate = secondHalf.length;
  
  return secondHalfRate - firstHalfRate;
}

/**
 * Analyze validation methods effectiveness
 */
function analyzeValidationMethods(records) {
  const methods = {};
  
  records.forEach(record => {
    const method = record.method;
    if (!methods[method]) {
      methods[method] = {
        count: 0,
        totalSecurityScore: 0,
        violations: 0,
        avgTime: 0
      };
    }
    
    methods[method].count++;
    if (record.securityMetrics?.overallScore) {
      methods[method].totalSecurityScore += record.securityMetrics.overallScore;
    }
    if (record.securityMetrics?.flags?.length > 0) {
      methods[method].violations++;
    }
  });

  // Calculate averages
  Object.keys(methods).forEach(method => {
    const stats = methods[method];
    stats.avgSecurityScore = stats.count > 0 ? stats.totalSecurityScore / stats.count : 0;
    stats.violationRate = stats.count > 0 ? (stats.violations / stats.count) * 100 : 0;
    stats.effectiveness = Math.max(0, stats.avgSecurityScore - stats.violationRate);
  });

  return methods;
}

/**
 * Calculate average security score for a time slot
 */
function calculateSlotAvgSecurityScore(slotRecords) {
  if (slotRecords.length === 0) return 0;
  
  const scores = slotRecords
    .filter(r => r.securityMetrics?.overallScore)
    .map(r => r.securityMetrics.overallScore);
    
  return scores.length > 0 
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    : 0;
}

/**
 * Calculate average validation time
 */
function calculateAverageValidationTime(records) {
  // This would require validation timing data
  // For now, return estimated based on method
  const methodTimes = {
    'multi-factor': 3.5,
    'facial': 2.8,
    'proximity': 1.5,
    'qr': 1.2
  };
  
  let totalTime = 0;
  let count = 0;
  
  records.forEach(record => {
    if (methodTimes[record.method]) {
      totalTime += methodTimes[record.method];
      count++;
    }
  });
  
  return count > 0 ? Math.round((totalTime / count) * 10) / 10 : 0;
}

/**
 * Find peak attendance time
 */
function findPeakAttendanceTime(records) {
  if (records.length === 0) return null;
  
  const hourCounts = {};
  
  records.forEach(record => {
    const hour = new Date(record.timestamp).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });
  
  const peakHour = Object.keys(hourCounts).reduce((a, b) => 
    hourCounts[a] > hourCounts[b] ? a : b
  );
  
  return {
    hour: parseInt(peakHour),
    count: hourCounts[peakHour],
    time: `${peakHour}:00`
  };
}

/**
 * Calculate system efficiency
 */
function calculateSystemEfficiency(records, sessionDuration) {
  if (records.length === 0 || sessionDuration <= 0) return 0;
  
  const successfulValidations = records.filter(r => 
    !r.securityMetrics?.flags || r.securityMetrics.flags.length === 0
  ).length;
  
  const efficiency = (successfulValidations / records.length) * 100;
  const timeEfficiency = Math.min(100, (records.length / sessionDuration) * 10); // 10 per minute is ideal
  
  return Math.round((efficiency + timeEfficiency) / 2);
}
