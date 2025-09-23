import dbConnect from '../../../lib/couchdb';
import bcrypt from 'bcryptjs';
import { getApiAuthenticatedUser } from '../../../lib/api-helper';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Server-side auth: ensure the caller is an authenticated admin
  const me = await getApiAuthenticatedUser(req, res);
  if (!me || (me.role !== 'admin' && me.role !== 'superadmin')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { name, email, password, instituteId } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Missing required fields: name, email, password' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' });
  }

  try {
    const nano = await dbConnect();
    const db = nano.db.use('smartattend'); // Assuming your database name is 'smartattend'
    const teacherId = `user:${email}`;

    // Check if teacher already exists
    try {
      await db.get(teacherId);
      return res.status(409).json({ message: 'Teacher with this email already exists' });
    } catch (error) {
      if (error.statusCode !== 404) {
        throw error; // Re-throw if it's not a 'not found' error
      }
      // If 404, the user does not exist, so we can proceed.
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Determine institute for teacher
    let targetInstituteId = me.instituteId || '';
    if (me.role === 'superadmin') {
      if (!instituteId) return res.status(400).json({ message: 'instituteId is required for superadmin' });
      // Validate institute exists (an admin with this instituteId)
      const admins = await db.find({ selector: { type: 'user', role: 'admin', instituteId } });
      if (!admins.docs || admins.docs.length === 0) {
        return res.status(400).json({ message: 'Invalid institute ID' });
      }
      targetInstituteId = instituteId;
    }

    const teacherDoc = {
      _id: teacherId,
      type: 'user',
      role: 'teacher',
      name,
      email,
      password: hashedPassword,
      registeredAt: new Date().toISOString(),
      approvalStatus: 'approved',
      isApproved: true,
      courses: [],
      profile: { imageUrl: '' },
      biometrics: {},
      // Multi-tenancy: admin inherits their own; superadmin must specify
      instituteId: targetInstituteId
    };

    const response = await db.insert(teacherDoc);

    res.status(201).json({ message: 'Teacher registered successfully', teacherId: response.id });

  } catch (error) {
    console.error('Teacher registration error:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}