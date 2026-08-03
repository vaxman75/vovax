import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  const token = (req.headers.authorization ?? '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
}
