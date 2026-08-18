import bcrypt from 'bcryptjs';
import { shortId } from '../utils/qr.js';
import { generateToken } from '../utils/jwt.js';
import { prisma } from '../db/prisma.js';
import { addActivityLog, parseJSONField } from '../services/dbHelper.js';
import { parseUserAgent } from '../utils/deviceInfo.js';

export const getAllAccounts = async (req, res) => {
  try {
    const accounts = await prisma.account.findMany({
      orderBy: { created_at: 'asc' },
    });

    const safeAccounts = accounts.map(({ password, ...a }) => ({
      ...a,
      current_session: parseJSONField(a.current_session, null),
    }));

    return res.json({ ok: true, accounts: safeAccounts });
  } catch (err) {
    console.error('Error fetching accounts:', err);
    return res.status(500).json({ ok: false, message: 'Failed to fetch accounts.' });
  }
};

export const createAccount = async (req, res) => {
  try {
    const { username, password, role, full_name, email, contact } = req.body;

    if (!username || !password || !role || !full_name) {
      return res.status(400).json({ ok: false, message: 'Username, password, role, and full_name are required.' });
    }

    const cleanUsername = username.trim();
    const existing = await prisma.account.findUnique({
      where: { username: cleanUsername },
    });

    if (existing) {
      return res.status(400).json({ ok: false, message: 'Username already taken.' });
    }

    const id = (role === 'staff' ? 'staff-' : 'acc-') + shortId();
    const hashedPassword = bcrypt.hashSync(password, 10);

    const newAccount = await prisma.account.create({
      data: {
        id,
        username: cleanUsername,
        password: hashedPassword,
        role,
        full_name,
        email: email || null,
        contact: contact || null,
        is_active: true,
        created_by: req.user.id,
      },
    });

    await addActivityLog({
      account_id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      action: 'account_created',
      details: `Created new ${role} account for "${full_name}" (@${cleanUsername})`,
    });

    const { password: _, ...safeAccount } = newAccount;
    return res.status(201).json({ ok: true, account: safeAccount });
  } catch (err) {
    console.error('Error creating account:', err);
    return res.status(500).json({ ok: false, message: 'Failed to create account.' });
  }
};

export const getMe = (req, res) => {
  const { password, ...safeUser } = req.user;
  return res.json({
    ok: true,
    user: {
      ...safeUser,
      current_session: parseJSONField(safeUser.current_session, null),
    },
  });
};

export const updateAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, email, contact, currentPassword, newPassword, is_active } = req.body;

    const target = await prisma.account.findUnique({
      where: { id },
    });

    if (!target) {
      return res.status(404).json({ ok: false, message: 'Account not found.' });
    }

    // Non-admins can only edit their own account
    if (req.user.role !== 'admin' && req.user.id !== id) {
      return res.status(403).json({ ok: false, message: 'Forbidden: You can only update your own account.' });
    }

    const updateData = {};

    // Handle password change if specified
    if (newPassword) {
      if (req.user.id === id && currentPassword) {
        const isValid = bcrypt.compareSync(currentPassword, target.password);
        if (!isValid) {
          return res.status(400).json({ ok: false, message: 'Current password is incorrect.' });
        }
      }
      updateData.password = bcrypt.hashSync(newPassword, 10);

      await addActivityLog({
        account_id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        action: 'password_changed',
        details: `Password changed for account "${target.full_name}" (@${target.username})`,
      });
    }

    if (full_name !== undefined) updateData.full_name = full_name;
    if (email !== undefined) updateData.email = email;
    if (contact !== undefined) updateData.contact = contact;

    // Admin can toggle activation
    if (req.user.role === 'admin' && is_active !== undefined) {
      updateData.is_active = Boolean(is_active);
      await addActivityLog({
        account_id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        action: is_active ? 'account_activated' : 'account_deactivated',
        details: `Status set to ${is_active ? 'Active' : 'Inactive'} for account "${target.full_name}"`,
      });
    }

    const updated = await prisma.account.update({
      where: { id },
      data: updateData,
    });

    const { password: _, ...safeAccount } = updated;
    return res.json({
      ok: true,
      account: {
        ...safeAccount,
        current_session: parseJSONField(safeAccount.current_session, null),
      },
    });
  } catch (err) {
    console.error('Error updating account:', err);
    return res.status(500).json({ ok: false, message: 'Failed to update account.' });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ ok: false, message: 'Cannot delete your own account.' });
    }

    const target = await prisma.account.findUnique({
      where: { id },
    });

    if (!target) {
      return res.status(404).json({ ok: false, message: 'Account not found.' });
    }

    await prisma.account.delete({
      where: { id },
    });

    await addActivityLog({
      account_id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      action: 'account_deleted',
      details: `Deleted account "${target.full_name}" (@${target.username})`,
    });

    return res.json({ ok: true, message: 'Account deleted successfully.' });
  } catch (err) {
    console.error('Error deleting account:', err);
    return res.status(500).json({ ok: false, message: 'Failed to delete account.' });
  }
};

export const terminateOtherSessions = async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const userAgentString = req.headers['user-agent'] || '';
    const deviceInfo = parseUserAgent(userAgentString);

    // Generate fresh session ID
    const newSessionId = 'sess_' + shortId() + '_' + Date.now();
    const sessionData = {
      session_id: newSessionId,
      login_at: new Date().toISOString(),
      ip_address: ip,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      device_type: deviceInfo.deviceType,
      user_agent: userAgentString,
    };

    const updated = await prisma.account.update({
      where: { id: req.user.id },
      data: {
        active_session_id: newSessionId,
        last_login_at: new Date().toISOString(),
        current_session: JSON.stringify(sessionData),
      },
    });

    const newToken = generateToken({
      id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      sessionId: newSessionId,
    });

    await addActivityLog({
      account_id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      action: 'session_reset',
      details: `Invalidated all other active sessions from ${deviceInfo.browser} on ${deviceInfo.os}`,
      ip_address: ip,
      user_agent: userAgentString,
    });

    const { password: _, ...safeUser } = updated;

    return res.json({
      ok: true,
      message: 'All other device sessions have been successfully terminated.',
      token: newToken,
      user: {
        ...safeUser,
        current_session: sessionData,
      },
    });
  } catch (err) {
    console.error('Error terminating other sessions:', err);
    return res.status(500).json({ ok: false, message: 'Failed to reset sessions.' });
  }
};

export const getAuditLogs = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const actionFilter = req.query.action;

    const logs = await prisma.activityLog.findMany({
      where: actionFilter ? { action: actionFilter } : {},
      take: limit,
      orderBy: { created_at: 'desc' },
    });

    return res.json({
      ok: true,
      logs: logs.map((l) => ({
        ...l,
        login_at: l.created_at.toISOString(),
      })),
    });
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    return res.status(500).json({ ok: false, message: 'Failed to fetch audit logs.' });
  }
};
