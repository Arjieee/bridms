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

    // Enforce active distribution cycle requirement
    if (!data.cycle_id) {
      return res.status(400).json({
        ok: false,
        message: 'An active distribution cycle is required to distribute relief goods. Please create or activate a cycle first.',
      });
    }

    const cycle = await prisma.cycle.findUnique({ where: { id: data.cycle_id } });
    if (!cycle || !cycle.is_active) {
      return res.status(400).json({
        ok: false,
        message: 'The selected distribution cycle is not active or does not exist.',
      });
    }

    // Strict Double-Claim Blocker: check if this household already received in this cycle
    const existingClaim = await prisma.distribution.findFirst({
      where: {
        cycle_id: data.cycle_id,
        household_id: data.household_id,
      },
    });
    if (existingClaim) {
      return res.status(400).json({
        ok: false,
        message: `Household ${hh.hh_code} has already claimed relief goods for cycle "${cycle.name}" on ${existingClaim.dist_date} (Tracking Code: ${existingClaim.dist_code}). Duplicate claims within the same cycle are prohibited.`,
        existing_dist_code: existingClaim.dist_code,
      });
    }

    const head = hh.members?.find((m) => m.is_head);
    const distCode = 'DIST-' + Date.now().toString().slice(-8);

    // Fetch all current inventory items to accurately match by ID or compound key (name + unit)
    const allInv = await prisma.inventoryItem.findMany();
    const resolvedItems = [];

    // Deduct stock for distributed items and record in StockLedger
    if (Array.isArray(data.items)) {
      const recipientDesc = head ? `${head.fname} ${head.lname}` : (hh.purok_name || 'Household');
      for (const item of data.items) {
        const qty = parseFloat(item.quantity) || 0;
        if (qty <= 0) continue;

        let targetInv = null;
        if (item.item_id) {
          const byId = allInv.find((inv) => inv.id === Number(item.item_id));
          if (byId) {
            // Verify if the unit or name doesn't contradict
            const sameName = !item.item_name || byId.name.trim().toLowerCase() === item.item_name.trim().toLowerCase();
            const sameUnit = !item.unit || byId.unit.trim().toLowerCase() === item.unit.trim().toLowerCase();
            if (sameName && sameUnit) {
              targetInv = byId;
            }
          }
        }

        // If targetInv is not found by ID or ID had a unit mismatch (e.g., ID pointed to sacks but unit requested is kg)
        if (!targetInv && item.item_name) {
          const reqName = (item.item_name || '').trim().toLowerCase();
          const reqUnit = (item.unit || '').trim().toLowerCase();
          const reqDonor = (item.donor_name || '').trim().toLowerCase();

          // 1. Try matching Name + Unit + Donor
          if (reqDonor) {
            targetInv = allInv.find(
              (inv) =>
                inv.name.trim().toLowerCase() === reqName &&
                (!reqUnit || inv.unit.trim().toLowerCase() === reqUnit) &&
                inv.donor_name &&
                inv.donor_name.trim().toLowerCase() === reqDonor
            );
          }

          // 2. Try matching Name + Unit (prioritizing is_repacked and positive quantity)
          if (!targetInv) {
            const matches = allInv.filter(
              (inv) =>
                inv.name.trim().toLowerCase() === reqName &&
                (!reqUnit || inv.unit.trim().toLowerCase() === reqUnit)
            );
            if (matches.length > 0) {
              // Prioritize repacked item if available
              targetInv = matches.find((m) => m.is_repacked && m.quantity > 0) ||
                          matches.find((m) => m.quantity > 0) ||
                          matches[0];
            }
          }
        }

        if (targetInv) {
          const donorSuffix = targetInv.donor_name ? ` [Donor: ${targetInv.donor_name}]` : '';
          await adjustStock(
            targetInv.id,
            qty,
            'out',
            `Distribution: ${hh.hh_code} - ${recipientDesc} (${cycle.name})${donorSuffix}`,
            {
              reference_id: distCode,
              donor_name: targetInv.donor_name || null,
              recorded_by: req.user?.username || req.user?.full_name || req.user?.id,
            }
          );
          resolvedItems.push({
            item_id: targetInv.id,
            item_name: targetInv.name,
            quantity: qty,
            unit: targetInv.unit,
            donor_name: targetInv.donor_name || null,
          });
        } else {
          resolvedItems.push({
            item_id: Number(item.item_id) || null,
            item_name: item.item_name || 'Relief Item',
            quantity: qty,
            unit: item.unit || 'pcs',
          });
        }
      }
    }

    const distRecord = await prisma.distribution.create({
      data: {
        id: 'dist-' + shortId(),
        dist_code: distCode,
        cycle_id: cycle.id,
        cycle_name: cycle.name,
        cycle_type: cycle.type,
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
        items: JSON.stringify(resolvedItems),
        recorded_by: req.user.id,
      },
    });

    // Mark matching QR codes as claimed
    if (data.household_id) {
      const qrFilter = {
        cycle_id: cycle.id,
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
