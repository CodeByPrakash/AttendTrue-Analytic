// src/utils/proximityValidation.js

/**
 * Enhanced Proximity Validation for Anti-Proxy Attendance
 * Implements multi-factor validation: IP, WiFi SSID, Bluetooth, and optional Geolocation
 */

/**
 * Validates if student is in the same network as teacher
 */
export function validateIPProximity(teacherIP, studentIP) {
  if (!teacherIP || !studentIP) return false;
  
  // For local networks, check if both are in same subnet
  const teacherSubnet = teacherIP.split('.').slice(0, 3).join('.');
  const studentSubnet = studentIP.split('.').slice(0, 3).join('.');
  
  return teacherSubnet === studentSubnet;
}

/**
 * Validates WiFi SSID match
 */
export function validateWiFiSSID(sessionSSID, studentSSID) {
  if (!sessionSSID || !studentSSID) return false;
  return sessionSSID === studentSSID;
}

/**
 * Validates Bluetooth proximity using MAC addresses
 */
export function validateBluetooth(sessionBluetooth, studentBluetooth) {
  if (!sessionBluetooth || !studentBluetooth) return false;
  
  // Check if student's device can detect teacher's Bluetooth
  if (Array.isArray(studentBluetooth)) {
    return studentBluetooth.some(mac => 
      sessionBluetooth.toLowerCase() === mac.toLowerCase()
    );
  }
  
  return sessionBluetooth.toLowerCase() === studentBluetooth.toLowerCase();
}

/**
 * Validates geolocation proximity (optional)
 */
export function validateGeolocation(sessionLocation, studentLocation, radiusMeters = 50) {
  if (!sessionLocation || !studentLocation) return true; // Optional validation
  
  const { lat: lat1, lng: lng1 } = sessionLocation;
  const { lat: lat2, lng: lng2 } = studentLocation;
  
  // Haversine formula for distance calculation
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  const distance = R * c;
  
  return distance <= radiusMeters;
}

/**
 * Comprehensive proximity validation
 */
export function validateProximityFactors(sessionNetworkInfo, studentNetworkInfo) {
  const validations = {
    ip: false,
    wifi: false,
    bluetooth: false,
    geolocation: false,
    overall: false
  };

  // IP Validation
  if (sessionNetworkInfo.ipAddress && studentNetworkInfo.ipAddress) {
    validations.ip = validateIPProximity(
      sessionNetworkInfo.ipAddress, 
      studentNetworkInfo.ipAddress
    );
  }

  // WiFi SSID Validation
  if (sessionNetworkInfo.wifiSSID && studentNetworkInfo.wifiSSID) {
    validations.wifi = validateWiFiSSID(
      sessionNetworkInfo.wifiSSID, 
      studentNetworkInfo.wifiSSID
    );
  }

  // Bluetooth Validation
  if (sessionNetworkInfo.bluetoothMAC && studentNetworkInfo.bluetoothMAC) {
    validations.bluetooth = validateBluetooth(
      sessionNetworkInfo.bluetoothMAC, 
      studentNetworkInfo.bluetoothMAC
    );
  }

  // Geolocation Validation (optional)
  if (sessionNetworkInfo.geolocation && studentNetworkInfo.geolocation) {
    validations.geolocation = validateGeolocation(
      sessionNetworkInfo.geolocation, 
      studentNetworkInfo.geolocation
    );
  }

  // Overall validation logic
  // At least 2 out of 3 primary factors (IP, WiFi, Bluetooth) must pass
  const primaryFactorsPassed = [
    validations.ip,
    validations.wifi,
    validations.bluetooth
  ].filter(Boolean).length;

  validations.overall = primaryFactorsPassed >= 2;

  return validations;
}

/**
 * Enhanced session security validation
 */
export function validateSessionSecurity(sessionDoc, securityHash) {
  if (!sessionDoc.networkInfo.securityHash || !securityHash) {
    return false;
  }
  
  return sessionDoc.networkInfo.securityHash === securityHash;
}

/**
 * Anti-spoofing checks
 */
export function detectSpoofingAttempts(sessionNetworkInfo, studentNetworkInfo) {
  const suspiciousActivity = [];

  // Check for exact user agent match (could indicate spoofing)
  if (sessionNetworkInfo.userAgent === studentNetworkInfo.userAgent) {
    suspiciousActivity.push('identical_user_agents');
  }

  // Check for impossible geolocation (too far from campus)
  if (studentNetworkInfo.geolocation) {
    // Add campus boundary checks here
    // For now, we'll check for obvious impossible locations
    const { lat, lng } = studentNetworkInfo.geolocation;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      suspiciousActivity.push('invalid_coordinates');
    }
  }

  // Check for rapid location changes (if we store previous locations)
  // This would require database integration

  return {
    isSuspicious: suspiciousActivity.length > 0,
    flags: suspiciousActivity
  };
}

/**
 * Generate comprehensive validation report
 */
export function generateValidationReport(sessionDoc, studentNetworkInfo) {
  const proximityValidation = validateProximityFactors(
    sessionDoc.networkInfo, 
    studentNetworkInfo
  );
  
  const securityValidation = validateSessionSecurity(
    sessionDoc, 
    studentNetworkInfo.securityHash
  );
  
  const spoofingCheck = detectSpoofingAttempts(
    sessionDoc.networkInfo, 
    studentNetworkInfo
  );

  return {
    proximity: proximityValidation,
    security: securityValidation,
    spoofing: spoofingCheck,
    isValid: proximityValidation.overall && securityValidation && !spoofingCheck.isSuspicious,
    timestamp: new Date().toISOString()
  };
}
