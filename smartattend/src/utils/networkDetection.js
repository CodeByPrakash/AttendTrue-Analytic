// src/utils/networkDetection.js

/**
 * Network Detection Utilities for Enhanced Proximity Validation
 * Implements WiFi, Bluetooth, and Geolocation detection for anti-proxy measures
 */

/**
 * Get current WiFi network information
 * Note: Direct WiFi SSID access is limited in browsers for security reasons
 */
export async function getWiFiInfo() {
  try {
    // For PWA/mobile apps, we can use navigator.connection
    if ('connection' in navigator) {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      return {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        // Note: SSID is not directly accessible via web APIs for security
        // In a real implementation, you'd need a native mobile app or browser extension
        wifiSSID: null, // This would need to be manually input or detected via native bridge
      };
    }
    return { wifiSSID: null };
  } catch (error) {
    console.error('Error getting WiFi info:', error);
    return { wifiSSID: null };
  }
}

/**
 * Detect nearby Bluetooth devices
 * Uses Web Bluetooth API where available
 */
export async function detectBluetoothDevices() {
  try {
    if (!navigator.bluetooth) {
      console.warn('Bluetooth API not supported');
      return { bluetoothMAC: null, nearbyDevices: [] };
    }

    // Request permission to scan for devices
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['battery_service'] // Add any services you want to detect
    });

    return {
      bluetoothMAC: device.id || null, // Device ID (not always MAC address)
      deviceName: device.name || 'Unknown',
      nearbyDevices: [device.id]
    };
  } catch (error) {
    console.error('Bluetooth detection error:', error);
    return { bluetoothMAC: null, nearbyDevices: [] };
  }
}

/**
 * Get precise geolocation
 */
export async function getGeolocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        });
      },
      (error) => {
        reject(new Error(`Geolocation error: ${error.message}`));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000
      }
    );
  });
}

/**
 * Get comprehensive network information for validation
 */
export async function gatherNetworkInfo() {
  const networkInfo = {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  try {
    // Attempt to gather WiFi info
    const wifiInfo = await getWiFiInfo();
    Object.assign(networkInfo, wifiInfo);
  } catch (error) {
    console.warn('WiFi detection failed:', error);
    networkInfo.wifiSSID = null;
  }

  try {
    // Attempt to gather Bluetooth info
    const bluetoothInfo = await detectBluetoothDevices();
    Object.assign(networkInfo, bluetoothInfo);
  } catch (error) {
    console.warn('Bluetooth detection failed:', error);
    networkInfo.bluetoothMAC = null;
  }

  try {
    // Attempt to get geolocation
    const locationInfo = await getGeolocation();
    networkInfo.geolocation = locationInfo;
  } catch (error) {
    console.warn('Geolocation failed:', error);
    networkInfo.geolocation = null;
  }

  return networkInfo;
}

/**
 * Manual network info input form (fallback when automatic detection fails)
 */
export function createManualNetworkForm() {
  return {
    wifiSSID: '',
    bluetoothDevices: [],
    geolocation: null,
    isManualInput: true
  };
}

/**
 * Validate network info quality
 */
export function validateNetworkInfoQuality(networkInfo) {
  const quality = {
    score: 0,
    factors: {
      hasWiFi: !!networkInfo.wifiSSID,
      hasBluetooth: !!networkInfo.bluetoothMAC,
      hasLocation: !!networkInfo.geolocation,
      hasDeviceInfo: !!networkInfo.userAgent
    }
  };

  // Calculate quality score (0-100)
  if (quality.factors.hasWiFi) quality.score += 30;
  if (quality.factors.hasBluetooth) quality.score += 30;
  if (quality.factors.hasLocation) quality.score += 25;
  if (quality.factors.hasDeviceInfo) quality.score += 15;

  quality.isHighQuality = quality.score >= 70;
  quality.isAcceptable = quality.score >= 45;

  return quality;
}

/**
 * Network fingerprinting for additional security
 */
export async function generateNetworkFingerprint() {
  const fingerprint = {
    screen: {
      width: screen.width,
      height: screen.height,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth
    },
    navigator: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine
    },
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timestamp: Date.now()
  };

  // Add WebGL fingerprint if available
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        fingerprint.webgl = {
          vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
          renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
        };
      }
    }
  } catch (error) {
    console.warn('WebGL fingerprinting failed:', error);
  }

  return fingerprint;
}

/**
 * Mock functions for development/testing
 */
export const mockNetworkInfo = {
  wifiSSID: 'College-WiFi-Main',
  bluetoothMAC: '00:11:22:33:44:55',
  geolocation: {
    lat: 28.6139,
    lng: 77.2090,
    accuracy: 10,
    timestamp: Date.now()
  },
  userAgent: navigator.userAgent,
  isMockData: true
};

/**
 * Development helper to simulate network detection
 */
export function simulateNetworkDetection() {
  return Promise.resolve(mockNetworkInfo);
}
