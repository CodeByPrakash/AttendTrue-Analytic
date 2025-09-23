import dbConnect from '../../../../lib/couchdb';
import { getApiAuthenticatedUser } from '../../../../lib/api-helper';

export default async function handler(req, res) {
  const me = await getApiAuthenticatedUser(req, res, { allowUnapproved: true });
  if (!me || me.role !== 'superadmin') {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const nano = await dbConnect();
  const db = nano.db.use('smartattend');

  if (req.method === 'GET') {
    try {
      const { q = '' } = req.query;
      const term = String(q || '').trim().toLowerCase();
      const resp = await db.find({ selector: { type: 'institute' }, limit: 10000 });
      let items = (resp.docs || []).map(doc => ({ id: doc._id, code: doc.code, name: doc.name || '' }));
      if (term) {
        items = items.filter(i =>
          (i.code && i.code.toLowerCase().includes(term)) ||
          (i.name && i.name.toLowerCase().includes(term))
        );
      }
      // sort by code
      items.sort((a,b) => (a.code||'').localeCompare(b.code||''));
      return res.status(200).json({ institutes: items });
    } catch (e) {
      console.error('GET institutes error', e);
      return res.status(500).json({ message: 'Failed to list institutes' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { code, name } = req.body || {};
      if (!code) return res.status(400).json({ message: 'code is required' });
      const clean = String(code).trim();
      const id = `institute:${clean}`;

      // Ensure uniqueness
      try {
        await db.get(id);
        return res.status(409).json({ message: 'Institute already exists' });
      } catch (err) {
        if (err.statusCode !== 404) throw err;
      }

      const doc = {
        _id: id,
        type: 'institute',
        code: clean,
        name: (name || '').trim(),
        createdAt: new Date().toISOString(),
      };
      await db.insert(doc);
      return res.status(201).json({ message: 'Institute created', id: doc._id });
    } catch (e) {
      console.error('POST institute error', e);
      return res.status(500).json({ message: 'Failed to create institute' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
}
