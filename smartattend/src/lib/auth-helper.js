import { getSession } from 'next-auth/react';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../pages/api/auth/[...nextauth]';
import dbConnect from './couchdb';

/**
 * A unified helper function to get the authenticated user's full profile 
 * from CouchDB using NextAuth session.
 * To be used in getServerSideProps and API routes.
 * @param {object} context - The context object from getServerSideProps or an object with { req, res }.
 * @returns {object|null} - The user document from CouchDB or null if not found/authenticated.
 */
export async function getAuthenticatedUser(context) {
  const nano = await dbConnect();
  const db = nano.db.use('smartattend');

  let session;
  
  // Prefer server-side session whenever a req exists (API routes/SSR); derive res if omitted
  if (context && context.req) {
    const req = context.req;
    const res = context.res || req.res || undefined;
    session = await getServerSession(req, res, authOptions);
    // Fallback to client session only if server session couldn't be obtained
    if (!session) {
      session = await getSession({ req });
    }
  } else {
    // Pure client-side usage
    session = await getSession();
  }

  if (session && session.user && session.user.email) {
    try {
      const userId = `user:${session.user.email}`;
      const user = await db.get(userId);
      
      // Check if student is approved
      if (user.role === 'student' && user.approvalStatus !== 'approved') {
        return null; // Student not approved yet
      }
      
      return user;
    } catch (error) {
      if (error.statusCode !== 404) console.error("Auth helper error:", error);
      return null; 
    }
  }

  return null;
}