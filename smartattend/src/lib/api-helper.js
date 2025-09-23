import { getServerSession } from 'next-auth/next';
import { authOptions } from '../pages/api/auth/[...nextauth]';
import dbConnect from './couchdb';

/**
 * A dedicated, streamlined helper for API routes secured by NextAuth.
 * It validates the NextAuth session and fetches the full user document.
 * Also checks if student is approved.
 * @param {object} req - The Next.js API route request object.
 * @returns {object|null} - The full user document or null if unauthorized.
 */
export async function getApiAuthenticatedUser(req, resOrOptions, maybeOptions) {
  // Backward-compatible signature: (req, options?) OR (req, res, options?)
  let res = null;
  let options = { allowUnapproved: false };

  if (resOrOptions && typeof resOrOptions === 'object' && typeof resOrOptions.writeHead === 'function') {
    // Likely the 'res' object
    res = resOrOptions;
    options = { ...options, ...(maybeOptions || {}) };
  } else {
    // No res provided; treat second arg as options and try fallback to req.res
    res = req && req.res ? req.res : null;
    options = { ...options, ...(resOrOptions || {}) };
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user || !session.user.email) {
    return null; // No valid NextAuth session found
  }

  try {
    const nano = await dbConnect();
    const db = nano.db.use('smartattend');
    const userId = `user:${session.user.email}`;
    const user = await db.get(userId);
    
    // Check if student is approved unless explicitly allowed
    if (!options.allowUnapproved && user.role === 'student' && user.approvalStatus !== 'approved') {
      return null; // Student not approved yet
    }
    
    return user;
  } catch (error) {
    console.error("API Helper DB Error:", error);
    return null;
  }
}