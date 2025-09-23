import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import dbConnect from '../../../lib/couchdb';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method Not Allowed' });
  const { courseId } = req.query;
  if (!courseId) return res.status(400).json({ message: 'courseId required' });

  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  try {
    const nano = await dbConnect();
    const db = nano.db.use('smartattend');
    const courseDoc = await db.get(courseId);
    if (!courseDoc || courseDoc.type !== 'course') return res.status(404).json({ message: 'Course not found' });
    if (session.user.role !== 'superadmin') {
      const adminDoc = await db.get(session.user.id).catch(() => null);
      const instituteId = adminDoc?.instituteId || '';
      if ((courseDoc.instituteId || '') !== instituteId) return res.status(403).json({ message: 'Forbidden' });
    }
    const roster = courseDoc.students || [];
    if (!roster.length) return res.status(200).json({ items: [] });
    const docs = await Promise.all(roster.map(id => db.get(id).catch(() => null)));
    const items = docs.filter(Boolean).map(s => ({ _id: s._id, name: s.name || s.email, email: s.email }));
    return res.status(200).json({ items });
  } catch (error) {
    console.error('Admin course students error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
