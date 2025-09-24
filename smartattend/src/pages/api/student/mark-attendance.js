import dbConnect from '../../../lib/couchdb';
import { getAuthenticatedUser } from '../../../lib/auth-helper';
import { generateValidationReport } from '../../../utils/proximityValidation';
import { validateSessionToken } from '../../../utils/sessionValidation';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Use the unified helper to get the user
  const user = await getAuthenticatedUser({ req, res });
  if (!user || user.role !== 'student') {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { sessionId, method, networkInfo: clientNetworkInfo, biometricData, sessionToken } = req.body;

  if (!sessionId || !method) {
    return res.status(400).json({ message: 'Missing session ID or method' });
  }

  if (!['qr', 'facial', 'proximity', 'multi-factor'].includes(method)) {
    return res.status(400).json({ message: 'Invalid method' });
  }

  try {
    const nano = await dbConnect();
    const db = nano.db.use('smartattend');
    const studentId = user._id;

    // 1. Fetch the session to validate it
    const sessionDoc = await db.get(sessionId);

    if (sessionDoc.status !== 'active') {
      return res.status(403).json({ message: 'This session is not active' });
    }

    const now = new Date();
    if (new Date(sessionDoc.endTime) < now) {
      return res.status(403).json({ message: 'This session has ended' });
    }

    // 2. Enhanced Session Token Validation (if provided)
    let tokenValidation = null;
  if (sessionToken && sessionDoc.securityToken) {
      const validationContext = {
        sessionId: sessionId,
        studentId: studentId,
  networkInfo: { ...clientNetworkInfo, ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress },
        studentCourses: user.courses || [] // Assuming user has enrolled courses
      };

      tokenValidation = validateSessionToken(sessionToken, validationContext);
      
      if (!tokenValidation.isValid) {
        // Log security violation
        try {
          await logSecurityViolation(db, sessionId, studentId, tokenValidation, networkInfo);
        } catch (logError) {
          console.error('Failed to log security violation:', logError);
        }

        return res.status(403).json({ 
          message: 'Session token validation failed',
          details: tokenValidation,
          securityScore: tokenValidation.securityScore,
          violations: tokenValidation.errors
        });
      }
    }

    // 3. Enhanced Multi-Factor Validation
  let validationResult = { isValid: true, details: {} };

    if (method === 'multi-factor' || method === 'proximity') {
      if (!clientNetworkInfo) {
        return res.status(400).json({ message: 'Network information required for proximity validation' });
      }

      // Run comprehensive validation
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const netInfo = { ...clientNetworkInfo, ipAddress: ip, serverSeenIp: ip };
      validationResult = generateValidationReport(sessionDoc, netInfo, { geofenceRadiusMeters: sessionDoc.validationRequirements?.geofenceRadiusMeters || 50 });
      
      if (!validationResult.isValid) {
        return res.status(403).json({ 
          message: 'Multi-factor validation failed',
          details: validationResult,
          reasons: {
            proximity: !validationResult.proximity.overall ? 'Location validation failed' : null,
            security: !validationResult.security ? 'Security hash mismatch' : null,
            spoofing: validationResult.spoofing.isSuspicious ? 'Suspicious activity detected' : null
          }
        });
      }
    }

    // 4. Biometric face verification enforcement (server-side)
    if (sessionDoc.validationRequirements?.requireBiometric) {
      try {
        const studentDoc = await db.get(studentId);
        const stored = studentDoc?.biometrics?.faceDescriptor;
        const provided = biometricData?.faceDescriptor;

        if (Array.isArray(stored) && stored.length === 128) {
          if (!Array.isArray(provided) || provided.length !== 128) {
            return res.status(400).json({ message: 'Biometric verification required. Face descriptor missing.' });
          }
          // Cosine similarity or Euclidean distance threshold (face-api.js descriptors are L2-normalized)
          const dist = Math.sqrt(stored.reduce((sum, v, i) => sum + Math.pow(v - provided[i], 2), 0));
          const threshold = 0.6; // typical threshold for face-api.js
          if (dist > threshold) {
            // Broadcast security alert for potential proxy attempt
            try {
              const { broadcastSecurityAlert } = await import('../../../utils/realTimeUpdates');
              broadcastSecurityAlert({
                sessionId,
                studentId,
                violationType: 'biometric_mismatch',
                severity: 'high',
                details: { distance: dist, threshold },
                timestamp: new Date().toISOString()
              });
            } catch (e) { /* non-fatal */ }
            return res.status(403).json({ message: 'Face verification failed. Teacher has been alerted.' });
          }
        }
      } catch (e) {
        // If student doc fetch fails for reasons other than 404, treat as server error
        if (e.statusCode && e.statusCode !== 404) throw e;
      }
    }

    // 5. Check if attendance is already marked to prevent duplicates
    const attendanceId = `attendance:${studentId}:${sessionId}`;
    try {
      await db.get(attendanceId);
      return res.status(409).json({ message: 'Attendance already marked for this session' });
    } catch (error) {
      if (error.statusCode !== 404) {
        throw error;
      }
    }

    // 6. Create the enhanced attendance record with token validation results
    const attendanceDoc = {
      _id: attendanceId,
      type: 'attendance',
      studentId: studentId,
      sessionId: sessionId,
      timestamp: now.toISOString(),
      method: method,
      status: 'present',
      validationData: {
        networkValidation: validationResult.proximity || null,
        securityValidation: validationResult.security || null,
        spoofingCheck: validationResult.spoofing || null,
        tokenValidation: tokenValidation ? {
          securityScore: tokenValidation.securityScore,
          confidence: tokenValidation.validationDetails.fingerprintMatch?.confidence || 'unknown',
          warnings: tokenValidation.warnings
        } : null,
        biometricUsed: !!biometricData,
        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'] || '',
      },
      securityMetrics: {
        overallScore: calculateOverallSecurityScore(validationResult, tokenValidation),
        riskLevel: determineRiskLevel(validationResult, tokenValidation),
        flags: collectSecurityFlags(validationResult, tokenValidation)
      }
    };

    await db.insert(attendanceDoc);

    // Update session statistics
    try {
      await updateSessionStats(db, sessionId, 'attendance_marked');
    } catch (statsError) {
      console.error('Failed to update session stats:', statsError);
    }

    // Trigger real-time updates
    try {
      const { broadcastAttendanceUpdate } = await import('../../../utils/realTimeUpdates');
      
      broadcastAttendanceUpdate({
        sessionId: sessionId,
        studentId: studentId,
        studentName: user.name || user.email,
        method: method,
        timestamp: now.toISOString(),
        validationData: attendanceDoc.validationData,
        securityMetrics: attendanceDoc.securityMetrics
      });
    } catch (realtimeError) {
      console.error('Failed to broadcast real-time update:', realtimeError);
    }

    res.status(201).json({ 
      message: 'Attendance marked successfully',
      validationDetails: validationResult,
      tokenValidation: tokenValidation ? {
        securityScore: tokenValidation.securityScore,
        warnings: tokenValidation.warnings.length
      } : null,
      securityMetrics: attendanceDoc.securityMetrics
    });

  } catch (error) {
    console.error('Error marking attendance:', error);
    if (error.statusCode === 404) {
      return res.status(404).json({ message: 'Session not found' });
    }
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}

/**
 * Log security violation for monitoring and analysis
 */
async function logSecurityViolation(db, sessionId, studentId, tokenValidation, networkInfo) {
  const violationId = `violation:${sessionId}:${studentId}:${Date.now()}`;
  
  const violationDoc = {
    _id: violationId,
    type: 'security_violation',
    sessionId: sessionId,
    studentId: studentId,
    timestamp: new Date().toISOString(),
    violationType: 'token_validation_failure',
    details: {
      errors: tokenValidation.errors,
      warnings: tokenValidation.warnings,
      securityScore: tokenValidation.securityScore,
      validationDetails: tokenValidation.validationDetails
    },
    networkInfo: networkInfo,
    severity: tokenValidation.securityScore < 30 ? 'high' : 
              tokenValidation.securityScore < 60 ? 'medium' : 'low'
  };

  await db.insert(violationDoc);
}

/**
 * Calculate overall security score combining all validation methods
 */
function calculateOverallSecurityScore(validationResult, tokenValidation) {
  let score = 100;
  
  // Proximity validation impact
  if (validationResult && !validationResult.isValid) {
    score -= 30;
  }
  
  // Token validation impact
  if (tokenValidation) {
    const tokenScore = tokenValidation.securityScore;
    score = Math.min(score, tokenScore + 20); // Token score is primary
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Determine risk level based on validation results
 */
function determineRiskLevel(validationResult, tokenValidation) {
  const score = calculateOverallSecurityScore(validationResult, tokenValidation);
  
  if (score >= 80) return 'low';
  if (score >= 60) return 'medium';
  if (score >= 40) return 'high';
  return 'critical';
}

/**
 * Collect security flags from validation results
 */
function collectSecurityFlags(validationResult, tokenValidation) {
  const flags = [];
  
  if (validationResult && validationResult.spoofing?.isSuspicious) {
    flags.push('spoofing_detected');
  }
  
  if (tokenValidation) {
    if (tokenValidation.errors.includes('MAC_ADDRESS_MISMATCH')) {
      flags.push('mac_mismatch');
    }
    if (tokenValidation.errors.includes('EXCESSIVE_LOCATION_DRIFT')) {
      flags.push('location_anomaly');
    }
    if (tokenValidation.errors.includes('RATE_LIMIT_EXCEEDED')) {
      flags.push('rate_limit_violation');
    }
  }
  
  return flags;
}

/**
 * Update session statistics for real-time monitoring
 */
async function updateSessionStats(db, sessionId, action) {
  try {
    const sessionDoc = await db.get(sessionId);
    
    if (!sessionDoc.attendanceStats) {
      sessionDoc.attendanceStats = {
        totalStudents: 0,
        presentStudents: 0,
        validationAttempts: 0,
        securityViolations: 0,
        lastUpdate: new Date().toISOString()
      };
    }
    
    switch (action) {
      case 'attendance_marked':
        sessionDoc.attendanceStats.presentStudents += 1;
        sessionDoc.attendanceStats.validationAttempts += 1;
        break;
      case 'validation_failed':
        sessionDoc.attendanceStats.validationAttempts += 1;
        break;
      case 'security_violation':
        sessionDoc.attendanceStats.securityViolations += 1;
        break;
    }
    
    sessionDoc.attendanceStats.lastUpdate = new Date().toISOString();
    
    await db.insert(sessionDoc);
  } catch (error) {
    console.error('Failed to update session stats:', error);
  }
}
