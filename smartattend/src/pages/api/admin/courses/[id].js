import { getApiAuthenticatedUser } from '../../../../lib/api-helper';
import dbConnect from '../../../../lib/couchdb';

export default async function handler(req, res) {
  const me = await getApiAuthenticatedUser(req, res);
  if (!me || (me.role !== 'admin' && me.role !== 'superadmin')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { id } = req.query; // course id e.g., course:CS101
  const nano = await dbConnect();
  const db = nano.db.use('smartattend');

  if (req.method === 'PATCH') {
    const { name, code, teacherId, schedule, students } = req.body || {};
    try {
      const doc = await db.get(id);
      if (doc.type !== 'course') return res.status(400).json({ message: 'Not a course document' });
      if (me.role !== 'superadmin' && (doc.instituteId || '') !== (me.instituteId || '')) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const updated = { ...doc };
      if (typeof name === 'string') updated.name = name;
      if (typeof code === 'string') updated.code = code;
      if (teacherId) {
        const teacherDoc = await db.get(teacherId).catch(() => null);
        if (!teacherDoc || teacherDoc.type !== 'user' || teacherDoc.role !== 'teacher') {
          return res.status(400).json({ message: 'Invalid teacherId' });
        }
        if (me.role !== 'superadmin' && (teacherDoc.instituteId || '') !== (me.instituteId || '')) {
          return res.status(403).json({ message: 'Teacher not in your institute' });
        }
        updated.teacherId = teacherId;
      }
      if (Array.isArray(schedule)) updated.schedule = schedule;
      if (Array.isArray(students)) updated.students = students;
      const resp = await db.insert(updated);
      return res.status(200).json({ message: 'Updated', id: resp.id, rev: resp.rev });
    } catch (error) {
      if (error.statusCode === 404) {
        return res.status(404).json({ message: 'Course not found' });
      }
      console.error('Update course error:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const doc = await db.get(id);
      if (doc.type !== 'course') return res.status(400).json({ message: 'Not a course document' });
      if (me.role !== 'superadmin' && (doc.instituteId || '') !== (me.instituteId || '')) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const resp = await db.destroy(doc._id, doc._rev);
      return res.status(200).json({ message: 'Deleted', id: resp.id, rev: resp.rev });
    } catch (error) {
      if (error.statusCode === 404) {
        return res.status(404).json({ message: 'Course not found' });
      }
      console.error('Delete course error:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  res.setHeader('Allow', ['PATCH', 'DELETE']);
  return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
}
