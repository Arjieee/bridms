import bcrypt from 'bcryptjs';
import { uuidv4, shortId } from '../utils/qr.js';
import { prisma } from '../db/prisma.js';
import {
  addActivityLog,
  addNotification,
  notifyAdmins,
  generateQRCodesForHouseholdAndCycle,
  parseJSONField,
  ageGroup,
  mkMember,
} from '../services/dbHelper.js';
import { sendEmailVerificationToken } from '../utils/email.js';

const formatHousehold = (hh) => {
  if (!hh) return null;
  return {
    ...hh,
    emergency_receiver: parseJSONField(hh.emergency_receiver, null),
    members: (hh.members || []).map((m) => ({
      ...m,
      sectors: parseJSONField(m.sectors, []),
    })),
  };
};

const formatPendingRegistration = (r) => {
  if (!r) return null;
  return {
    ...r,
    head: parseJSONField(r.head_data, {}),
    members: parseJSONField(r.members_data, []),
    emergency_receiver: parseJSONField(r.emergency_receiver, null),
  };
};

export const getApprovedHouseholds = async (req, res) => {
  try {
    if (req.user.role === 'beneficiary') {
      const hh = await prisma.household.findFirst({
        where: { account_id: req.user.id },
        include: { members: true },
      });
      return res.json({ ok: true, households: hh ? [formatHousehold(hh)] : [] });
    }

    const archivedPuroks = await prisma.purok.findMany({
      where: { is_archived: true },
      select: { id: true },
    });
    const archivedPurokIds = archivedPuroks.map((p) => p.id);

    const households = await prisma.household.findMany({
      where: {
        purok_id: { notIn: archivedPurokIds },
      },
      include: { members: true },
      orderBy: { created_at: 'desc' },
    });

    return res.json({
      ok: true,
      households: households.map(formatHousehold),
    });
  } catch (err) {
    console.error('Error fetching approved households:', err);
    return res.status(500).json({ ok: false, message: 'Failed to fetch households.' });
  }
};

export const getPendingRegistrations = async (req, res) => {
  try {
    const regs = await prisma.pendingRegistration.findMany({
      orderBy: { created_at: 'desc' },
    });

    return res.json({
      ok: true,
      pendingRegistrations: regs.map(formatPendingRegistration),
    });
  } catch (err) {
    console.error('Error fetching pending registrations:', err);
    return res.status(500).json({ ok: false, message: 'Failed to fetch pending registrations.' });
  }
};

export const getHouseholdById = async (req, res) => {
  try {
    const { id } = req.params;
    const hh = await prisma.household.findUnique({
      where: { id },
      include: { members: true },
    });

    if (!hh) {
      return res.status(404).json({ ok: false, message: 'Household not found.' });
    }

    if (req.user.role === 'beneficiary' && hh.account_id !== req.user.id) {
      return res.status(403).json({ ok: false, message: 'Forbidden: Cannot access another household.' });
    }

    return res.json({ ok: true, household: formatHousehold(hh) });
  } catch (err) {
    console.error('Error fetching household by ID:', err);
    return res.status(500).json({ ok: false, message: 'Failed to fetch household.' });
  }
};

export const registerHousehold = async (req, res) => {
  try {
    const data = req.body;

    if (!data.username || !data.password || !data.head || !data.purok_id) {
      return res.status(400).json({ ok: false, message: 'Missing required registration fields.' });
    }

    const cleanUsername = data.username.trim();

    const existingAccount = await prisma.account.findUnique({
      where: { username: cleanUsername },
    });
    if (existingAccount) {
      return res.status(400).json({ ok: false, message: 'Username already taken.' });
    }

    const id = uuidv4();
    const hashedPassword = bcrypt.hashSync(data.password, 10);
    const emailVerificationToken = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const newReg = await prisma.pendingRegistration.create({
      data: {
        id,
        username: cleanUsername,
        password: hashedPassword,
        purok_id: Number(data.purok_id),
        house_no_street: data.house_no_street || null,
        status: 'pending',
        is_email_verified: false,
        email_verification_token: emailVerificationToken,
        email_verification_expires_at: tokenExpiresAt,
        reg_date: new Date().toISOString().split('T')[0],
        head_data: JSON.stringify(data.head),
        members_data: JSON.stringify(data.members || []),
        emergency_receiver: data.emergency_receiver ? JSON.stringify(data.emergency_receiver) : null,
      },
    });

    const purok = await prisma.purok.findUnique({ where: { id: Number(data.purok_id) } });
    const purokName = purok?.name || 'Unknown';

    await notifyAdmins({
      type: 'registration',
      title: 'New Registration',
      message: `${data.head.fname} ${data.head.lname} from ${purokName} submitted a registration.`,
      link: '/admin/settings',
    });

    if (data.head?.email) {
      sendEmailVerificationToken(
        data.head.email,
        `${data.head.fname} ${data.head.lname}`,
        emailVerificationToken
      ).catch((err) => console.error('Failed to send verification email:', err));
    }

    const formattedReg = formatPendingRegistration(newReg);
    const { password: _, ...safeReg } = formattedReg;

    return res.status(201).json({ ok: true, registration: safeReg });
  } catch (err) {
    console.error('Error registering household:', err);
    return res.status(500).json({ ok: false, message: 'Failed to submit registration.' });
  }
};

export const updateHousehold = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const hh = await prisma.household.findUnique({
      where: { id },
      include: { members: true },
    });

    if (!hh) {
      return res.status(404).json({ ok: false, message: 'Household not found.' });
    }

    const dataToUpdate = {};
    if (updates.house_no_street !== undefined) dataToUpdate.house_no_street = updates.house_no_street;
    if (updates.purok_id !== undefined) {
      dataToUpdate.purok_id = Number(updates.purok_id);
      const purok = await prisma.purok.findUnique({ where: { id: Number(updates.purok_id) } });
      if (purok) dataToUpdate.purok_name = purok.name;
    }
    if (updates.emergency_receiver !== undefined) {
      dataToUpdate.emergency_receiver = typeof updates.emergency_receiver === 'string'
        ? updates.emergency_receiver
        : JSON.stringify(updates.emergency_receiver);
    }

    const updated = await prisma.household.update({
      where: { id },
      data: dataToUpdate,
      include: { members: true },
    });

    return res.json({ ok: true, household: formatHousehold(updated) });
  } catch (err) {
    console.error('Error updating household:', err);
    return res.status(500).json({ ok: false, message: 'Failed to update household.' });
  }
};

export const approveRegistration = async (req, res) => {
  try {
    const { id } = req.params;

    const reg = await prisma.pendingRegistration.findUnique({
      where: { id },
    });

    if (!reg) {
      return res.status(404).json({ ok: false, message: 'Registration not found.' });
    }

    if (reg.status !== 'pending') {
      return res.status(400).json({ ok: false, message: `Registration is already ${reg.status}.` });
    }

    const head = parseJSONField(reg.head_data, {});
    const membersList = parseJSONField(reg.members_data, []);
    const emergencyRec = parseJSONField(reg.emergency_receiver, null);

    const accId = 'ben-' + shortId();
    const hhId = 'hh-' + shortId();
    const hhCode = 'HH-' + Date.now().toString().slice(-6);

    const purok = await prisma.purok.findUnique({ where: { id: reg.purok_id } });
    const purokName = purok?.name || 'Unknown';

    // Build head member
    const headMember = mkMember(
      'm-' + shortId(),
      true,
      head.fname,
      head.lname,
      parseInt(head.age) || 0,
      head.sex,
      'Head',
      head.contact,
      head.email,
      head.sectors || []
    );

    // Build other members
    const otherMembers = membersList.map((m) =>
      mkMember(
        'm-' + shortId() + Math.random().toString(36).substr(2, 3),
        false,
        m.fname,
        m.lname,
        parseInt(m.age) || 0,
        m.sex,
        m.relationship || 'Other',
        m.contact,
        m.email,
        m.sectors || []
      )
    );

    const allMembersData = [headMember, ...otherMembers].map((m) => ({
      ...m,
      household_id: hhId,
    }));

    // Transaction: Create Account, Household, Members, and update PendingRegistration
    const [newAccount, newHH] = await prisma.$transaction([
      prisma.account.create({
        data: {
          id: accId,
          username: reg.username,
          password: reg.password,
          role: 'beneficiary',
          full_name: `${head.fname} ${head.lname}`,
          email: head.email || null,
          contact: head.contact || null,
          is_email_verified: reg.is_email_verified,
          is_active: true,
        },
      }),
      prisma.household.create({
        data: {
          id: hhId,
          hh_code: hhCode,
          purok_id: reg.purok_id,
          purok_name: purokName,
          account_id: accId,
          house_no_street: reg.house_no_street || null,
          status: 'approved',
          reg_date: reg.reg_date,
          approved_at: new Date().toISOString(),
          approved_by: req.user.id,
          emergency_receiver: emergencyRec?.receiver_name ? JSON.stringify(emergencyRec) : null,
          members: {
            create: allMembersData.map(({ household_id, ...m }) => m),
          },
        },
        include: { members: true },
      }),
      prisma.pendingRegistration.update({
        where: { id: reg.id },
        data: {
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: req.user.id,
        },
      }),
    ]);

    // Generate QR codes for all currently active cycles
    const activeCycles = await prisma.cycle.findMany({
      where: { is_active: true },
    });

    for (const cycle of activeCycles) {
      await generateQRCodesForHouseholdAndCycle(newHH, cycle);
    }

    await addNotification({
      recipient_id: accId,
      type: 'approval',
      title: 'Registration Approved! 🎉',
      message: 'Your household has been approved. Log in to view your QR code.',
      link: '/beneficiary',
    });

    await addActivityLog({
      account_id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      action: 'approved_registration',
      details: `${newHH.hh_code} - ${head.fname} ${head.lname}`,
    });

    const { password: _, ...safeAccount } = newAccount;
    return res.json({
      ok: true,
      household: formatHousehold(newHH),
      account: safeAccount,
    });
  } catch (err) {
    console.error('Error approving registration:', err);
    return res.status(500).json({ ok: false, message: 'Failed to approve registration.' });
  }
};

export const rejectRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const reg = await prisma.pendingRegistration.findUnique({
      where: { id },
    });

    if (!reg) {
      return res.status(404).json({ ok: false, message: 'Registration not found.' });
    }

    await prisma.pendingRegistration.update({
      where: { id },
      data: {
        status: 'rejected',
        rejection_reason: reason || 'No reason provided',
        reviewed_at: new Date().toISOString(),
        reviewed_by: req.user.id,
      },
    });

    const head = parseJSONField(reg.head_data, {});

    await addActivityLog({
      account_id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      action: 'rejected_registration',
      details: `${head?.fname} ${head?.lname}`,
    });

    return res.json({ ok: true, message: 'Registration rejected.' });
  } catch (err) {
    console.error('Error rejecting registration:', err);
    return res.status(500).json({ ok: false, message: 'Failed to reject registration.' });
  }
};
