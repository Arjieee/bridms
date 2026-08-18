/**
 * In-Memory Rate Limiter & Brute-Force Protection Middleware
 */

const loginAttempts = new Map(); // key -> { count, firstAttempt, lockedUntil }
const otpAttempts = new Map();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_LOGINS = 5;       // 5 failed attempts before 15 min lock
const MAX_OTP_REQUESTS = 5;        // 5 OTP requests per 15 mins

// Clean up stale entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of loginAttempts.entries()) {
    if (now - record.firstAttempt > WINDOW_MS && (!record.lockedUntil || now > record.lockedUntil)) {
      loginAttempts.delete(key);
    }
  }
  for (const [key, record] of otpAttempts.entries()) {
    if (now - record.firstAttempt > WINDOW_MS && (!record.lockedUntil || now > record.lockedUntil)) {
      otpAttempts.delete(key);
    }
  }
}, 5 * 60 * 1000);

export const loginBruteForceLimiter = (req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const username = (req.body.username || '').toLowerCase().trim();
  const key = `${ip}:${username || 'anonymous'}`;

  const now = Date.now();
  const record = loginAttempts.get(key);

  if (record) {
    if (record.lockedUntil && now < record.lockedUntil) {
      const remainingMinutes = Math.ceil((record.lockedUntil - now) / (60 * 1000));
      return res.status(429).json({
        ok: false,
        rate_limited: true,
        message: `Too many failed login attempts. Account temporarily locked for ${remainingMinutes} minute(s) for security.`,
      });
    }

    if (now - record.firstAttempt > WINDOW_MS) {
      loginAttempts.delete(key);
    }
  }

  // Attach helpers to response
  res.recordFailedLogin = () => {
    const rec = loginAttempts.get(key) || { count: 0, firstAttempt: now, lockedUntil: null };
    rec.count += 1;
    if (rec.count >= MAX_FAILED_LOGINS) {
      rec.lockedUntil = now + WINDOW_MS;
    }
    loginAttempts.set(key, rec);
  };

  res.clearFailedLogin = () => {
    loginAttempts.delete(key);
  };

  next();
};

export const otpRateLimiter = (req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const target = (req.body.email || req.body.username || '').toLowerCase().trim();
  const key = `${ip}:${target || 'otp'}`;

  const now = Date.now();
  const record = otpAttempts.get(key);

  if (record) {
    if (record.lockedUntil && now < record.lockedUntil) {
      const remainingMinutes = Math.ceil((record.lockedUntil - now) / (60 * 1000));
      return res.status(429).json({
        ok: false,
        message: `Too many verification requests. Please wait ${remainingMinutes} minute(s) before trying again.`,
      });
    }

    if (now - record.firstAttempt > WINDOW_MS) {
      otpAttempts.delete(key);
    } else if (record.count >= MAX_OTP_REQUESTS) {
      record.lockedUntil = now + WINDOW_MS;
      otpAttempts.set(key, record);
      return res.status(429).json({
        ok: false,
        message: 'Too many verification code requests. Please wait 15 minutes before requesting again.',
      });
    }
  }

  const rec = otpAttempts.get(key) || { count: 0, firstAttempt: now, lockedUntil: null };
  rec.count += 1;
  otpAttempts.set(key, rec);

  next();
};
