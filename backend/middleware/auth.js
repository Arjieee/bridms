import { verifyToken } from '../utils/jwt.js';
import { prisma } from '../db/prisma.js';

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ ok: false, message: 'Unauthorized: Access token missing' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ ok: false, message: 'Unauthorized: Invalid or expired token' });
    }

    const user = await prisma.account.findFirst({
      where: { id: decoded.id, is_active: true },
    });

    if (!user) {
      return res.status(401).json({ ok: false, message: 'Unauthorized: User account inactive or not found' });
    }

    // Single Session Verification: Invalidate older tokens when a new login occurs
    if (user.active_session_id && decoded.sessionId && user.active_session_id !== decoded.sessionId) {
      return res.status(401).json({
        ok: false,
        session_conflict: true,
        message: 'Your account was logged in from another device or window. For security, your previous session has ended.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Error in requireAuth middleware:', err);
    return res.status(500).json({ ok: false, message: 'Authentication verification failed.' });
  }
};
