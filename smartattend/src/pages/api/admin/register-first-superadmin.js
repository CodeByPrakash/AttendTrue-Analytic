import dbConnect from '../../../lib/couchdb';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });
  try {
    const nano = await dbConnect();
    const db = nano.db.use('smartattend');
    const existing = await db.find({ selector: { type: 'user', role: 'superadmin' }, limit: 1 }).catch(async () => {
      const all = await db.list({ include_docs: true });
      return { docs: all.rows.map(r => r.doc).filter(d => d && d.type === 'user' && d.role === 'superadmin') };
    });
    if ((existing.docs?.length || 0) > 0) {
      return res.status(403).json({ message: 'Superadmin already exists' });
    }

    const { name, email, password } = req.body || {};
    if (!name || !email || !password || password.length < 10) return res.status(400).json({ message: 'Strong name/email/password required' });

    const id = `user:${email}`;
    try { await db.get(id); return res.status(409).json({ message: 'User with email exists' }); } catch (e) { if (e.statusCode !== 404) throw e; }

    const hashed = await bcrypt.hash(password, 12);
    const doc = {
      _id: id,
      type: 'user',
      role: 'superadmin',
      name,
      email,
      password: hashed,
      isApproved: true,
      approvalStatus: 'approved',
      registeredAt: new Date().toISOString(),
      instituteId: '__all__'
    };
    await db.insert(doc);
    return res.status(201).json({ message: 'Superadmin created', id });
  } catch (error) {
    console.error('Create superadmin error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
