// src/pages/api/websocket.js

/**
 * WebSocket API endpoint for real-time updates
 * Handles WebSocket connections and real-time communication
 */

import { Server as SocketIOServer } from 'socket.io';
import { initializeWebSocketServer } from '../../utils/realTimeUpdates';

const SocketHandler = (req, res) => {
  if (res.socket.server.io) {
    console.log('WebSocket server already running');
    res.end();
    return;
  }

  console.log('Initializing WebSocket server...');
  const io = initializeWebSocketServer(res.socket.server);
  res.socket.server.io = io;

  res.end();
};

export default SocketHandler;
