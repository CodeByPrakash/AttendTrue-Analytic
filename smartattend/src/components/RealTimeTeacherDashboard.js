// src/components/RealTimeTeacherDashboard.js

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { io } from 'socket.io-client';

/**
 * Modern Real-Time Teacher Dashboard with Glassmorphism & Animations
 */
const RealTimeTeacherDashboard = ({ sessionId, teacherId, initialData }) => {
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [attendanceData, setAttendanceData] = useState(initialData || {});
  const [realtimeStats, setRealtimeStats] = useState({});
  const [securityAlerts, setSecurityAlerts] = useState([]);
  const [attendanceLog, setAttendanceLog] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const sseRef = useRef(null);

  // Intersection Observer for scroll animations
  const [statsRef, statsInView] = useInView({ threshold: 0.1, triggerOnce: true });
  const [chartsRef, chartsInView] = useInView({ threshold: 0.1, triggerOnce: true });

  useEffect(() => {
    initializeRealTimeConnection();
    setTimeout(() => setIsLoading(false), 1500);
    return () => cleanup();
  }, [sessionId, teacherId]);

  // Initialize WebSocket connection with fallback to SSE
  const initializeRealTimeConnection = async () => {
    try {
      await initializeWebSocket();
    } catch (error) {
      console.warn('WebSocket failed, falling back to SSE:', error);
      initializeSSE();
    }
  };

  // Initialize WebSocket connection
  const initializeWebSocket = () => {
    return new Promise((resolve, reject) => {
      try {
        fetch('/api/websocket');
        
        socketRef.current = io(process.env.NEXT_PUBLIC_WS_URL || window.location.origin, {
          transports: ['websocket', 'polling'],
          timeout: 5000,
          retries: 3
        });

        const socket = socketRef.current;

        socket.on('connect', () => {
          console.log('WebSocket connected');
          setConnectionStatus('connected');
          
          socket.emit('join-session', {
            sessionId,
            teacherId,
            role: 'teacher'
          });
          
          resolve(socket);
        });

        socket.on('joined-session', (data) => {
          console.log('Joined session room:', data);
          socket.emit('request-analytics', { sessionId });
        });

        socket.on('attendance-update', (data) => {
          handleAttendanceUpdate(data);
        });

        socket.on('session-update', (data) => {
          handleSessionUpdate(data);
        });

        socket.on('security-alert', (data) => {
          handleSecurityAlert(data);
        });

        socket.on('analytics-update', (data) => {
          setAnalyticsData(data);
        });

        socket.on('disconnect', () => {
          console.log('WebSocket disconnected');
          setConnectionStatus('disconnected');
          scheduleReconnect();
        });

        socket.on('connect_error', (error) => {
          console.error('WebSocket connection error:', error);
          setConnectionStatus('error');
          reject(error);
        });

        setTimeout(() => {
          if (socket.disconnected) {
            reject(new Error('WebSocket connection timeout'));
          }
        }, 5000);

      } catch (error) {
        reject(error);
      }
    });
  };

  // Initialize Server-Sent Events as fallback
  const initializeSSE = () => {
    try {
      const eventSource = new EventSource(`/api/sse/${sessionId}`);
      sseRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('SSE connected');
        setConnectionStatus('connected-sse');
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleSSEMessage(data);
        } catch (error) {
          console.error('Failed to parse SSE message:', error);
        }
      };

      eventSource.onerror = () => {
        console.error('SSE connection error');
        setConnectionStatus('error');
        scheduleReconnect();
      };

    } catch (error) {
      console.error('Failed to initialize SSE:', error);
      setConnectionStatus('error');
    }
  };

  // Handle SSE messages
  const handleSSEMessage = (data) => {
    switch (data.type) {
      case 'attendance_marked':
        handleAttendanceUpdate(data);
        break;
      case 'session_update':
        handleSessionUpdate(data);
        break;
      case 'security_alert':
        handleSecurityAlert(data);
        break;
      default:
        console.log('Unknown SSE message type:', data.type);
    }
  };

  // Handle attendance updates with animations
  const handleAttendanceUpdate = (data) => {
    console.log('Attendance update received:', data);
    
    setAttendanceLog(prev => [{
      id: `${data.student.id}-${Date.now()}`,
      timestamp: data.timestamp,
      studentName: data.student.name,
      method: data.method,
      securityScore: data.validation.score,
      riskLevel: data.validation.riskLevel,
      flags: data.validation.flags
    }, ...prev.slice(0, 49)]);

    setRealtimeStats(prev => ({
      ...prev,
      totalPresent: (prev.totalPresent || 0) + 1,
      lastUpdate: data.timestamp,
      methods: {
        ...prev.methods,
        [data.method]: (prev.methods?.[data.method] || 0) + 1
      }
    }));

    showNotification('Student Checked In', `${data.student.name} marked attendance via ${data.method}`, 'success');
  };

  // Handle session updates
  const handleSessionUpdate = (data) => {
    console.log('Session update received:', data);
    setRealtimeStats(prev => ({
      ...prev,
      ...data.stats
    }));
  };

  // Handle security alerts
  const handleSecurityAlert = (data) => {
    console.log('Security alert received:', data);
    
    const alert = {
      id: `alert-${Date.now()}`,
      timestamp: data.timestamp,
      type: data.violation.type,
      severity: data.violation.severity,
      studentId: data.studentId,
      details: data.violation.details
    };

    setSecurityAlerts(prev => [alert, ...prev.slice(0, 9)]);
    
    if (data.violation.severity === 'high' || data.violation.severity === 'critical') {
      showNotification('Security Alert', `${data.violation.type} detected`, 'error');
    }
  };

  // Schedule reconnection
  const scheduleReconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      console.log('Attempting to reconnect...');
      setConnectionStatus('reconnecting');
      initializeRealTimeConnection();
    }, 3000);
  };

  // Cleanup connections
  const cleanup = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    if (sseRef.current) {
      sseRef.current.close();
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
  };

  // Show notification
  const showNotification = (title, message, type = 'info') => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: message,
        icon: '/favicon.ico',
        tag: 'attendance-update'
      });
    }
  };

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Fetch analytics periodically
  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await fetch(`/api/realtime/session-analytics?sessionId=${sessionId}`);
        if (response.ok) {
          const data = await response.json();
          setAnalyticsData(data.analytics);
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      }
    };

    const interval = setInterval(fetchAnalytics, 30000);
    fetchAnalytics();

    return () => clearInterval(interval);
  }, [sessionId]);

  // Loading Screen
  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen p-6" style={{
      background: 'var(--gradient-cosmic)',
      position: 'relative'
    }}>
      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-pink-600/10" />
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500/20 rounded-full filter blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full filter blur-3xl animate-float" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold gradient-text mb-2">
                Live Dashboard
              </h1>
              <p className="text-white/70 text-lg">Real-time attendance monitoring</p>
            </div>
            <ConnectionStatusIndicator status={connectionStatus} />
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          ref={statsRef}
          initial={{ opacity: 0, y: 30 }}
          animate={statsInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, staggerChildren: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          <ModernStatsCard 
            title="Present Students" 
            value={realtimeStats.totalPresent || 0}
            subtitle="Live count"
            color="emerald"
            icon="👥"
            gradient="from-emerald-400 to-emerald-600"
          />
          <ModernStatsCard 
            title="Validation Attempts" 
            value={realtimeStats.totalAttempts || 0}
            subtitle="Total attempts"
            color="blue"
            icon="🔐"
            gradient="from-blue-400 to-blue-600"
          />
          <ModernStatsCard 
            title="Security Score" 
            value={analyticsData?.security?.averageScore || 0}
            subtitle="Average"
            color="purple"
            icon="🛡️"
            gradient="from-purple-400 to-purple-600"
          />
          <ModernStatsCard 
            title="Violations" 
            value={realtimeStats.securityViolations || 0}
            subtitle="Security alerts"
            color="red"
            icon="⚠️"
            gradient="from-red-400 to-red-600"
          />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Live Attendance Log */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="glass-card"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Live Attendance Log</h3>
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              <AnimatePresence>
                {attendanceLog.map((entry, index) => (
                  <AttendanceLogEntry key={entry.id} entry={entry} index={index} />
                ))}
              </AnimatePresence>
              {attendanceLog.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-12"
                >
                  <div className="text-6xl mb-4">📋</div>
                  <p className="text-white/60">No attendance marked yet</p>
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* Security Alerts */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="glass-card"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Security Alerts</h3>
              <div className="w-3 h-3 bg-orange-400 rounded-full animate-pulse" />
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              <AnimatePresence>
                {securityAlerts.map((alert, index) => (
                  <SecurityAlertItem key={alert.id} alert={alert} index={index} />
                ))}
              </AnimatePresence>
              {securityAlerts.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-12"
                >
                  <div className="text-6xl mb-4">🛡️</div>
                  <p className="text-white/60">No security alerts</p>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Analytics Charts */}
        {analyticsData && (
          <motion.div
            ref={chartsRef}
            initial={{ opacity: 0, y: 30 }}
            animate={chartsInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-8"
          >
            <RealTimeAnalyticsCharts data={analyticsData} />
          </motion.div>
        )}
      </div>
    </div>
  );
};

// Loading Screen Component
const LoadingScreen = () => {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--gradient-cosmic)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="text-center"
      >
        <div className="loading-dots mb-8">
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
        <h2 className="text-2xl font-semibold text-white mb-4">Connecting to Live Dashboard</h2>
        <p className="text-white/70">Setting up real-time monitoring...</p>
      </motion.div>
    </div>
  );
};

// Modern Connection Status Indicator
const ConnectionStatusIndicator = ({ status }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return { 
          color: 'from-green-400 to-emerald-500', 
          text: 'Connected (WebSocket)', 
          icon: '🟢',
          bg: 'bg-green-500/20',
          border: 'border-green-400/30'
        };
      case 'connected-sse':
        return { 
          color: 'from-blue-400 to-cyan-500', 
          text: 'Connected (SSE)', 
          icon: '🔵',
          bg: 'bg-blue-500/20',
          border: 'border-blue-400/30'
        };
      case 'connecting':
        return { 
          color: 'from-yellow-400 to-orange-500', 
          text: 'Connecting...', 
          icon: '🟡',
          bg: 'bg-yellow-500/20',
          border: 'border-yellow-400/30'
        };
      case 'reconnecting':
        return { 
          color: 'from-orange-400 to-red-500', 
          text: 'Reconnecting...', 
          icon: '🟠',
          bg: 'bg-orange-500/20',
          border: 'border-orange-400/30'
        };
      case 'disconnected':
        return { 
          color: 'from-red-400 to-pink-500', 
          text: 'Disconnected', 
          icon: '🔴',
          bg: 'bg-red-500/20',
          border: 'border-red-400/30'
        };
      case 'error':
        return { 
          color: 'from-red-500 to-red-600', 
          text: 'Connection Error', 
          icon: '❌',
          bg: 'bg-red-500/20',
          border: 'border-red-400/30'
        };
      default:
        return { 
          color: 'from-gray-400 to-gray-500', 
          text: 'Unknown', 
          icon: '⚪',
          bg: 'bg-gray-500/20',
          border: 'border-gray-400/30'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      className={`glass px-6 py-3 rounded-full ${config.bg} ${config.border} backdrop-blur-lg`}
    >
      <div className="flex items-center space-x-3">
        <motion.span
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-xl"
        >
          {config.icon}
        </motion.span>
        <span className="font-semibold text-white">{config.text}</span>
        <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${config.color} animate-pulse`} />
      </div>
    </motion.div>
  );
};

// Modern Stats Card with Animations
const ModernStatsCard = ({ title, value, subtitle, color, icon, gradient }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ duration: 0.3 }}
      className="glass-card group relative overflow-hidden"
    >
      {/* Animated Background Gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-5 group-hover:opacity-10 transition-opacity duration-300`} />
      
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-white/70 mb-1">{title}</p>
          <motion.p
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-bold text-white mb-1"
          >
            {value}
          </motion.p>
          <p className="text-xs text-white/50">{subtitle}</p>
        </div>
        
        <motion.div
          whileHover={{ rotate: 360 }}
          transition={{ duration: 0.6 }}
          className={`w-16 h-16 bg-gradient-to-br ${gradient} rounded-2xl flex items-center justify-center text-2xl shadow-lg`}
        >
          {icon}
        </motion.div>
      </div>

      {/* Animated Border */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </motion.div>
  );
};

// Enhanced Attendance Log Entry with Animations
const AttendanceLogEntry = ({ entry, index }) => {
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getRiskConfig = (riskLevel) => {
    switch (riskLevel) {
      case 'low': 
        return { 
          color: 'from-green-400 to-emerald-500', 
          bg: 'bg-green-500/10',
          text: 'text-green-400',
          border: 'border-green-400/30'
        };
      case 'medium': 
        return { 
          color: 'from-yellow-400 to-orange-500', 
          bg: 'bg-yellow-500/10',
          text: 'text-yellow-400',
          border: 'border-yellow-400/30'
        };
      case 'high': 
        return { 
          color: 'from-orange-400 to-red-500', 
          bg: 'bg-orange-500/10',
          text: 'text-orange-400',
          border: 'border-orange-400/30'
        };
      case 'critical': 
        return { 
          color: 'from-red-500 to-pink-500', 
          bg: 'bg-red-500/10',
          text: 'text-red-400',
          border: 'border-red-400/30'
        };
      default: 
        return { 
          color: 'from-gray-400 to-gray-500', 
          bg: 'bg-gray-500/10',
          text: 'text-gray-400',
          border: 'border-gray-400/30'
        };
    }
  };

  const riskConfig = getRiskConfig(entry.riskLevel);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ scale: 1.02 }}
      className={`glass p-4 rounded-xl ${riskConfig.bg} border ${riskConfig.border} group hover:shadow-lg transition-all duration-300`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <p className="font-semibold text-white">{entry.studentName}</p>
          </div>
          <p className="text-sm text-white/60">
            {formatTime(entry.timestamp)} • 
            <span className="capitalize ml-1 font-medium">{entry.method}</span>
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2 }}
            className={`px-3 py-1 rounded-full bg-gradient-to-r ${riskConfig.color} text-white text-sm font-semibold shadow-lg`}
          >
            {entry.securityScore}%
          </motion.div>
          
          {entry.flags.length > 0 && (
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-3 h-3 bg-orange-400 rounded-full shadow-lg"
              title={`${entry.flags.length} security flags`}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
};

// Enhanced Security Alert Item
const SecurityAlertItem = ({ alert, index }) => {
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getSeverityConfig = (severity) => {
    switch (severity) {
      case 'low': 
        return { 
          color: 'from-blue-400 to-cyan-500', 
          bg: 'bg-blue-500/10',
          border: 'border-blue-400/30',
          icon: '🔵'
        };
      case 'medium': 
        return { 
          color: 'from-yellow-400 to-orange-500', 
          bg: 'bg-yellow-500/10',
          border: 'border-yellow-400/30',
          icon: '🟡'
        };
      case 'high': 
        return { 
          color: 'from-orange-400 to-red-500', 
          bg: 'bg-orange-500/10',
          border: 'border-orange-400/30',
          icon: '🟠'
        };
      case 'critical': 
        return { 
          color: 'from-red-500 to-pink-500', 
          bg: 'bg-red-500/10',
          border: 'border-red-400/30',
          icon: '🔴'
        };
      default: 
        return { 
          color: 'from-gray-400 to-gray-500', 
          bg: 'bg-gray-500/10',
          border: 'border-gray-400/30',
          icon: '⚪'
        };
    }
  };

  const severityConfig = getSeverityConfig(alert.severity);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ scale: 1.02 }}
      className={`glass p-4 rounded-xl ${severityConfig.bg} border-l-4 border-gradient-to-b ${severityConfig.color} relative overflow-hidden group`}
    >
      {/* Animated Severity Indicator */}
      <div className={`absolute top-0 right-0 w-12 h-12 bg-gradient-to-br ${severityConfig.color} opacity-20 rounded-bl-xl`} />
      
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <motion.span
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {severityConfig.icon}
            </motion.span>
            <p className="font-semibold text-white capitalize">{alert.type.replace('_', ' ')}</p>
          </div>
          <p className="text-sm text-white/60 mb-1">Student ID: {alert.studentId}</p>
          <p className="text-xs text-white/50">{formatTime(alert.timestamp)}</p>
        </div>
        
        <motion.div
          className={`px-3 py-1 rounded-full bg-gradient-to-r ${severityConfig.color} text-white text-xs font-semibold uppercase tracking-wide`}
          whileHover={{ scale: 1.05 }}
        >
          {alert.severity}
        </motion.div>
      </div>
    </motion.div>
  );
};

// Enhanced Analytics Charts with Modern Design
const RealTimeAnalyticsCharts = ({ data }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="glass-card"
      >
        <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
          <span className="mr-3">📊</span>
          Attendance Timeline
        </h3>
        <div className="h-64 flex items-center justify-center bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-xl border border-white/10">
          <div className="text-center">
            <div className="text-4xl mb-4">📈</div>
            <p className="text-white/60">Real-time chart integration</p>
            <p className="text-white/40 text-sm">Chart.js / Recharts visualization</p>
          </div>
        </div>
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="glass-card"
      >
        <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
          <span className="mr-3">🎯</span>
          Method Distribution
        </h3>
        <div className="space-y-4">
          {Object.entries(data.methods?.distribution || {}).map(([method, count], index) => {
            const maxCount = Math.max(...Object.values(data.methods?.distribution || {}));
            const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
            
            return (
              <motion.div
                key={method}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="capitalize text-white font-medium">{method}</span>
                  <span className="text-white/60 font-semibold">{count}</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 1, delay: index * 0.2 }}
                    className="h-full bg-gradient-to-r from-blue-400 to-purple-500 rounded-full relative"
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
                  </motion.div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};

export default RealTimeTeacherDashboard;
