import dbConnect from '../../../lib/couchdb';
import bcrypt from 'bcryptjs';
import { getApiAuthenticatedUser } from '../../../lib/api-helper';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const me = await getApiAuthenticatedUser(req, res, { allowUnapproved: true });
  if (!me || me.role !== 'superadmin') {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { name, email, password, instituteId } = req.body || {};
  if (!name || !email || !password || !instituteId) {
    return res.status(400).json({ message: 'Missing required fields: name, email, password, instituteId' });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long' });
  }

  try {
    const nano = await dbConnect();
    const db = nano.db.use('smartattend');
    const adminId = `user:${email}`;

    // Ensure uniqueness
    try {
      await db.get(adminId);
      return res.status(409).json({ message: 'User with this email already exists' });
    } catch (err) {
      if (err.statusCode !== 404) throw err;
    }

    const hashed = await bcrypt.hash(password, 12);
    const adminDoc = {
      _id: adminId,
      type: 'user',
      role: 'admin',
      name,
      email,
      password: hashed,
      instituteId,
      approvalStatus: 'approved',
      isApproved: true,
      registeredAt: new Date().toISOString(),
      courses: [],
      profile: { imageUrl: '' },
      biometrics: {}
    };

    await db.insert(adminDoc);
    return res.status(201).json({ message: 'Admin registered successfully', adminId });
  } catch (error) {
    console.error('Register admin error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
