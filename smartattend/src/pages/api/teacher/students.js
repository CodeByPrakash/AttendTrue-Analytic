import dbConnect from '../../../lib/couchdb';
import { getApiAuthenticatedUser } from '../../../lib/api-helper';

export default async function handler(req, res) {
  const me = await getApiAuthenticatedUser(req, res);
  if (!me || me.role !== 'teacher') {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { branch = '', search = '', courseId = '' } = req.query;

  try {
    const nano = await dbConnect();
    const db = nano.db.use('smartattend');

    let students = [];
    let rosterIds = null;
    if (courseId) {
      try {
        const courseDoc = await db.get(courseId);
        if (courseDoc && courseDoc.type === 'course' && courseDoc.teacherId === me._id) {
          rosterIds = new Set(courseDoc.students || []);
        } else {
          return res.status(403).json({ message: 'Forbidden' });
        }
      } catch (e) {
        return res.status(404).json({ message: 'Course not found' });
      }
    }
    try {
      const selector = { type: 'user', role: 'student', instituteId: me.instituteId || '' };
      if (branch) selector['academic.branch'] = branch;
      const result = await db.find({ selector, limit: 10000 });
      students = result.docs || [];
    } catch (err) {
      const all = await db.list({ include_docs: true });
      students = all.rows.map(r => r.doc).filter(d => d && d.type === 'user' && d.role === 'student' && (d.instituteId === (me.instituteId || '')) && (!branch || (d.academic && d.academic.branch === branch)));
    }

    // If courseId filter applied, restrict to roster
    if (rosterIds) {
      students = students.filter(s => rosterIds.has(s._id));
    }

    const q = (search || '').toString().trim().toLowerCase();
    if (q) {
      students = students.filter(s => [s.name, s.email, s.academic?.rollNo, s.academic?.registrationNo].filter(Boolean).some(v => v.toString().toLowerCase().includes(q)));
    }

    const items = students.map(s => ({
      _id: s._id,
      name: s.name,
      email: s.email,
      branch: s.academic?.branch || '',
      section: s.academic?.section || '',
      rollNo: s.academic?.rollNo || '',
      approvalStatus: s.approvalStatus || 'pending',
      isActive: s.isActive !== false,
      profileImageUrl: s.profile?.imageUrl || ''
    }));

    return res.status(200).json({ items });
  } catch (error) {
    console.error('Teacher list students error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
