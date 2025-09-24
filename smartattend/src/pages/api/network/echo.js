export default function handler(req, res) {
  try {
    const fwd = req.headers['x-forwarded-for'];
    const ip = Array.isArray(fwd) ? fwd[0] : (fwd?.split(',')[0] || req.socket?.remoteAddress || '');
    return res.status(200).json({ ip });
  } catch (e) {
    return res.status(200).json({ ip: '' });
  }
}
