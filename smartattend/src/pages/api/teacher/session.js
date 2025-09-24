import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import dbConnect from '../../../lib/couchdb';
import { randomBytes } from 'crypto';
import { generateSecureSessionToken } from '../../../utils/sessionValidation';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user || session.user.role !== 'teacher') {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { courseId, duration, networkInfo, networkRequirement } = req.body; // e.g., courseId: "course:CS101"

  if (!courseId || !duration) {
    return res.status(400).json({ message: 'Missing course ID or duration' });
  }

  try {
  const nano = await dbConnect();
  const db = nano.db.use('smartattend');
  const teacherId = session.user.id;

    // 1. Verify the teacher is assigned to the course
    const courseDoc = await db.get(courseId);
    if (!courseDoc || courseDoc.teacherId !== teacherId) {
      return res.status(403).json({ message: 'You are not the teacher of this course' });
    }

    // 2. Create the new session document with enhanced security
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + parseInt(duration, 10) * 60000); // duration in minutes
    const uniquePart = randomBytes(8).toString('hex');
    const sessionId = `session:${courseId.split(':')[1]}_${startTime.toISOString()}_${uniquePart}`;
    
    // Enhanced network info capture for proximity validation
    const teacherIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';
    
    // Combine server-side and client-side network info
    const completeNetworkInfo = {
      ipAddress: teacherIp,
      userAgent: userAgent,
      platform: req.headers['sec-ch-ua-platform'] || 'Unknown',
      ...(networkInfo || {}) // Client-provided: wifiSSID, macAddress, bluetoothDevices, geolocation
    };

    // Generate secure session token with multi-layer validation
    const sessionData = {
      sessionId: sessionId,
      teacherId: teacherId,
      courseId: courseId,
      duration: parseInt(duration, 10),
      networkInfo: completeNetworkInfo
    };

    const secureToken = generateSecureSessionToken(sessionData);

    const newSessionDoc = {
      _id: sessionId,
      type: 'session',
      teacherId: teacherId,
      courseId: courseId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      status: 'active',
      networkInfo: completeNetworkInfo,
      securityToken: secureToken,
      validationRequirements: {
        requireProximity: true,
        requireBiometric: true,
        requireTimeValidity: true,
        requireMACValidation: !!completeNetworkInfo.macAddress,
        requireGeolocationValidation: !!completeNetworkInfo.geolocation,
        primaryProximityThreshold: 1, // require at least 1 of IP/WiFi/Bluetooth due to web constraints
        geofenceRadiusMeters: 50,
        maxStudentsPerSession: req.body.maxStudents || 100,
        securityLevel: 'high', // high, medium, low
        antiSpoofingEnabled: true,
        // New: explicit network requirement so students know where to connect
        network: {
          ssid: (networkRequirement && networkRequirement.ssid) ? String(networkRequirement.ssid).trim() : '',
          requireSamePublicIp: !!(networkRequirement && networkRequirement.requireSamePublicIp),
          expectedPublicIp: teacherIp || ''
        }
      },
      attendanceStats: {
        totalStudents: 0,
        presentStudents: 0,
        validationAttempts: 0,
        securityViolations: 0,
        lastUpdate: startTime.toISOString()
      },
      realTimeUpdates: {
        enabled: true,
        lastBroadcast: startTime.toISOString(),
        connectedClients: []
      }
    };

    await db.insert(newSessionDoc);

    // Generate QR code data with secure token
    const qrCodeData = {
      sessionId: sessionId,
      token: secureToken.token,
      validationHash: secureToken.qrData.validationHash,
      expires: secureToken.expiresAt,
      securityLevel: 'high'
    };

    res.status(201).json({
      message: 'Session created successfully',
      sessionId: sessionId,
      endTime: newSessionDoc.endTime,
      secureToken: secureToken,
      qrCodeData: qrCodeData,
      validationRequirements: newSessionDoc.validationRequirements,
      networkFingerprint: {
        captured: Object.keys(completeNetworkInfo).length,
        securityScore: calculateNetworkSecurityScore(completeNetworkInfo)
      }
    });

  } catch (error) {
    console.error('Error creating session:', error);
    if (error.statusCode === 404) {
      return res.status(404).json({ message: 'Course not found' });
    }
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}

/**
 * Calculate network security score based on available info
 */
function calculateNetworkSecurityScore(networkInfo) {
  let score = 0;
  let maxScore = 100;

  // IP address (20 points)
  if (networkInfo.ipAddress) score += 20;

  // MAC address (25 points)
  if (networkInfo.macAddress) score += 25;

  // WiFi SSID (20 points)
  if (networkInfo.wifiSSID) score += 20;

  // Geolocation (20 points)
  if (networkInfo.geolocation && networkInfo.geolocation.lat && networkInfo.geolocation.lng) {
    score += 20;
  }

  // User Agent (10 points)
  if (networkInfo.userAgent && networkInfo.userAgent.length > 10) score += 10;

  // Bluetooth devices (5 points)
  if (networkInfo.bluetoothDevices && networkInfo.bluetoothDevices.length > 0) score += 5;

  return Math.round((score / maxScore) * 100);
}