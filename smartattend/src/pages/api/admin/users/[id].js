import dbConnect from '../../../../lib/couchdb';
import { getApiAuthenticatedUser } from '../../../../lib/api-helper';

export default async function handler(req, res) {
  const me = await getApiAuthenticatedUser(req, res);
  if (!me || (me.role !== 'admin' && me.role !== 'superadmin')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { id } = req.query; // id should be full CouchDB _id like user:email
  if (!id) return res.status(400).json({ message: 'Missing id' });

  const nano = await dbConnect();
  const db = nano.db.use('smartattend');

  if (req.method === 'PATCH') {
    const { name, role, approvalStatus, isActive, profileImageUrl, department, instituteId } = req.body || {};
    try {
      const doc = await db.get(id);
  if (me.role !== 'superadmin' && (doc.instituteId || '') !== (me.instituteId || '')) return res.status(403).json({ message: 'Forbidden' });
      if (doc.type !== 'user') return res.status(400).json({ message: 'Not a user document' });
      // Non-superadmin cannot modify admin or superadmin accounts at all
      if (me.role !== 'superadmin' && (doc.role === 'admin' || doc.role === 'superadmin')) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      // Prevent demoting the only admin if it would leave no admins
      if (doc.role === 'admin' && role && role !== 'admin') {
        const admins = await db.find({ selector: { type: 'user', role: 'admin' }, fields: ['_id'] }).catch(async () => {
          const all = await db.list({ include_docs: true });
          return { docs: all.rows.map(r => r.doc).filter(d => d && d.type === 'user' && d.role === 'admin') };
        });
        const count = admins.docs?.length || 0;
        if (count <= 1) {
          return res.status(400).json({ message: 'Cannot demote the only admin' });
        }
      }

  const updated = { ...doc };
      if (typeof name === 'string') updated.name = name;
      // Only superadmin can change roles to/from admin/superadmin. Admins can only set role among student/teacher.
      if (role) {
        if (me.role === 'superadmin') {
          if (['student', 'teacher', 'admin', 'superadmin'].includes(role)) updated.role = role;
        } else {
          if (['student', 'teacher'].includes(role)) updated.role = role;
        }
      }
      if (approvalStatus && ['approved', 'pending', 'rejected'].includes(approvalStatus)) updated.approvalStatus = approvalStatus;
      if (typeof isActive === 'boolean') updated.isActive = isActive;
      if (profileImageUrl !== undefined) {
        updated.profile = { ...(updated.profile || {}), imageUrl: profileImageUrl || '' };
      }
      if (department !== undefined) {
        // store department as top-level or academic.branch depending on role
        if (updated.role === 'student') {
          updated.academic = { ...(updated.academic || {}), branch: department || '' };
        } else {
          updated.department = department || '';
        }
      }

      // InstituteId change rules: only superadmin can change, and only for student/teacher
      if (typeof instituteId === 'string') {
        if (me.role === 'superadmin' && (updated.role === 'student' || updated.role === 'teacher')) {
          updated.instituteId = instituteId;
        } else if (me.role !== 'superadmin') {
          // ignore silently; do not allow admin to change institute
        }
      }

      const resp = await db.insert(updated);
      return res.status(200).json({ message: 'Updated', id: resp.id, rev: resp.rev });
    } catch (error) {
      console.error('Admin update user error:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const doc = await db.get(id);
  if (me.role !== 'superadmin' && (doc.instituteId || '') !== (me.instituteId || '')) return res.status(403).json({ message: 'Forbidden' });
      if (doc.type !== 'user') return res.status(400).json({ message: 'Not a user document' });
      // Only superadmin can delete admins; never delete superadmin via this API
      if (doc.role === 'superadmin') return res.status(400).json({ message: 'Refusing to delete a superadmin via API' });
      if (doc.role === 'admin' && me.role !== 'superadmin') return res.status(403).json({ message: 'Forbidden' });
      const resp = await db.destroy(doc._id, doc._rev);
      return res.status(200).json({ message: 'Deleted', id: resp.id, rev: resp.rev });
    } catch (error) {
      console.error('Admin delete user error:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  res.setHeader('Allow', ['PATCH', 'DELETE']);
  return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
}
