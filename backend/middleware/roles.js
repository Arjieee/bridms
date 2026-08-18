export const requireRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, message: 'Unauthorized: Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ ok: false, message: `Forbidden: Access restricted to roles: ${allowedRoles.join(', ')}` });
    }

    next();
  };
};
