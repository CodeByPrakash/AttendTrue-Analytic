// src/utils/gamification.js

/**
 * Enhanced Gamification System for SmartAttend
 * Includes achievements, badges, motivation messages, and advanced scoring
 */

// Achievement definitions
export const ACHIEVEMENTS = {
  PERFECT_WEEK: {
    id: 'perfect_week',
    name: 'Perfect Week',
    description: 'Attend all sessions for a full week',
    icon: '🏆',
    points: 50,
    category: 'streak'
  },
  EARLY_BIRD: {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Be among the first 3 to mark attendance 5 times',
    icon: '🐦',
    points: 30,
    category: 'timing'
  },
  STREAK_MASTER: {
    id: 'streak_master',
    name: 'Streak Master',
    description: 'Maintain a 30-day attendance streak',
    icon: '🔥',
    points: 100,
    category: 'streak'
  },
  TECH_SAVVY: {
    id: 'tech_savvy',
    name: 'Tech Savvy',
    description: 'Use multi-factor authentication 10 times',
    icon: '🤖',
    points: 25,
    category: 'security'
  },
  CONSISTENT_PERFORMER: {
    id: 'consistent_performer',
    name: 'Consistent Performer',
    description: 'Maintain 90%+ attendance for a month',
    icon: '⭐',
    points: 75,
    category: 'performance'
  },
  FACE_SCAN_PIONEER: {
    id: 'face_scan_pioneer',
    name: 'Face Scan Pioneer',
    description: 'Use facial recognition 20 times',
    icon: '👤',
    points: 20,
    category: 'biometric'
  },
  SEMESTER_CHAMPION: {
    id: 'semester_champion',
    name: 'Semester Champion',
    description: 'Achieve 95%+ attendance for entire semester',
    icon: '🏅',
    points: 200,
    category: 'performance'
  },
  QUICK_SCANNER: {
    id: 'quick_scanner',
    name: 'Quick Scanner',
    description: 'Mark attendance within 30 seconds of session start 5 times',
    icon: '⚡',
    points: 15,
    category: 'speed'
  }
};

// Badge tiers based on total points
export const BADGE_TIERS = {
  BRONZE: { min: 0, max: 199, name: 'Bronze', icon: '🥉', color: '#CD7F32' },
  SILVER: { min: 200, max: 499, name: 'Silver', icon: '🥈', color: '#C0C0C0' },
  GOLD: { min: 500, max: 999, name: 'Gold', icon: '🥇', color: '#FFD700' },
  PLATINUM: { min: 1000, max: 1999, name: 'Platinum', icon: '💎', color: '#E5E4E2' },
  DIAMOND: { min: 2000, max: Infinity, name: 'Diamond', icon: '💍', color: '#B9F2FF' }
};

/**
 * Calculates the attendance score.
 */
export function calculateAttendanceScore(attendedSessions, totalSessions) {
  if (totalSessions === 0) {
    return 0;
  }
  return parseFloat(((attendedSessions / totalSessions) * 100).toFixed(1));
}

// (Removed duplicate calculateStreak and an alternate generateLeaderboardAndRank to avoid export collisions.)

/**
 * Get badge tier from total points
 */
export function getBadgeFromPoints(totalPoints) {
  for (const [tier, config] of Object.entries(BADGE_TIERS)) {
    if (totalPoints >= config.min && totalPoints <= config.max) {
      return { tier, ...config };
    }
  }
  return { tier: 'BRONZE', ...BADGE_TIERS.BRONZE };
}

/**
 * Check for new achievements
 */
export function checkAchievements(studentData, attendanceHistory, sessionData) {
  const newAchievements = [];
  const existingAchievements = studentData.gamificationStats?.achievements || [];
  const existingIds = new Set(existingAchievements.map(a => a.id));

  // Check Perfect Week achievement
  if (!existingIds.has('perfect_week')) {
    const perfectWeek = checkPerfectWeek(attendanceHistory, sessionData);
    if (perfectWeek) {
      newAchievements.push({
        ...ACHIEVEMENTS.PERFECT_WEEK,
        earnedAt: new Date().toISOString()
      });
    }
  }

  // Check Streak Master achievement
  if (!existingIds.has('streak_master')) {
    const currentStreak = studentData.gamificationStats?.currentStreak || 0;
    if (currentStreak >= 30) {
      newAchievements.push({
        ...ACHIEVEMENTS.STREAK_MASTER,
        earnedAt: new Date().toISOString()
      });
    }
  }

  // Check Tech Savvy achievement
  if (!existingIds.has('tech_savvy')) {
    const multiFactor = attendanceHistory.filter(a => a.method === 'multi-factor').length;
    if (multiFactor >= 10) {
      newAchievements.push({
        ...ACHIEVEMENTS.TECH_SAVVY,
        earnedAt: new Date().toISOString()
      });
    }
  }

  // Check Face Scan Pioneer achievement
  if (!existingIds.has('face_scan_pioneer')) {
    const facialScans = attendanceHistory.filter(a => 
      a.method === 'facial' || a.method === 'multi-factor'
    ).length;
    if (facialScans >= 20) {
      newAchievements.push({
        ...ACHIEVEMENTS.FACE_SCAN_PIONEER,
        earnedAt: new Date().toISOString()
      });
    }
  }

  return newAchievements;
}

/**
 * Check if student has a perfect week
 */
function checkPerfectWeek(attendanceHistory, sessionData) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const recentSessions = sessionData.filter(session => 
    new Date(session.startTime) >= weekAgo && new Date(session.startTime) <= now
  );
  
  const recentAttendance = attendanceHistory.filter(attendance => {
    const session = sessionData.find(s => s._id === attendance.sessionId);
    return session && new Date(session.startTime) >= weekAgo;
  });

  return recentSessions.length > 0 && recentAttendance.length === recentSessions.length;
}

/**
 * Generate motivational messages based on performance
 */
export function generateMotivationalMessage(studentStats, leaderboard) {
  const { rank, attendanceRate, currentStreak, totalPoints } = studentStats;
  const totalStudents = leaderboard.length;
  const percentile = ((totalStudents - rank + 1) / totalStudents) * 100;

  // Achievement-based messages
  if (currentStreak >= 30) {
    return {
      message: "🔥 Incredible! You're on a 30+ day streak! You're unstoppable!",
      type: "achievement",
      color: "#ff6b35"
    };
  }

  if (currentStreak >= 14) {
    return {
      message: "🌟 Amazing 2-week streak! Keep the momentum going!",
      type: "encouragement",
      color: "#4ade80"
    };
  }

  if (currentStreak >= 7) {
    return {
      message: "🚀 One week streak! You're building great habits!",
      type: "milestone",
      color: "#3b82f6"
    };
  }

  // Rank-based messages
  if (percentile >= 90) {
    return {
      message: `🏆 Outstanding! You're in the top 10% (Rank #${rank})!`,
      type: "excellence",
      color: "#fbbf24"
    };
  }

  if (percentile >= 75) {
    return {
      message: `⭐ Great work! Top 25% performance (Rank #${rank})!`,
      type: "achievement",
      color: "#8b5cf6"
    };
  }

  if (percentile >= 50) {
    return {
      message: `💪 You're above average! Keep pushing higher!`,
      type: "encouragement",
      color: "#06b6d4"
    };
  }

  // Attendance rate messages
  if (attendanceRate >= 95) {
    return {
      message: "🎯 Perfect attendance! You're setting the standard!",
      type: "achievement",
      color: "#10b981"
    };
  }

  if (attendanceRate >= 85) {
    return {
      message: "✅ Excellent attendance! You're doing great!",
      type: "positive",
      color: "#059669"
    };
  }

  if (attendanceRate >= 75) {
    return {
      message: "📈 Good attendance! A little more effort will make a big difference!",
      type: "encouragement",
      color: "#0891b2"
    };
  }

  // Encouraging messages for lower performance
  if (attendanceRate >= 60) {
    return {
      message: "🎯 You're on the right track! Every session counts!",
      type: "motivation",
      color: "#0284c7"
    };
  }

  return {
    message: "💫 Every day is a new opportunity! Let's improve together!",
    type: "supportive",
    color: "#6366f1"
  };
}

/**
 * Calculate points for different attendance methods
 */
export function calculateAttendancePoints(method, validationQuality, isEarly = false) {
  let basePoints = 10;
  
  // Method-based points
  switch (method) {
    case 'multi-factor':
      basePoints = 15;
      break;
    case 'facial':
      basePoints = 12;
      break;
    case 'proximity':
      basePoints = 8;
      break;
    case 'qr':
      basePoints = 10;
      break;
    default:
      basePoints = 5;
  }

  // Validation quality bonus
  if (validationQuality?.isHighQuality) {
    basePoints += 3;
  } else if (validationQuality?.isAcceptable) {
    basePoints += 1;
  }

  // Early attendance bonus
  if (isEarly) {
    basePoints += 2;
  }

  return basePoints;
}

/**
 * Get progress towards next badge
 */
export function getBadgeProgress(totalPoints) {
  const currentBadge = getBadgeFromPoints(totalPoints);
  const nextTierKey = Object.keys(BADGE_TIERS)[Object.keys(BADGE_TIERS).indexOf(currentBadge.tier) + 1];
  
  if (!nextTierKey) {
    return {
      current: currentBadge,
      next: null,
      progress: 100,
      pointsNeeded: 0
    };
  }

  const nextTier = BADGE_TIERS[nextTierKey];
  const pointsNeeded = nextTier.min - totalPoints;
  const progress = Math.min(100, ((totalPoints - currentBadge.min) / (nextTier.min - currentBadge.min)) * 100);

  return {
    current: currentBadge,
    next: { tier: nextTierKey, ...nextTier },
    progress: Math.round(progress),
    pointsNeeded
  };
}

/**
 * Calculates the current attendance streak.
 * @param {Array<Object>} studentAttendance - Array of the student's attendance documents.
 * @param {Array<Object>} allSessionsForStudent - Array of all session documents for the student's courses, sorted descending by date.
 * @returns {number} - The current streak count.
 */
export function calculateStreak(studentAttendance, allSessionsForStudent) {
  const attendedSessionIds = new Set(studentAttendance.map(a => a.sessionId));
  let streak = 0;
  for (const session of allSessionsForStudent) {
    if (attendedSessionIds.has(session._id)) {
      streak++;
    } else {
      break; // Streak is broken
    }
  }
  return streak;
}

/**
 * Generates a leaderboard and finds the current student's rank.
 * @param {string} currentStudentId - The ID of the currently logged-in student.
 * @param {Array<Object>} allAttendanceRecords - Array of all attendance documents from the DB.
 * @returns {Object} - An object containing the top 10 leaderboard and the student's rank.
 */
export function generateLeaderboardAndRank(currentStudentId, allAttendanceRecords) {
  const attendanceCounts = allAttendanceRecords.reduce((acc, record) => {
    acc[record.studentId] = (acc[record.studentId] || 0) + 1;
    return acc;
  }, {});

  const rankedStudents = Object.entries(attendanceCounts)
    .sort(([, countA], [, countB]) => countB - countA)
    .map(([studentId, count], index) => ({
      studentId,
      attendanceCount: count,
      rank: index + 1,
    }));

  const studentRank = rankedStudents.find(s => s.studentId === currentStudentId);
  
  // We need to fetch student names separately in the API route to enrich this data.
  return {
    leaderboard: rankedStudents.slice(0, 10),
    rank: studentRank ? studentRank.rank : 'N/A',
  };
}
