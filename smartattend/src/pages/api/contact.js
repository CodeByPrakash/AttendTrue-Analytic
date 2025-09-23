export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const { name = '', email = '', institution = '', plan = '', message = '' } = req.body || {};

    // In a real app, forward to CRM/email. For now, just log.
    console.log('[CONTACT]', { name, email, institution, plan, message });

    return res.status(200).json({ ok: true, message: 'Thanks! We will reach out shortly.' });
  } catch (err) {
    console.error('CONTACT_ERROR', err);
    return res.status(500).json({ ok: false, error: 'Internal Server Error' });
  }
}
