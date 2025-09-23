import dbConnect from '../../../../lib/couchdb';
import { getApiAuthenticatedUser } from '../../../../lib/api-helper';

export default async function handler(req, res) {
  const me = await getApiAuthenticatedUser(req, res);
  if (!me || (me.role !== 'admin' && me.role !== 'superadmin')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  const { role, search = '', status, page = '1', limit = '20' } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  try {
    const nano = await dbConnect();
    const db = nano.db.use('smartattend');

    let users = [];
    try {
      // Prefer _find if available
      const selector = me.role === 'superadmin'
        ? { type: 'user' }
        : { type: 'user', instituteId: me.instituteId || '' };
      // Only allow role filter for allowed roles. Admins can only view 'student' and 'teacher'
      const requestedRole = (role || '').toString();
      if (requestedRole && (me.role === 'superadmin' || ['student', 'teacher'].includes(requestedRole))) {
        selector.role = requestedRole;
      }
      // We'll do text search client-side due to Mango limitations without indexes
      const result = await db.find({ selector, limit: 10000 });
      users = result.docs || [];
    } catch (err) {
      // Fallback to list
      const all = await db.list({ include_docs: true });
      users = all.rows
        .map(r => r.doc)
        .filter(d => {
          if (!d || d.type !== 'user') return false;
          if (me.role !== 'superadmin' && (d.instituteId || '') !== (me.instituteId || '')) return false;
          // Apply safe role filter
          const requestedRole = (role || '').toString();
          if (requestedRole) {
            if (me.role === 'superadmin') {
              if (d.role !== requestedRole) return false;
            } else {
              if (!['student', 'teacher'].includes(requestedRole)) return false;
              if (d.role !== requestedRole) return false;
            }
          }
          return true;
        });
    }

    // Additional role gating: if requester is not superadmin, hide any admins/superadmins entirely
    if (me.role !== 'superadmin') {
      users = users.filter(u => u.role === 'student' || u.role === 'teacher');
    }

    // Normalize and filter by search and status
    const q = (search || '').toString().trim().toLowerCase();
    const filtered = users.filter(u => {
      const isMatch = !q || [u.name, u.email, u.role, u.department, u.studentId]
        .filter(Boolean)
        .some(v => v.toString().toLowerCase().includes(q));

      let statusOk = true;
      if (status) {
        if (status === 'approved') statusOk = u.approvalStatus === 'approved' || u.role !== 'student';
        else if (status === 'pending') statusOk = u.approvalStatus === 'pending';
        else if (status === 'rejected') statusOk = u.approvalStatus === 'rejected';
        else if (status === 'inactive') statusOk = u.isActive === false;
      }
      return isMatch && statusOk;
    });

    // Sort by name asc
    filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const total = filtered.length;
    const start = (pageNum - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize).map(u => ({
      _id: u._id,
      email: u.email,
      name: u.name,
      role: u.role,
      approvalStatus: u.approvalStatus || (u.role === 'student' ? 'pending' : 'approved'),
      isActive: u.isActive !== false,
      profileImageUrl: (u.profile && u.profile.imageUrl) || u.profileImageUrl || '',
      registeredAt: u.registeredAt || null,
      department: u.department || (u.academic && u.academic.branch) || '',
      studentId: u.studentId || (u.academic && u.academic.rollNo) || ''
    }));

    return res.status(200).json({ total, page: pageNum, limit: pageSize, items });
  } catch (error) {
    console.error('Admin list users error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
