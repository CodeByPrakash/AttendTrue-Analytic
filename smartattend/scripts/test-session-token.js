// Quick smoke test for session token generation
const { generateSecureSessionToken, validateSessionToken } = require('../src/utils/sessionValidation.js');

(async () => {
  try {
    const sessionData = {
      sessionId: 'sess_test_123',
      teacherId: 'teacher:abc',
      courseId: 'course:XYZ',
      duration: 30,
      networkInfo: {
        ipAddress: '127.0.0.1',
        macAddress: null,
        wifiSSID: 'TestSSID',
        bluetoothDevices: [],
        geolocation: { lat: 0, lng: 0, accuracy: 100 },
        userAgent: 'node-test',
        platform: process.platform
      }
    };

    const token = generateSecureSessionToken(sessionData);
    console.log('Generated token OK:', !!token && !!token.token && !!token.token.iv);

    const validationContext = {
      networkInfo: sessionData.networkInfo,
      studentId: 'student:123',
      sessionId: sessionData.sessionId,
      studentCourses: ['course:XYZ']
    };

    const result = validateSessionToken(token.token, validationContext);
    console.log('Validation ran. isValid:', result.isValid, 'errors:', result.errors);
  } catch (e) {
    console.error('Error during test:', e);
    process.exit(1);
  }
})();
