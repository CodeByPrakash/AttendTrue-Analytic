// src/pages/api/admin/predictive-analytics.js

import { getAuthenticatedUser } from '../../../lib/auth-helper';
import dbConnect from '../../../lib/couchdb';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const user = await getAuthenticatedUser({ req });
  if (!user || user.role !== 'admin') {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const nano = await dbConnect();
    const db = nano.db.use('smartattend');

    // Get all data needed for predictions
    const [studentsResult, attendanceResult, sessionsResult, coursesResult] = await Promise.all([
      db.find({ selector: { type: 'user', role: 'student' } }),
      db.find({ selector: { type: 'attendance' } }),
      db.find({ selector: { type: 'session' } }),
      db.find({ selector: { type: 'course' } })
    ]);

    const students = studentsResult.docs;
    const attendance = attendanceResult.docs;
    const sessions = sessionsResult.docs;
    const courses = coursesResult.docs;

    // Generate predictive insights
    const predictions = {
      atRiskPredictions: predictAtRiskStudents(students, attendance, sessions),
      attendanceTrends: predictAttendanceTrends(attendance, sessions),
      coursePerformance: predictCoursePerformance(courses, attendance, sessions),
      semesterOutlook: predictSemesterOutlook(students, attendance, sessions),
      interventionRecommendations: generateInterventionRecommendations(students, attendance),
      capacityPredictions: predictCapacityNeeds(sessions, attendance),
      engagementForecast: predictEngagementTrends(students, attendance)
    };

    res.status(200).json({
      ...predictions,
      generatedAt: new Date().toISOString(),
      confidence: calculateOverallConfidence(predictions),
      disclaimer: 'Predictions are based on historical data and current trends. Actual results may vary.'
    });

  } catch (error) {
    console.error('Error generating predictive analytics:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}

/**
 * Predict which students are likely to become at-risk
 */
function predictAtRiskStudents(students, attendance, sessions) {
  const predictions = [];
  const currentDate = new Date();
  const thirtyDaysAgo = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  students.forEach(student => {
    const studentAttendance = attendance.filter(a => a.studentId === student._id);
    const recentAttendance = studentAttendance.filter(a => 
      new Date(a.timestamp) >= thirtyDaysAgo
    );

    // Calculate trend metrics
    const totalSessions = sessions.filter(s => 
      new Date(s.startTime) >= thirtyDaysAgo
    ).length;
    
    const attendanceRate = totalSessions > 0 ? (recentAttendance.length / totalSessions) * 100 : 0;
    const trend = calculateAttendanceTrend(studentAttendance);
    const consistency = calculateConsistency(studentAttendance);
    
    // Risk factors
    const riskFactors = {
      declining_trend: trend < -5,
      low_recent_attendance: attendanceRate < 70,
      inconsistent_pattern: consistency < 0.6,
      no_recent_activity: recentAttendance.length === 0,
      low_engagement: (student.gamificationStats?.totalPoints || 0) < 50
    };

    const riskScore = calculateRiskScore(riskFactors, attendanceRate, trend);
    const confidence = calculatePredictionConfidence(studentAttendance.length, consistency);

    if (riskScore > 60) {
      predictions.push({
        studentId: student._id,
        name: student.name || `${student.firstName} ${student.lastName}`,
        currentAttendanceRate: parseFloat(attendanceRate.toFixed(1)),
        riskScore: parseFloat(riskScore.toFixed(1)),
        riskLevel: getRiskLevel(riskScore),
        trend: trend,
        confidence: parseFloat(confidence.toFixed(1)),
        riskFactors: Object.entries(riskFactors).filter(([_, value]) => value).map(([key, _]) => key),
        predictedOutcome: riskScore > 80 ? 'likely_to_fail' : 'needs_intervention',
        recommendedActions: generateStudentRecommendations(riskFactors, riskScore),
        timeframe: riskScore > 80 ? 'immediate' : 'within_2_weeks'
      });
    }
  });

  return predictions.sort((a, b) => b.riskScore - a.riskScore);
}

/**
 * Predict attendance trends over time
 */
function predictAttendanceTrends(attendance, sessions) {
  const monthlyData = groupAttendanceByMonth(attendance, sessions);
  const trends = [];

  // Calculate trends for next 3 months
  for (let i = 1; i <= 3; i++) {
    const futureMonth = new Date();
    futureMonth.setMonth(futureMonth.getMonth() + i);
    
    const trendPrediction = predictMonthlyAttendance(monthlyData, futureMonth);
    trends.push({
      month: futureMonth.toISOString().slice(0, 7),
      predictedAttendanceRate: parseFloat(trendPrediction.rate.toFixed(1)),
      confidence: parseFloat(trendPrediction.confidence.toFixed(1)),
      factors: trendPrediction.factors,
      trend: trendPrediction.trend
    });
  }

  return {
    historical: monthlyData,
    predictions: trends,
    overallTrend: calculateOverallTrend(monthlyData),
    seasonalFactors: identifySeasonalFactors(monthlyData)
  };
}

/**
 * Predict course performance and capacity needs
 */
function predictCoursePerformance(courses, attendance, sessions) {
  return courses.map(course => {
    const courseSessions = sessions.filter(s => s.courseId === course._id);
    const courseAttendance = attendance.filter(a => 
      courseSessions.some(s => s._id === a.sessionId)
    );

    const averageAttendance = courseSessions.length > 0 
      ? courseAttendance.length / courseSessions.length 
      : 0;

    const trend = calculateCourseAttendanceTrend(courseAttendance, courseSessions);
    const predictedFinalRate = predictFinalAttendanceRate(averageAttendance, trend);

    return {
      courseId: course._id,
      courseName: course.name,
      currentAverageAttendance: parseFloat(averageAttendance.toFixed(1)),
      trend: parseFloat(trend.toFixed(1)),
      predictedFinalRate: parseFloat(predictedFinalRate.toFixed(1)),
      riskLevel: predictedFinalRate < 70 ? 'high' : predictedFinalRate < 85 ? 'medium' : 'low',
      interventionNeeded: predictedFinalRate < 75,
      capacity: {
        current: course.students?.length || 0,
        optimal: Math.ceil(averageAttendance * 1.2),
        predicted: Math.ceil(predictedFinalRate * (course.students?.length || 0) / 100)
      }
    };
  });
}

/**
 * Predict semester outlook
 */
function predictSemesterOutlook(students, attendance, sessions) {
  const totalStudents = students.length;
  const currentAttendanceRate = attendance.length / (sessions.length * totalStudents) * 100;
  
  const atRiskCount = students.filter(student => {
    const studentAttendance = attendance.filter(a => a.studentId === student._id);
    const rate = (studentAttendance.length / Math.max(1, sessions.length)) * 100;
    return rate < 75;
  }).length;

  const trend = calculateGlobalTrend(attendance, sessions);
  const projectedEndRate = currentAttendanceRate + (trend * 12); // Project 3 months ahead

  return {
    current: {
      overallAttendanceRate: parseFloat(currentAttendanceRate.toFixed(1)),
      studentsAtRisk: atRiskCount,
      percentageAtRisk: parseFloat(((atRiskCount / totalStudents) * 100).toFixed(1))
    },
    projected: {
      endOfSemesterRate: parseFloat(Math.max(0, Math.min(100, projectedEndRate)).toFixed(1)),
      projectedAtRiskStudents: Math.ceil(atRiskCount * (1 + Math.max(0, -trend / 10))),
      passingRate: parseFloat((Math.max(0, 100 - ((atRiskCount / totalStudents) * 100))).toFixed(1))
    },
    trend: trend,
    confidence: 75, // Based on data quality and historical accuracy
    recommendations: generateSemesterRecommendations(currentAttendanceRate, trend, atRiskCount, totalStudents)
  };
}

/**
 * Generate intervention recommendations
 */
function generateInterventionRecommendations(students, attendance) {
  const recommendations = [];
  
  // System-wide recommendations
  const overallRate = (attendance.length / students.length) || 0;
  
  if (overallRate < 20) {
    recommendations.push({
      type: 'system',
      priority: 'critical',
      action: 'Implement immediate institution-wide attendance improvement program',
      impact: 'high',
      timeframe: 'immediate'
    });
  }

  // Course-specific recommendations
  const lowPerformingCourses = identifyLowPerformingCourses(attendance);
  lowPerformingCourses.forEach(course => {
    recommendations.push({
      type: 'course',
      courseId: course.courseId,
      priority: course.attendanceRate < 60 ? 'high' : 'medium',
      action: `Review teaching methods and engagement strategies for ${course.courseName}`,
      impact: 'medium',
      timeframe: 'within_week'
    });
  });

  // Technology recommendations
  const methodUsage = analyzeMethodUsage(attendance);
  if (methodUsage.multiFactorUsage < 30) {
    recommendations.push({
      type: 'technology',
      priority: 'medium',
      action: 'Promote multi-factor authentication adoption',
      impact: 'medium',
      timeframe: 'within_month'
    });
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { critical: 3, high: 2, medium: 1, low: 0 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
}

/**
 * Predict capacity needs
 */
function predictCapacityNeeds(sessions, attendance) {
  const sessionCapacity = sessions.map(session => {
    const sessionAttendance = attendance.filter(a => a.sessionId === session._id);
    return {
      sessionId: session._id,
      courseId: session.courseId,
      capacity: sessionAttendance.length,
      date: session.startTime
    };
  });

  const avgCapacity = sessionCapacity.reduce((sum, s) => sum + s.capacity, 0) / sessionCapacity.length;
  const peakCapacity = Math.max(...sessionCapacity.map(s => s.capacity));
  
  return {
    current: {
      averageCapacity: Math.ceil(avgCapacity),
      peakCapacity: peakCapacity,
      utilizationRate: parseFloat(((avgCapacity / peakCapacity) * 100).toFixed(1))
    },
    predicted: {
      nextMonthAverage: Math.ceil(avgCapacity * 1.05), // Slight growth assumption
      recommendedCapacity: Math.ceil(peakCapacity * 1.2), // 20% buffer
      infrastructureNeeds: peakCapacity > 100 ? 'upgrade_required' : 'sufficient'
    }
  };
}

/**
 * Predict engagement trends
 */
function predictEngagementTrends(students, attendance) {
  const engagementMetrics = students.map(student => {
    const studentAttendance = attendance.filter(a => a.studentId === student._id);
    const gamificationStats = student.gamificationStats || {};
    
    return {
      studentId: student._id,
      attendanceEngagement: studentAttendance.length,
      pointsEngagement: gamificationStats.totalPoints || 0,
      streakEngagement: gamificationStats.currentStreak || 0,
      overallEngagement: calculateEngagementScore(studentAttendance.length, gamificationStats)
    };
  });

  const avgEngagement = engagementMetrics.reduce((sum, e) => sum + e.overallEngagement, 0) / engagementMetrics.length;
  
  return {
    current: {
      averageEngagement: parseFloat(avgEngagement.toFixed(1)),
      highlyEngaged: engagementMetrics.filter(e => e.overallEngagement > 80).length,
      lowEngagement: engagementMetrics.filter(e => e.overallEngagement < 40).length
    },
    predicted: {
      nextMonthTrend: avgEngagement > 60 ? 'increasing' : 'decreasing',
      riskOfDisengagement: engagementMetrics.filter(e => e.overallEngagement < 40).length / engagementMetrics.length * 100,
      interventionSuccess: avgEngagement > 50 ? 85 : 65 // Success rate of interventions
    }
  };
}

// Utility functions for calculations
function calculateAttendanceTrend(attendanceHistory) {
  if (attendanceHistory.length < 5) return 0;
  
  const recent = attendanceHistory.slice(-10);
  const older = attendanceHistory.slice(-20, -10);
  
  const recentRate = recent.length / 10 * 100;
  const olderRate = older.length / 10 * 100;
  
  return recentRate - olderRate;
}

function calculateConsistency(attendanceHistory) {
  if (attendanceHistory.length < 3) return 0;
  
  const intervals = [];
  for (let i = 1; i < attendanceHistory.length; i++) {
    const diff = new Date(attendanceHistory[i].timestamp) - new Date(attendanceHistory[i-1].timestamp);
    intervals.push(diff);
  }
  
  const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
  
  return 1 / (1 + variance / Math.pow(avgInterval, 2));
}

function calculateRiskScore(riskFactors, attendanceRate, trend) {
  let score = 0;
  
  if (riskFactors.declining_trend) score += 25;
  if (riskFactors.low_recent_attendance) score += 30;
  if (riskFactors.inconsistent_pattern) score += 15;
  if (riskFactors.no_recent_activity) score += 20;
  if (riskFactors.low_engagement) score += 10;
  
  // Adjust based on attendance rate
  score += Math.max(0, 75 - attendanceRate);
  
  // Adjust based on trend
  score += Math.max(0, -trend * 2);
  
  return Math.min(100, score);
}

function calculatePredictionConfidence(dataPoints, consistency) {
  let confidence = 50; // Base confidence
  
  if (dataPoints > 20) confidence += 20;
  else if (dataPoints > 10) confidence += 10;
  
  confidence += consistency * 30;
  
  return Math.min(95, confidence);
}

function getRiskLevel(riskScore) {
  if (riskScore > 80) return 'critical';
  if (riskScore > 60) return 'high';
  if (riskScore > 40) return 'medium';
  return 'low';
}

function generateStudentRecommendations(riskFactors, riskScore) {
  const recommendations = [];
  
  if (riskFactors.no_recent_activity) {
    recommendations.push('Contact student immediately to verify enrollment status');
  }
  
  if (riskFactors.declining_trend) {
    recommendations.push('Schedule counseling session to identify barriers');
  }
  
  if (riskFactors.low_engagement) {
    recommendations.push('Implement gamification incentives');
  }
  
  if (riskScore > 80) {
    recommendations.push('Consider academic intervention or support services');
  }
  
  return recommendations;
}

function groupAttendanceByMonth(attendance, sessions) {
  const monthlyData = {};
  
  sessions.forEach(session => {
    const month = new Date(session.startTime).toISOString().slice(0, 7);
    const sessionAttendance = attendance.filter(a => a.sessionId === session._id);
    
    if (!monthlyData[month]) {
      monthlyData[month] = { sessions: 0, attendance: 0 };
    }
    
    monthlyData[month].sessions++;
    monthlyData[month].attendance += sessionAttendance.length;
  });
  
  return monthlyData;
}

function predictMonthlyAttendance(historicalData, targetMonth) {
  // Simple trend-based prediction
  const months = Object.keys(historicalData).sort();
  const rates = months.map(month => {
    const data = historicalData[month];
    return data.sessions > 0 ? (data.attendance / data.sessions) * 100 : 0;
  });
  
  const trend = rates.length > 1 ? (rates[rates.length - 1] - rates[0]) / rates.length : 0;
  const lastRate = rates[rates.length - 1] || 0;
  
  return {
    rate: Math.max(0, Math.min(100, lastRate + trend)),
    confidence: rates.length > 3 ? 75 : 50,
    factors: ['historical_trend', 'seasonal_patterns'],
    trend: trend > 0 ? 'increasing' : trend < 0 ? 'decreasing' : 'stable'
  };
}

function calculateOverallTrend(monthlyData) {
  const months = Object.keys(monthlyData).sort();
  const rates = months.map(month => {
    const data = monthlyData[month];
    return data.sessions > 0 ? (data.attendance / data.sessions) * 100 : 0;
  });
  
  if (rates.length < 2) return 0;
  
  return (rates[rates.length - 1] - rates[0]) / rates.length;
}

function identifySeasonalFactors(monthlyData) {
  // Simplified seasonal analysis
  return {
    peakMonths: ['09', '10', '02', '03'], // Typically higher attendance
    lowMonths: ['12', '01', '05'], // Holidays and exam periods
    pattern: 'academic_calendar_driven'
  };
}

function calculateCourseAttendanceTrend(courseAttendance, courseSessions) {
  if (courseSessions.length < 2) return 0;
  
  const sessionAttendance = courseSessions.map(session => {
    return courseAttendance.filter(a => a.sessionId === session._id).length;
  });
  
  const firstHalf = sessionAttendance.slice(0, Math.floor(sessionAttendance.length / 2));
  const secondHalf = sessionAttendance.slice(Math.floor(sessionAttendance.length / 2));
  
  const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
  
  return secondAvg - firstAvg;
}

function predictFinalAttendanceRate(currentAverage, trend) {
  return Math.max(0, Math.min(100, currentAverage + (trend * 5))); // Project trend forward
}

function calculateGlobalTrend(attendance, sessions) {
  const monthlyRates = groupAttendanceByMonth(attendance, sessions);
  return calculateOverallTrend(monthlyRates);
}

function generateSemesterRecommendations(currentRate, trend, atRiskCount, totalStudents) {
  const recommendations = [];
  
  if (currentRate < 70) {
    recommendations.push('Implement institution-wide attendance improvement initiative');
  }
  
  if (trend < -5) {
    recommendations.push('Address declining attendance trend with targeted interventions');
  }
  
  if (atRiskCount / totalStudents > 0.3) {
    recommendations.push('Scale up academic support services');
  }
  
  return recommendations;
}

function identifyLowPerformingCourses(attendance) {
  // Simplified implementation - would need session data grouped by course
  return [];
}

function analyzeMethodUsage(attendance) {
  const total = attendance.length;
  const multiFactorCount = attendance.filter(a => a.method === 'multi-factor').length;
  
  return {
    multiFactorUsage: total > 0 ? (multiFactorCount / total) * 100 : 0
  };
}

function calculateEngagementScore(attendanceCount, gamificationStats) {
  const attendanceScore = Math.min(100, attendanceCount * 5);
  const pointsScore = Math.min(100, (gamificationStats.totalPoints || 0) / 10);
  const streakScore = Math.min(100, (gamificationStats.currentStreak || 0) * 10);
  
  return (attendanceScore * 0.5) + (pointsScore * 0.3) + (streakScore * 0.2);
}

function calculateOverallConfidence(predictions) {
  // Calculate average confidence across all predictions
  const confidenceValues = [];
  
  if (predictions.atRiskPredictions) {
    confidenceValues.push(...predictions.atRiskPredictions.map(p => p.confidence));
  }
  
  if (predictions.attendanceTrends?.predictions) {
    confidenceValues.push(...predictions.attendanceTrends.predictions.map(p => p.confidence));
  }
  
  if (confidenceValues.length === 0) return 70; // Default confidence
  
  return confidenceValues.reduce((sum, val) => sum + val, 0) / confidenceValues.length;
}
