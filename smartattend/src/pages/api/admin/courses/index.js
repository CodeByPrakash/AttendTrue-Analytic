import { getApiAuthenticatedUser } from '../../../../lib/api-helper';
import dbConnect from '../../../../lib/couchdb';

export default async function handler(req, res) {
  const me = await getApiAuthenticatedUser(req, res);
  if (!me || (me.role !== 'admin' && me.role !== 'superadmin')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const nano = await dbConnect();
  const db = nano.db.use('smartattend');

  if (req.method === 'GET') {
    try {
      const selector = { type: 'course' };
      if (me.role !== 'superadmin') selector.instituteId = me.instituteId || '';
      const result = await db.find({ selector, limit: 10000 });
      return res.status(200).json({ items: result.docs });
    } catch (error) {
      console.error('List courses error:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  if (req.method === 'POST') {
    const { name, code, teacherId, schedule = [] } = req.body || {};
    if (!name || !code || !teacherId) {
      return res.status(400).json({ message: 'name, code, and teacherId are required' });
    }
    try {
      const courseId = `course:${code}`;
      // Ensure teacher exists and is in same institute (unless superadmin)
      const teacherDoc = await db.get(teacherId).catch(() => null);
      if (!teacherDoc || teacherDoc.type !== 'user' || teacherDoc.role !== 'teacher') {
        return res.status(400).json({ message: 'Invalid teacherId' });
      }
      if (me.role !== 'superadmin' && (teacherDoc.instituteId || '') !== (me.instituteId || '')) {
        return res.status(403).json({ message: 'Teacher not in your institute' });
      }
      const doc = {
        _id: courseId,
        type: 'course',
        name,
        code,
        teacherId,
        students: [],
        schedule: Array.isArray(schedule) ? schedule : [],
        createdAt: new Date().toISOString(),
        instituteId: me.role === 'superadmin' ? (teacherDoc.instituteId || '') : (me.instituteId || '')
      };
      const resp = await db.insert(doc);
      return res.status(201).json({ message: 'Course created', id: resp.id, rev: resp.rev });
    } catch (error) {
      if (error.statusCode === 409) {
        return res.status(409).json({ message: 'Course code already exists' });
      }
      console.error('Create course error:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
}
