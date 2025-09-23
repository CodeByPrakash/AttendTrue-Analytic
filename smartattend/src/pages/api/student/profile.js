import { getApiAuthenticatedUser } from '../../../lib/api-helper';
import dbConnect from '../../../lib/couchdb';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  const user = await getApiAuthenticatedUser(req, res, { allowUnapproved: true });

  if (!user || user.role !== 'student') {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const studentId = user._id;
  const nano = await dbConnect();
  const db = nano.db.use('smartattend');

  if (req.method === 'GET') {
    // ... (GET logic remains the same)
  }
  else if (req.method === 'POST') {
      const {
        address,
        phoneNumber,
        profileImageUrl,
        profileImageBase64,
        pendingFaceDescriptor,
        biometricPin,
        rollNo,
        registrationNo,
        section,
        branch
      } = req.body;

      try {
        const existingDoc = await db.get(studentId);

        const updatedDoc = {
          ...existingDoc,
          profile: {
            ...(existingDoc.profile || {}),
            address: address ?? ((existingDoc.profile && existingDoc.profile.address) || ''),
            phone: phoneNumber ?? ((existingDoc.profile && existingDoc.profile.phone) || ''),
            imageUrl: profileImageBase64 || profileImageUrl || (existingDoc.profile && existingDoc.profile.imageUrl) || ''
          },
          academic: {
            ...(existingDoc.academic || {}),
            rollNo: rollNo ?? ((existingDoc.academic && existingDoc.academic.rollNo) || ''),
            registrationNo: registrationNo ?? ((existingDoc.academic && existingDoc.academic.registrationNo) || ''),
            section: section ?? ((existingDoc.academic && existingDoc.academic.section) || ''),
            branch: branch ?? ((existingDoc.academic && existingDoc.academic.branch) || '')
          }
        };

        if (pendingFaceDescriptor && pendingFaceDescriptor.length > 0) {
          updatedDoc.biometrics = {
            ...(existingDoc.biometrics || {}),
            pendingFaceDescriptor,
          };
          updatedDoc.faceScanStatus = 'pending';
          updatedDoc.faceScanTimestamp = new Date().toISOString();
          delete updatedDoc.faceDescriptor;
        }

        if (biometricPin && typeof biometricPin === 'string') {
          const pin = biometricPin.trim();
          if (!/^\d{4,6}$/.test(pin)) {
            return res.status(400).json({ message: 'PIN must be 4-6 digits' });
          }
          const hashedPin = await bcrypt.hash(pin, 12);
          updatedDoc.biometrics = {
            ...(updatedDoc.biometrics || existingDoc.biometrics || {}),
            pinHash: hashedPin,
            pinSetAt: new Date().toISOString(),
          };
        }

        await db.insert(updatedDoc);
        res.status(200).json({ message: 'Profile updated successfully' });

      } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
        }
    // ...  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
}
