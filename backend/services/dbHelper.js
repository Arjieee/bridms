import { prisma } from '../db/prisma.js';
import { shortId, uuidv4 } from '../utils/qr.js';

export const ageGroup = (age) => {
  const num = parseInt(age);
  return num >= 60 ? 'senior' : num >= 18 ? 'adult' : 'minor';
};

export const mkMember = (id, is_head, fname, lname, age, sex, relationship, contact, email, sectors = []) => {
  const parsedAge = parseInt(age) || 0;
  return {
    id: id || 'm-' + shortId() + Math.random().toString(36).substr(2, 3),
    is_head: Boolean(is_head),
    fname: (fname || '').trim(),
    lname: (lname || '').trim(),
    age: parsedAge,
    age_group: ageGroup(parsedAge),
    sex: sex || null,
    relationship: relationship || null,
    contact: contact || null,
    email: email || null,
    sectors: typeof sectors === 'string' ? sectors : JSON.stringify(sectors || []),
    status: 'active',
    status_remarks: null,
    status_updated_at: null,
    approval_status: 'approved',
  };
};

export const addActivityLog = async ({ account_id, username, role, action, details, ip_address, user_agent }) => {
  try {
    return await prisma.activityLog.create({
      data: {
        id: 'log-' + shortId() + Math.random().toString(36).substr(2, 3),
        account_id: account_id || null,
        username: username || null,
        role: role || null,
        action,
        details: details || null,
        ip_address: ip_address || null,
        user_agent: user_agent || null,
      },
    });
  } catch (err) {
    console.error('Failed to write activity log:', err);
  }
};

export const addNotification = async ({ recipient_id, recipient_role, type, title, message, link }) => {
  try {
    return await prisma.notification.create({
      data: {
        id: 'n-' + shortId() + Math.random().toString(36).substr(2, 4),
        recipient_id: recipient_id || null,
        recipient_role: recipient_role || null,
        type,
        title,
        message,
        link: link || null,
        is_read: false,
      },
    });
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
};

export const notifyAdmins = async (data) => {
  try {
    const activeAdmins = await prisma.account.findMany({
      where: { role: 'admin', is_active: true },
      select: { id: true },
    });
    for (const admin of activeAdmins) {
      await addNotification({ ...data, recipient_id: admin.id });
    }
  } catch (err) {
    console.error('Failed to notify admins:', err);
  }
};

export const notifyStaff = async (data) => {
  try {
    const activeStaff = await prisma.account.findMany({
      where: { role: 'staff', is_active: true },
      select: { id: true },
    });
    for (const staff of activeStaff) {
      await addNotification({ ...data, recipient_id: staff.id });
    }
  } catch (err) {
    console.error('Failed to notify staff:', err);
  }
};

export const adjustStock = async (itemId, qty, type, remarks) => {
  try {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: Number(itemId) },
    });
    if (!item) return null;

    const newQty = type === 'in' ? item.quantity + qty : Math.max(0, item.quantity - qty);

    const updated = await prisma.inventoryItem.update({
      where: { id: Number(itemId) },
      data: { quantity: newQty },
    });

    if (newQty <= updated.critical_threshold && newQty > 0) {
      await notifyAdmins({
        type: 'stock_critical',
        title: 'Critical Stock Alert',
        message: `"${updated.name}" is at ${newQty} ${updated.unit}. Restock immediately.`,
        link: '/admin/inventory',
      });
    } else if (newQty <= updated.low_threshold && type === 'out') {
      await notifyAdmins({
        type: 'stock_low',
        title: 'Low Stock Alert',
        message: `"${updated.name}" is running low: ${newQty} ${updated.unit}.`,
        link: '/admin/inventory',
      });
    }

    return updated;
  } catch (err) {
    console.error('Failed to adjust stock:', err);
    return null;
  }
};

export const generateQRCodesForHouseholdAndCycle = async (hh, cycle) => {
  try {
    // Check if purok is archived
    const purok = await prisma.purok.findUnique({
      where: { id: Number(hh.purok_id) },
    });
    if (purok?.is_archived) {
      return []; // Skip households in archived puroks!
    }

    // Check targeted puroks
    let targetPurokIds = [];
    if (cycle.target_purok_ids) {
      try {
        targetPurokIds = typeof cycle.target_purok_ids === 'string' ? JSON.parse(cycle.target_purok_ids) : cycle.target_purok_ids;
      } catch (e) {}
    }

    if (Array.isArray(targetPurokIds) && targetPurokIds.length > 0) {
      if (!targetPurokIds.includes(Number(hh.purok_id))) {
        return []; // Skip households outside targeted puroks!
      }
    }

    // Fetch active members of this household
    const activeMembers = await prisma.member.findMany({
      where: {
        household_id: hh.id,
        status: 'active',
      },
    });

    if (activeMembers.length === 0) {
      return [];
    }

    const createdCodes = [];

    const makeCodeData = (member_id, type) => ({
      id: 'qr-' + shortId() + Math.random().toString(36).substr(2, 4),
      qr_token: uuidv4(),
      cycle_id: cycle.id,
      cycle_name: cycle.name,
      cycle_type: cycle.type,
      household_id: hh.id,
      member_id,
      type,
      is_claimed: false,
      claimed_at: null,
    });

    if (cycle.type === 'household' || cycle.type === 'emergency') {
      const code = await prisma.qRCode.create({
        data: makeCodeData(null, 'household'),
      });
      createdCodes.push(code);
    } else {
      for (const m of activeMembers) {
        let sectorsList = [];
        try {
          sectorsList = typeof m.sectors === 'string' ? JSON.parse(m.sectors) : (m.sectors || []);
        } catch (e) {}

        if (Array.isArray(sectorsList) && sectorsList.includes(cycle.type)) {
          const code = await prisma.qRCode.create({
            data: makeCodeData(m.id, 'member'),
          });
          createdCodes.push(code);
        }
      }
    }

    return createdCodes;
  } catch (err) {
    console.error('Error generating QR codes:', err);
    return [];
  }
};

export const parseJSONField = (val, fallback = null) => {
  if (val === null || val === undefined) return fallback;
  if (typeof val !== 'string') return val;
  try {
    return JSON.parse(val);
  } catch (e) {
    return fallback;
  }
};
