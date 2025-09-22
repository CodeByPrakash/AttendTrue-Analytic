// src/utils/realTimeUpdates.js

/**
 * Real-time Updates System using WebSocket and Server-Sent Events
 * Provides live attendance updates for teacher dashboards
 */

import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';

let io = null;

/**
 * Initialize WebSocket server for real-time updates
 */
export function initializeWebSocketServer(server) {
  if (io) return io;
  
  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Handle teacher joining their session room
    socket.on('join-session', (data) => {
      const { sessionId, teacherId, role } = data;
      
      if (role === 'teacher') {
        socket.join(`session:${sessionId}`);
        socket.join(`teacher:${teacherId}`);
        
        socket.emit('joined-session', { 
          sessionId, 
          message: 'Connected to session updates',
          timestamp: new Date().toISOString()
        });
        
        console.log(`Teacher ${teacherId} joined session ${sessionId}`);
      }
    });

    // Handle student joining for attendance updates
    socket.on('join-student-updates', (data) => {
      const { studentId } = data;
      socket.join(`student:${studentId}`);
      
      socket.emit('joined-student-updates', {
        studentId,
        message: 'Connected to student updates',
        timestamp: new Date().toISOString()
      });
    });

    // Handle attendance marking notification
    socket.on('attendance-marked', (data) => {
      broadcastAttendanceUpdate(data);
    });

    // Handle session status updates
    socket.on('session-status-update', (data) => {
      broadcastSessionUpdate(data);
    });

    // Handle real-time analytics requests
    socket.on('request-analytics', async (data) => {
      try {
        const analytics = await generateRealTimeAnalytics(data.sessionId);
        socket.emit('analytics-update', analytics);
      } catch (error) {
        socket.emit('analytics-error', { 
          message: 'Failed to generate analytics',
          error: error.message 
        });
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  return io;
}

/**
 * Broadcast attendance update to all connected clients
 */
export function broadcastAttendanceUpdate(data) {
  if (!io) {
    console.warn('WebSocket server not initialized');
    return;
  }

  const {
    sessionId,
    studentId,
    studentName,
    method,
    timestamp,
    validationData,
    securityMetrics
  } = data;

  const updateData = {
    type: 'attendance_marked',
    sessionId,
    student: {
      id: studentId,
      name: studentName
    },
    method,
    timestamp,
    validation: {
      score: securityMetrics?.overallScore || 0,
      riskLevel: securityMetrics?.riskLevel || 'unknown',
      flags: securityMetrics?.flags || []
    },
    details: validationData
  };

  // Send to session room (teachers monitoring this session)
  io.to(`session:${sessionId}`).emit('attendance-update', updateData);

  // Send to student (for their personal updates)
  io.to(`student:${studentId}`).emit('personal-attendance-update', {
    ...updateData,
    message: 'Your attendance has been marked successfully'
  });

  console.log(`Broadcasted attendance update for student ${studentId} in session ${sessionId}`);
}

/**
 * Broadcast session status updates
 */
export function broadcastSessionUpdate(data) {
  if (!io) {
    console.warn('WebSocket server not initialized');
    return;
  }

  const {
    sessionId,
    status,
    stats,
    teacherId,
    message
  } = data;

  const updateData = {
    type: 'session_update',
    sessionId,
    status,
    stats: {
      totalPresent: stats?.presentStudents || 0,
      totalAttempts: stats?.validationAttempts || 0,
      securityViolations: stats?.securityViolations || 0,
      lastUpdate: stats?.lastUpdate || new Date().toISOString()
    },
    message,
    timestamp: new Date().toISOString()
  };

  // Send to session room
  io.to(`session:${sessionId}`).emit('session-update', updateData);

  // Send to teacher's personal room
  if (teacherId) {
    io.to(`teacher:${teacherId}`).emit('teacher-session-update', updateData);
  }

  console.log(`Broadcasted session update for session ${sessionId}`);
}

/**
 * Broadcast security alert
 */
export function broadcastSecurityAlert(data) {
  if (!io) {
    console.warn('WebSocket server not initialized');
    return;
  }

  const {
    sessionId,
    studentId,
    violationType,
    severity,
    details,
    timestamp
  } = data;

  const alertData = {
    type: 'security_alert',
    sessionId,
    studentId,
    violation: {
      type: violationType,
      severity,
      details,
      timestamp
    },
    timestamp: new Date().toISOString()
  };

  // Send to session room (critical for teachers)
  io.to(`session:${sessionId}`).emit('security-alert', alertData);

  console.log(`Broadcasted security alert for session ${sessionId}: ${violationType}`);
}

/**
 * Generate real-time analytics for a session
 */
async function generateRealTimeAnalytics(sessionId) {
  try {
    // This would typically fetch from database
    // For now, return mock data structure
    return {
      sessionId,
      timestamp: new Date().toISOString(),
      attendance: {
        total: 45,
        present: 38,
        absent: 7,
        percentage: 84.4,
        trend: '+2.1%'
      },
      security: {
        totalAttempts: 42,
        successfulValidations: 38,
        securityViolations: 4,
        averageSecurityScore: 87.3,
        riskDistribution: {
          low: 34,
          medium: 4,
          high: 0,
          critical: 0
        }
      },
      methods: {
        'multi-factor': 28,
        'facial': 6,
        'qr': 2,
        'proximity': 2
      },
      timeline: generateAttendanceTimeline(),
      geographical: generateGeographicalData()
    };
  } catch (error) {
    console.error('Error generating real-time analytics:', error);
    throw error;
  }
}

/**
 * Generate attendance timeline for real-time charts
 */
function generateAttendanceTimeline() {
  const timeline = [];
  const now = new Date();
  
  for (let i = 30; i >= 0; i -= 5) {
    const time = new Date(now.getTime() - (i * 60 * 1000));
    timeline.push({
      timestamp: time.toISOString(),
      cumulative: Math.floor(Math.random() * 35) + 5,
      rate: Math.floor(Math.random() * 8) + 1
    });
  }
  
  return timeline;
}

/**
 * Generate geographical distribution data
 */
function generateGeographicalData() {
  return {
    classroom: 85,
    nearbyArea: 12,
    suspicious: 3,
    accuracy: {
      high: 78,
      medium: 18,
      low: 4
    }
  };
}

/**
 * Send real-time notification to specific user
 */
export function sendNotificationToUser(userId, notification) {
  if (!io) {
    console.warn('WebSocket server not initialized');
    return;
  }

  const notificationData = {
    type: 'notification',
    ...notification,
    timestamp: new Date().toISOString()
  };

  io.to(`student:${userId}`).emit('notification', notificationData);
}

/**
 * Get connected clients count for a session
 */
export function getSessionConnectedClients(sessionId) {
  if (!io) return 0;
  
  const room = io.sockets.adapter.rooms.get(`session:${sessionId}`);
  return room ? room.size : 0;
}

/**
 * Cleanup disconnected sessions
 */
export function cleanupSession(sessionId) {
  if (!io) return;
  
  // Remove all clients from the session room
  io.in(`session:${sessionId}`).disconnectSockets();
  console.log(`Cleaned up session ${sessionId}`);
}

/**
 * Health check for WebSocket server
 */
export function getWebSocketHealth() {
  if (!io) {
    return {
      status: 'down',
      connected: 0,
      rooms: 0
    };
  }

  return {
    status: 'up',
    connected: io.engine.clientsCount,
    rooms: io.sockets.adapter.rooms.size,
    timestamp: new Date().toISOString()
  };
}

// Server-Sent Events fallback for browsers that don't support WebSocket
export class SSEManager {
  constructor() {
    this.clients = new Map();
  }

  addClient(req, res, clientId) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    this.clients.set(clientId, res);

    // Send initial connection event
    this.sendToClient(clientId, {
      type: 'connected',
      message: 'SSE connection established',
      timestamp: new Date().toISOString()
    });

    // Handle client disconnect
    req.on('close', () => {
      this.clients.delete(clientId);
      console.log(`SSE client ${clientId} disconnected`);
    });
  }

  sendToClient(clientId, data) {
    const client = this.clients.get(clientId);
    if (client) {
      client.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  }

  broadcastToAll(data) {
    for (const [clientId, client] of this.clients) {
      try {
        client.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch (error) {
        console.error(`Failed to send SSE data to client ${clientId}:`, error);
        this.clients.delete(clientId);
      }
    }
  }

  getClientCount() {
    return this.clients.size;
  }
}

export const sseManager = new SSEManager();
