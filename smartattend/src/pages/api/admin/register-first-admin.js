import dbConnect from '../../../lib/couchdb';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Simple security check - only allow if no admin exists yet
  try {
    const nano = await dbConnect();
    const db = nano.db.use('smartattend');
    
    // Check if any admin already exists
    const existingAdmins = await db.find({
      selector: {
        type: 'user',
        role: 'admin'
      }
    });

    if (existingAdmins.docs.length > 0) {
      return res.status(403).json({ 
        message: 'Admin account already exists. Contact existing admin for additional accounts.' 
      });
    }

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    const userId = `user:${email}`;

    try {
      await db.get(userId);
      return res.status(409).json({ message: 'User with this email already exists' });
    } catch (error) {
      if (error.statusCode !== 404) throw error;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const adminDoc = {
      _id: userId,
      type: 'user',
      role: 'admin',
      name,
      email,
      password: hashedPassword,
      isApproved: true,
      approvalStatus: 'approved',
      registeredAt: new Date().toISOString(),
      courses: [],
      faceDescriptor: null,
      profileImageUrl: ''
    };

    await db.insert(adminDoc);

    res.status(201).json({ 
      message: 'Admin account created successfully. You can now log in.',
      admin: {
        id: adminDoc._id,
        name: adminDoc.name,
        email: adminDoc.email,
        role: adminDoc.role
      }
    });

  } catch (error) {
    console.error('Admin registration error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}