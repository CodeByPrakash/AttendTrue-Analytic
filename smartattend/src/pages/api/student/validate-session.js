import dbConnect from '../../../lib/couchdb';
import { getApiAuthenticatedUser } from '../../../lib/api-helper';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Use server-side session to authenticate the student reliably
  const user = await getApiAuthenticatedUser(req, res, { allowUnapproved: true });
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized: Please sign in again.' });
  }
  if (user.role !== 'student') {
    return res.status(403).json({ message: 'Access denied: Students only.' });
  }
  if (user.approvalStatus && user.approvalStatus !== 'approved') {
    return res.status(403).json({ message: 'Your account is pending admin approval.' });
  }

  const { sessionKey } = req.body;
  if (!sessionKey) {
    return res.status(400).json({ message: 'Session key is required.' });
  }

  try {
    const nano = await dbConnect();
    const db = nano.db.use('smartattend');

    // Check if a session with this ID exists
    const sessionDoc = await db.get(sessionKey);

    // Check if the session is currently active
    if (sessionDoc.status !== 'active') {
      return res.status(403).json({ message: 'This session is not currently active.' });
    }

    // Check if the session has expired
    const now = new Date();
    if (new Date(sessionDoc.endTime) < now) {
      // Optional: You could also update the session status to 'closed' here
      return res.status(403).json({ message: 'This session has expired.' });
    }

    // If all checks pass, the session is valid
    res.status(200).json({ message: 'Session is valid.' });

  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ message: 'Invalid session code.' });
    }
    console.error('Session validation error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
