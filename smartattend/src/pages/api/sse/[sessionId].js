// src/pages/api/sse/[sessionId].js

/**
 * Server-Sent Events endpoint for real-time updates
 * Fallback for browsers that don't support WebSocket
 */

import { sseManager } from '../../../utils/realTimeUpdates';
import { getAuthenticatedUser } from '../../../lib/auth-helper';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Authenticate user
  const user = await getAuthenticatedUser({ req });
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { sessionId } = req.query;
  const clientId = `${user._id}:${sessionId}:${Date.now()}`;

  if (!sessionId) {
    return res.status(400).json({ message: 'Session ID required' });
  }

  try {
    // Setup SSE connection
    sseManager.addClient(req, res, clientId);
    
    console.log(`SSE client connected: ${clientId} for session ${sessionId}`);
    
  } catch (error) {
    console.error('SSE connection error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
