// src/utils/sessionValidation.js

import crypto from 'crypto';

/**
 * Enhanced Session Validation with Multi-Layer Security
 * Implements encrypted tokens, MAC address validation, and temporal checks
 */

/**
 * Generate secure session token with embedded validation data
 */
export function generateSecureSessionToken(sessionData) {
  const timestamp = Date.now();
  const randomBytes = crypto.randomBytes(16).toString('hex');
  
  const tokenData = {
    sessionId: sessionData.sessionId,
    teacherId: sessionData.teacherId,
    courseId: sessionData.courseId,
    timestamp: timestamp,
    expiresAt: timestamp + (sessionData.duration * 60 * 1000),
    networkFingerprint: generateNetworkFingerprint(sessionData.networkInfo),
    validationHash: randomBytes,
    permissions: {
      allowedMethods: ['qr', 'facial', 'proximity', 'multi-factor'],
      maxAttempts: 3,
      requireProximity: true,
      requireBiometric: true
    }
  };

  // Encrypt the token data
  const encryptedToken = encryptTokenData(tokenData);
  
  return {
    token: encryptedToken,
    qrData: {
      sessionKey: sessionData.sessionId,
      token: encryptedToken,
      validationHash: randomBytes,
      timestamp: timestamp
    },
    expiresAt: tokenData.expiresAt
  };
}

/**
 * Validate session token with comprehensive security checks
 */
export function validateSessionToken(encryptedToken, validationContext) {
  try {
    const tokenData = decryptTokenData(encryptedToken);
    const currentTime = Date.now();
    
    const validationResult = {
      isValid: false,
      errors: [],
      warnings: [],
      securityScore: 0,
      validationDetails: {}
    };

    // 1. Time-based validation
    if (currentTime > tokenData.expiresAt) {
      validationResult.errors.push('TOKEN_EXPIRED');
      return validationResult;
    }

    if (currentTime < tokenData.timestamp) {
      validationResult.errors.push('INVALID_TIMESTAMP');
      return validationResult;
    }

    // 2. Network fingerprint validation
    const currentFingerprint = generateNetworkFingerprint(validationContext.networkInfo);
    const fingerprintMatch = validateNetworkFingerprint(
      tokenData.networkFingerprint, 
      currentFingerprint
    );
    
    validationResult.validationDetails.fingerprintMatch = fingerprintMatch;
    if (!fingerprintMatch.isValid) {
      if (fingerprintMatch.score < 0.3) {
        validationResult.errors.push('NETWORK_FINGERPRINT_MISMATCH');
      } else {
        validationResult.warnings.push('PARTIAL_NETWORK_MATCH');
      }
    }

    // 3. MAC address validation (if available)
    if (tokenData.networkFingerprint.macAddress && validationContext.networkInfo.macAddress) {
      const macMatch = validateMACAddress(
        tokenData.networkFingerprint.macAddress,
        validationContext.networkInfo.macAddress
      );
      validationResult.validationDetails.macMatch = macMatch;
      if (!macMatch) {
        validationResult.errors.push('MAC_ADDRESS_MISMATCH');
      }
    }

    // 4. Geolocation drift validation
    if (tokenData.networkFingerprint.geolocation && validationContext.networkInfo.geolocation) {
      const locationDrift = calculateLocationDrift(
        tokenData.networkFingerprint.geolocation,
        validationContext.networkInfo.geolocation
      );
      validationResult.validationDetails.locationDrift = locationDrift;
      
      if (locationDrift.distance > 100) { // 100 meters max drift
        validationResult.errors.push('EXCESSIVE_LOCATION_DRIFT');
      } else if (locationDrift.distance > 50) {
        validationResult.warnings.push('MODERATE_LOCATION_DRIFT');
      }
    }

    // 5. Rate limiting validation
    const rateLimitCheck = validateRateLimit(
      validationContext.studentId,
      tokenData.sessionId,
      currentTime
    );
    validationResult.validationDetails.rateLimit = rateLimitCheck;
    if (!rateLimitCheck.allowed) {
      validationResult.errors.push('RATE_LIMIT_EXCEEDED');
    }

    // 6. Session integrity validation
    const integrityCheck = validateSessionIntegrity(tokenData, validationContext);
    validationResult.validationDetails.integrity = integrityCheck;
    if (!integrityCheck.valid) {
      validationResult.errors.push('SESSION_INTEGRITY_VIOLATION');
    }

    // Calculate security score
    validationResult.securityScore = calculateSecurityScore(validationResult);
    
    // Final validation
    validationResult.isValid = validationResult.errors.length === 0 && 
                               validationResult.securityScore >= 70;

    return validationResult;

  } catch (error) {
    return {
      isValid: false,
      errors: ['TOKEN_DECRYPTION_FAILED'],
      warnings: [],
      securityScore: 0,
      validationDetails: { error: error.message }
    };
  }
}

/**
 * Generate network fingerprint for enhanced validation
 */
function generateNetworkFingerprint(networkInfo) {
  return {
    ipAddress: networkInfo.ipAddress,
    macAddress: networkInfo.macAddress || null,
    wifiSSID: networkInfo.wifiSSID || null,
    bluetoothDevices: networkInfo.bluetoothDevices || [],
    geolocation: networkInfo.geolocation || null,
    userAgent: networkInfo.userAgent || '',
    platform: networkInfo.platform || '',
    timestamp: Date.now(),
    hash: generateFingerprintHash(networkInfo)
  };
}

/**
 * Generate cryptographic hash of network fingerprint
 */
function generateFingerprintHash(networkInfo) {
  const fingerprintString = JSON.stringify({
    ip: networkInfo.ipAddress,
    mac: networkInfo.macAddress,
    ssid: networkInfo.wifiSSID,
    ua: networkInfo.userAgent?.substring(0, 50), // Truncate for consistency
    platform: networkInfo.platform
  });
  
  return crypto.createHash('sha256').update(fingerprintString).digest('hex');
}

/**
 * Validate network fingerprint match
 */
function validateNetworkFingerprint(originalFingerprint, currentFingerprint) {
  let score = 0;
  let maxScore = 0;
  const details = {};

  // IP address check (weight: 30%)
  maxScore += 30;
  if (originalFingerprint.ipAddress === currentFingerprint.ipAddress) {
    score += 30;
    details.ipMatch = true;
  } else {
    details.ipMatch = false;
    details.ipDrift = {
      original: originalFingerprint.ipAddress,
      current: currentFingerprint.ipAddress
    };
  }

  // MAC address check (weight: 25%)
  maxScore += 25;
  if (originalFingerprint.macAddress && currentFingerprint.macAddress) {
    if (originalFingerprint.macAddress === currentFingerprint.macAddress) {
      score += 25;
      details.macMatch = true;
    } else {
      details.macMatch = false;
    }
  } else {
    score += 12; // Partial score if MAC not available
    details.macMatch = 'unavailable';
  }

  // WiFi SSID check (weight: 20%)
  maxScore += 20;
  if (originalFingerprint.wifiSSID === currentFingerprint.wifiSSID) {
    score += 20;
    details.wifiMatch = true;
  } else {
    details.wifiMatch = false;
  }

  // User Agent check (weight: 15%)
  maxScore += 15;
  if (originalFingerprint.userAgent === currentFingerprint.userAgent) {
    score += 15;
    details.userAgentMatch = true;
  } else {
    // Partial match for similar user agents
    const similarity = calculateStringSimilarity(
      originalFingerprint.userAgent, 
      currentFingerprint.userAgent
    );
    score += Math.floor(15 * similarity);
    details.userAgentMatch = similarity > 0.8;
    details.userAgentSimilarity = similarity;
  }

  // Platform check (weight: 10%)
  maxScore += 10;
  if (originalFingerprint.platform === currentFingerprint.platform) {
    score += 10;
    details.platformMatch = true;
  } else {
    details.platformMatch = false;
  }

  const finalScore = score / maxScore;
  
  return {
    isValid: finalScore >= 0.7, // 70% threshold
    score: finalScore,
    details: details,
    confidence: finalScore >= 0.9 ? 'high' : finalScore >= 0.7 ? 'medium' : 'low'
  };
}

/**
 * Validate MAC address consistency
 */
function validateMACAddress(originalMAC, currentMAC) {
  if (!originalMAC || !currentMAC) return null;
  
  // Normalize MAC addresses (remove separators, convert to lowercase)
  const normalizeMAC = (mac) => mac.replace(/[:-]/g, '').toLowerCase();
  
  return normalizeMAC(originalMAC) === normalizeMAC(currentMAC);
}

/**
 * Calculate location drift between two coordinates
 */
function calculateLocationDrift(originalLocation, currentLocation) {
  if (!originalLocation || !currentLocation) return { distance: 0, withinThreshold: true };

  const R = 6371e3; // Earth's radius in meters
  const φ1 = originalLocation.lat * Math.PI / 180;
  const φ2 = currentLocation.lat * Math.PI / 180;
  const Δφ = (currentLocation.lat - originalLocation.lat) * Math.PI / 180;
  const Δλ = (currentLocation.lng - originalLocation.lng) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  const distance = R * c;
  
  return {
    distance: Math.round(distance),
    withinThreshold: distance <= 100, // 100 meter threshold
    accuracy: Math.max(originalLocation.accuracy || 0, currentLocation.accuracy || 0)
  };
}

/**
 * Rate limiting validation
 */
const rateLimitStore = new Map(); // In production, use Redis or database

function validateRateLimit(studentId, sessionId, currentTime) {
  const key = `${studentId}:${sessionId}`;
  const windowMs = 60000; // 1 minute window
  const maxAttempts = 5; // Maximum 5 attempts per minute
  
  const now = currentTime;
  const windowStart = now - windowMs;
  
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, []);
  }
  
  const attempts = rateLimitStore.get(key);
  
  // Remove old attempts outside the window
  const recentAttempts = attempts.filter(timestamp => timestamp > windowStart);
  rateLimitStore.set(key, recentAttempts);
  
  // Check if within limit
  if (recentAttempts.length >= maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: recentAttempts[0] + windowMs,
      attempts: recentAttempts.length
    };
  }
  
  // Add current attempt
  recentAttempts.push(now);
  rateLimitStore.set(key, recentAttempts);
  
  return {
    allowed: true,
    remaining: maxAttempts - recentAttempts.length,
    resetTime: now + windowMs,
    attempts: recentAttempts.length
  };
}

/**
 * Session integrity validation
 */
function validateSessionIntegrity(tokenData, validationContext) {
  const issues = [];
  
  // Check if session ID matches
  if (tokenData.sessionId !== validationContext.sessionId) {
    issues.push('SESSION_ID_MISMATCH');
  }
  
  // Check if student is enrolled in the course
  if (validationContext.studentCourses && 
      !validationContext.studentCourses.includes(tokenData.courseId)) {
    issues.push('STUDENT_NOT_ENROLLED');
  }
  
  // Check temporal consistency
  const tokenAge = Date.now() - tokenData.timestamp;
  if (tokenAge > 24 * 60 * 60 * 1000) { // 24 hours max age
    issues.push('TOKEN_TOO_OLD');
  }
  
  return {
    valid: issues.length === 0,
    issues: issues,
    score: Math.max(0, 100 - (issues.length * 25))
  };
}

/**
 * Calculate overall security score
 */
function calculateSecurityScore(validationResult) {
  let score = 100;
  
  // Deduct points for errors
  score -= validationResult.errors.length * 25;
  
  // Deduct points for warnings
  score -= validationResult.warnings.length * 10;
  
  // Add points for strong validation
  if (validationResult.validationDetails.fingerprintMatch?.score > 0.9) {
    score += 10;
  }
  
  if (validationResult.validationDetails.macMatch === true) {
    score += 15;
  }
  
  if (validationResult.validationDetails.locationDrift?.distance < 10) {
    score += 5;
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Encrypt token data
 */
function encryptTokenData(tokenData) {
  const algorithm = 'aes-256-gcm';
  const secretKey = process.env.SESSION_ENCRYPTION_KEY || 'default-key-change-in-production';
  const key = crypto.scryptSync(secretKey, 'salt', 32);
  // Use a random IV (nonce) for GCM; 12-16 bytes recommended. We'll use 12 bytes.
  const iv = crypto.randomBytes(12);

  // createCipheriv is required for AEAD modes like GCM
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  cipher.setAAD(Buffer.from('smartattend-session'));

  let encrypted = cipher.update(JSON.stringify(tokenData), 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

/**
 * Decrypt token data
 */
function decryptTokenData(encryptedData) {
  const algorithm = 'aes-256-gcm';
  const secretKey = process.env.SESSION_ENCRYPTION_KEY || 'default-key-change-in-production';
  const key = crypto.scryptSync(secretKey, 'salt', 32);

  const iv = Buffer.from(encryptedData.iv, 'hex');

  // createDecipheriv paired with the same IV and key
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAAD(Buffer.from('smartattend-session'));
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}

/**
 * Calculate string similarity (for user agent comparison)
 */
function calculateStringSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = calculateEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate edit distance between two strings
 */
function calculateEditDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}
