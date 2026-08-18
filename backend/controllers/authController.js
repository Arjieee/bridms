import bcrypt from 'bcryptjs';
import { generateToken } from '../utils/jwt.js';
import { shortId } from '../utils/qr.js';
import { prisma } from '../db/prisma.js';
import { addActivityLog, notifyAdmins, parseJSONField } from '../services/dbHelper.js';
import { sendEmailOTP, sendEmailVerificationToken } from '../utils/email.js';
import { parseUserAgent } from '../utils/deviceInfo.js';

export const login = async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const userAgentString = req.headers['user-agent'] || '';
    const deviceInfo = parseUserAgent(userAgentString);

    if (!username || !password || !role) {
      return res.status(400).json({ ok: false, message: 'Username, password, and role are required.' });
    }

    const account = await prisma.account.findFirst({
      where: {
        username: username.trim(),
        role: role.trim(),
        is_active: true,
      },
    });

    if (!account) {
      if (res.recordFailedLogin) res.recordFailedLogin();
      await addActivityLog({
        username,
        role,
        action: 'failed_login_attempt',
        details: 'Account not found or inactive',
        ip_address: ip,
        user_agent: userAgentString,
      });
      return res.status(401).json({ ok: false, message: 'Invalid credentials or inactive account.' });
    }

    const isValidPassword = bcrypt.compareSync(password, account.password);
    if (!isValidPassword) {
      if (res.recordFailedLogin) res.recordFailedLogin();
      await addActivityLog({
        account_id: account.id,
        username: account.username,
        role: account.role,
        action: 'failed_login_attempt',
        details: 'Incorrect password entered',
        ip_address: ip,
        user_agent: userAgentString,
      });
      return res.status(401).json({ ok: false, message: 'Invalid credentials or inactive account.' });
    }

    // Clear failed login counter on success
    if (res.clearFailedLogin) res.clearFailedLogin();

    // Generate unique session ID for Single Session Login enforcement
    const sessionId = 'sess_' + shortId() + '_' + Date.now();
    const sessionData = {
      session_id: sessionId,
      login_at: new Date().toISOString(),
      ip_address: ip,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      device_type: deviceInfo.deviceType,
      user_agent: userAgentString,
    };

    const updatedAccount = await prisma.account.update({
      where: { id: account.id },
      data: {
        active_session_id: sessionId,
        last_login_at: new Date().toISOString(),
        current_session: JSON.stringify(sessionData),
      },
    });

    const token = generateToken({
      id: updatedAccount.id,
      username: updatedAccount.username,
      role: updatedAccount.role,
      sessionId,
    });

    await addActivityLog({
      account_id: updatedAccount.id,
      username: updatedAccount.username,
      role: updatedAccount.role,
      action: 'login',
      details: `Login successful via ${deviceInfo.browser} on ${deviceInfo.os} (${deviceInfo.deviceType})`,
      ip_address: ip,
      user_agent: userAgentString,
    });

    const { password: _, ...userWithoutPassword } = updatedAccount;

    return res.json({
      ok: true,
      token,
      user: {
        ...userWithoutPassword,
        current_session: sessionData,
      },
    });
  } catch (err) {
    console.error('Error in login controller:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error during login.' });
  }
};

export const logout = async (req, res) => {
  try {
    if (req.user) {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
      const userAgentString = req.headers['user-agent'] || '';

      await prisma.account.update({
        where: { id: req.user.id },
        data: {
          active_session_id: null,
          current_session: null,
        },
      });

      await addActivityLog({
        account_id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        action: 'logout',
        details: 'User logged out',
        ip_address: ip,
        user_agent: userAgentString,
      });
    }
    return res.json({ ok: true, message: 'Logged out successfully.' });
  } catch (err) {
    console.error('Error in logout controller:', err);
    return res.status(500).json({ ok: false, message: 'Logout failed.' });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { username, email } = req.body;

    if (!username || !email) {
      return res.status(400).json({ ok: false, message: 'Username and registered email/phone number are required.' });
    }

    const cleanInput = email.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase();

    const accounts = await prisma.account.findMany();
    const account = accounts.find((a) => {
      const isUserMatch = a.username?.trim().toLowerCase() === cleanUsername;
      const isEmailMatch = a.email && a.email.trim().toLowerCase() === cleanInput;
      const isPhoneMatch = a.contact && a.contact.trim() === email.trim();
      return isUserMatch && (isEmailMatch || isPhoneMatch);
    });

    if (!account) {
      return res.status(404).json({ ok: false, message: 'No account matches that username and registered email/phone.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const id = 'rst-' + shortId();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 mins

    await prisma.passwordReset.create({
      data: {
        id,
        account_id: account.id,
        username: account.username,
        email: account.email || account.contact,
        otp,
        used: false,
        expires_at: expiresAt,
      },
    });

    await notifyAdmins({
      type: 'registration',
      title: 'Password Reset Requested',
      message: `${account.full_name} (@${account.username}) requested a password reset.`,
      link: '/admin/settings',
    });

    if (account.email) {
      sendEmailOTP(account.email, account.full_name, otp).catch((err) => console.error(err));
    }

    return res.json({
      ok: true,
      message: 'A 6-digit verification code has been dispatched to your registered email/phone number.',
      otp,
    });
  } catch (err) {
    console.error('Error in forgotPassword controller:', err);
    return res.status(500).json({ ok: false, message: 'Failed to process password reset request.' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { username, otp, newPassword } = req.body;

    if (!username || !otp || !newPassword) {
      return res.status(400).json({ ok: false, message: 'Username, OTP, and new password are required.' });
    }

    const reset = await prisma.passwordReset.findFirst({
      where: {
        username: username.trim(),
        otp: otp.trim(),
        used: false,
      },
      orderBy: { created_at: 'desc' },
    });

    if (!reset || new Date(reset.expires_at) <= new Date()) {
      return res.status(400).json({ ok: false, message: 'Invalid or expired reset code.' });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);

    await prisma.$transaction([
      prisma.account.update({
        where: { id: reset.account_id },
        data: { password: hashedPassword },
      }),
      prisma.passwordReset.update({
        where: { id: reset.id },
        data: {
          used: true,
          used_at: new Date().toISOString(),
        },
      }),
    ]);

    return res.json({
      ok: true,
      message: 'Password reset successfully. You may now log in with your new password.',
    });
  } catch (err) {
    console.error('Error in resetPassword controller:', err);
    return res.status(500).json({ ok: false, message: 'Failed to reset password.' });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { email, token, registrationId } = req.body;

    if (!token) {
      return res.status(400).json({ ok: false, message: 'Verification code is required.' });
    }

    const cleanEmail = email?.trim().toLowerCase();

    // 1. Look in pending registrations
    const pendingRegs = await prisma.pendingRegistration.findMany({
      where: { status: 'pending' },
    });

    const reg = pendingRegs.find((r) => {
      const headData = parseJSONField(r.head_data, {});
      const isEmailMatch = cleanEmail && headData?.email?.trim().toLowerCase() === cleanEmail;
      const isIdMatch = registrationId && r.id === registrationId;
      return (isEmailMatch || isIdMatch) && r.email_verification_token === token;
    });

    if (reg) {
      if (reg.email_verification_expires_at && new Date(reg.email_verification_expires_at) < new Date()) {
        return res.status(400).json({ ok: false, message: 'Verification code has expired. Please request a new code.' });
      }

      await prisma.pendingRegistration.update({
        where: { id: reg.id },
        data: { is_email_verified: true },
      });

      return res.json({
        ok: true,
        message: 'Email verified successfully! Admin approval is now pending.',
      });
    }

    // 2. Look in accounts
    const acc = await prisma.account.findFirst({
      where: {
        email: cleanEmail,
        email_verification_token: token,
      },
    });

    if (acc) {
      if (acc.email_verification_expires_at && new Date(acc.email_verification_expires_at) < new Date()) {
        return res.status(400).json({ ok: false, message: 'Verification code has expired. Please request a new code.' });
      }

      await prisma.account.update({
        where: { id: acc.id },
        data: { is_email_verified: true },
      });

      return res.json({
        ok: true,
        message: 'Email verified successfully!',
      });
    }

    return res.status(400).json({ ok: false, message: 'Invalid verification code or email address.' });
  } catch (err) {
    console.error('Error in verifyEmail controller:', err);
    return res.status(500).json({ ok: false, message: 'Email verification failed.' });
  }
};

export const resendVerificationToken = async (req, res) => {
  try {
    const { email, registrationId } = req.body;

    if (!email && !registrationId) {
      return res.status(400).json({ ok: false, message: 'Email address or Registration ID is required.' });
    }

    const cleanEmail = email?.trim().toLowerCase();

    const pendingRegs = await prisma.pendingRegistration.findMany();
    const reg = pendingRegs.find((r) => {
      const headData = parseJSONField(r.head_data, {});
      const isEmailMatch = cleanEmail && headData?.email?.trim().toLowerCase() === cleanEmail;
      const isIdMatch = registrationId && r.id === registrationId;
      return isEmailMatch || isIdMatch;
    });

    const regHead = reg ? parseJSONField(reg.head_data, {}) : null;
    const targetEmail = regHead?.email || cleanEmail;
    const targetName = regHead ? `${regHead.fname} ${regHead.lname}` : 'Resident';

    if (!targetEmail) {
      return res.status(404).json({ ok: false, message: 'No registration or account found matching that email.' });
    }

    const newToken = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    if (reg) {
      await prisma.pendingRegistration.update({
        where: { id: reg.id },
        data: {
          email_verification_token: newToken,
          email_verification_expires_at: tokenExpiresAt,
        },
      });
    }

    const acc = await prisma.account.findFirst({
      where: { email: targetEmail },
    });

    if (acc) {
      await prisma.account.update({
        where: { id: acc.id },
        data: {
          email_verification_token: newToken,
          email_verification_expires_at: tokenExpiresAt,
        },
      });
    }

    await sendEmailVerificationToken(targetEmail, targetName, newToken).catch((err) =>
      console.error('Failed to resend verification email:', err)
    );

    return res.json({
      ok: true,
      message: 'A new 6-digit verification code has been sent to your email.',
      token: newToken,
    });
  } catch (err) {
    console.error('Error in resendVerificationToken controller:', err);
    return res.status(500).json({ ok: false, message: 'Failed to resend verification token.' });
  }
};
