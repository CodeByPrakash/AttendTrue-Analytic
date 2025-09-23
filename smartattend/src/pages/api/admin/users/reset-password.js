import dbConnect from '../../../../lib/couchdb';
import { getApiAuthenticatedUser } from '../../../../lib/api-helper';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  const me = await getApiAuthenticatedUser(req, res);
  if (!me || (me.role !== 'admin' && me.role !== 'superadmin')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  const { id, newPassword } = req.body || {};
  if (!id || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ message: 'id and a strong newPassword (>= 8 chars) are required' });
  }

  try {
    const nano = await dbConnect();
    const db = nano.db.use('smartattend');
  const doc = await db.get(id);
  if (me.role !== 'superadmin' && (doc.instituteId || '') !== (me.instituteId || '')) return res.status(403).json({ message: 'Forbidden' });
    if (doc.type !== 'user') return res.status(400).json({ message: 'Not a user document' });
    // Non-superadmin cannot reset admin/superadmin passwords
    if (me.role !== 'superadmin' && (doc.role === 'admin' || doc.role === 'superadmin')) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    const resp = await db.insert({ ...doc, password: hashed });
    return res.status(200).json({ message: 'Password reset', id: resp.id, rev: resp.rev });
  } catch (error) {
    console.error('Admin reset password error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
