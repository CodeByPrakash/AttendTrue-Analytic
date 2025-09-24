import dbConnect from '../../../lib/couchdb';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { firstName, lastName, email, password, instituteId, department, studentId, phone } = req.body;

  if (!firstName || !lastName || !email || !password || !instituteId) {
    return res.status(400).json({ message: 'Missing required fields (firstName, lastName, email, password, instituteId)' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' });
  }

  try {
    const nano = await dbConnect();
    const db = nano.db.use('smartattend');
    const userId = `user:${email}`;

    try {
      await db.get(userId);
      return res.status(409).json({ message: 'User with this email already exists' });
    } catch (error) {
      if (error.statusCode !== 404) throw error;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Validate instituteId: must match an existing admin's institute
    const admins = await db.find({ selector: { type: 'user', role: 'admin', instituteId } });
    if (!admins.docs || admins.docs.length === 0) {
      return res.status(400).json({ message: 'Invalid institute ID. Please contact your administrator.' });
    }
    const name = `${firstName} ${lastName}`.trim();

    const studentDoc = {
      _id: userId,
      type: 'user',
      role: 'student',
      firstName,
      lastName,
      name,
      email,
      password: hashedPassword,
      onboardingComplete: false,
      approvalStatus: 'pending', // Requires admin approval
      isApproved: false,
      registeredAt: new Date().toISOString(),
      courses: [],
      profile: {
        phone: phone || '',
        imageUrl: ''
      },
      academic: {
        department: department || '',
        studentId: studentId || '',
        rollNo: '',
        registrationNo: '',
        section: '',
        branch: ''
      },
      biometrics: {
        faceDescriptor: null
      },
      profileImageUrl: '',
      instituteId
    };

    await db.insert(studentDoc);

    res.status(201).json({ 
      message: 'Student registration submitted successfully. Please wait for admin approval.',
      status: 'pending'
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
