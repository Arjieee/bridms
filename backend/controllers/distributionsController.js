import { shortId } from '../utils/qr.js';
import { prisma } from '../db/prisma.js';
import { addNotification, adjustStock, parseJSONField } from '../services/dbHelper.js';

const formatDistribution = (d) => {
  if (!d) return null;
  return {
    ...d,
    officials: parseJSONField(d.officials, []),
    items: parseJSONField(d.items, []),
  };
};

export const getAllDistributions = async (req, res) => {
  try {
    if (req.user.role === 'beneficiary') {
      const hh = await prisma.household.findFirst({
        where: { account_id: req.user.id },
      });
      const list = hh
        ? await prisma.distribution.findMany({
            where: { household_id: hh.id },
            orderBy: { recorded_at: 'desc' },
          })
        : [];
      return res.json({ ok: true, distributions: list.map(formatDistribution) });
    }

    const list = await prisma.distribution.findMany({
      orderBy: { recorded_at: 'desc' },
    });
    return res.json({ ok: true, distributions: list.map(formatDistribution) });
  } catch (err) {
    console.error('Error fetching distributions:', err);
    return res.status(500).json({ ok: false, message: 'Failed to fetch distribution records.' });
  }
};

export const getDistributionsByCycle = async (req, res) => {
  try {
    const { id } = req.params;
    const list = await prisma.distribution.findMany({
      where: { cycle_id: id },
      orderBy: { recorded_at: 'desc' },
    });
    return res.json({ ok: true, distributions: list.map(formatDistribution) });
  } catch (err) {
    console.error('Error fetching distributions by cycle:', err);
    return res.status(500).json({ ok: false, message: 'Failed to fetch cycle distributions.' });
  }
};

export const recordDistribution = async (req, res) => {
  try {
    const data = req.body;

    if (!data.household_id) {
      return res.status(400).json({ ok: false, message: 'Household ID is required.' });
    }

    const hh = await prisma.household.findUnique({
      where: { id: data.household_id },
      include: { members: true },
    });
    if (!hh) {
      return res.status(404).json({ ok: false, message: 'Household not found.' });
    }

    const cycle = data.cycle_id
      ? await prisma.cycle.findUnique({ where: { id: data.cycle_id } })
      : null;

    const head = hh.members?.find((m) => m.is_head);
    const distCode = 'DIST-' + Date.now().toString().slice(-8);

    const distRecord = await prisma.distribution.create({
      data: {
        id: 'dist-' + shortId(),
        dist_code: distCode,
        cycle_id: data.cycle_id || null,
        cycle_name: cycle?.name || (data.type === 'special_assistance' ? 'Special Assistance' : 'Manual Distribution'),
        cycle_type: cycle?.type || data.type_filter || 'emergency',
        household_id: data.household_id,
        hh_code: hh.hh_code,
        purok_id: hh.purok_id,
        purok_name: hh.purok_name,
        head_fname: head?.fname || null,
        head_lname: head?.lname || null,
        member_id: data.member_id || null,
        dist_date: data.dist_date || new Date().toISOString().split('T')[0],
        type: data.type || 'standard',
        special_reason: data.special_reason || null,
        remarks: data.remarks || null,
        officials: JSON.stringify(data.officials || []),
        items: JSON.stringify(data.items || []),
        recorded_by: req.user.id,
      },
    });

    // Mark matching QR codes as claimed
    if (data.cycle_id && data.household_id) {
      const qrFilter = {
        cycle_id: data.cycle_id,
        household_id: data.household_id,
      };
      if (data.member_id) {
        qrFilter.member_id = data.member_id;
      }

      await prisma.qRCode.updateMany({
        where: qrFilter,
        data: {
          is_claimed: true,
          claimed_at: new Date().toISOString(),
        },
      });
    }

    // Deduct stock for distributed items
    if (Array.isArray(data.items)) {
      for (const item of data.items) {
        if (item.item_id && item.quantity) {
          await adjustStock(item.item_id, parseFloat(item.quantity), 'out', `Manual distribution: ${distCode}`);
        }
      }
    }

    if (hh.account_id) {
      await addNotification({
        recipient_id: hh.account_id,
        type: 'distribution',
        title: data.type === 'special_assistance' ? 'Special Assistance Received' : 'Relief Goods Received',
        message: `Distribution recorded: ${cycle?.name || 'Special Assistance'}.`,
        link: '/beneficiary/history',
      });
    }

    return res.status(201).json({
      ok: true,
      dist_code: distCode,
      distribution: formatDistribution(distRecord),
    });
  } catch (err) {
    console.error('Error recording distribution:', err);
    return res.status(500).json({ ok: false, message: 'Failed to record distribution.' });
  }
};
