import { shortId } from '../utils/qr.js';
import { prisma } from '../db/prisma.js';
import {
  addActivityLog,
  addNotification,
  generateQRCodesForHouseholdAndCycle,
  parseJSONField,
} from '../services/dbHelper.js';

const formatCycle = (c) => {
  if (!c) return null;
  return {
    ...c,
    items: parseJSONField(c.items, []),
    target_purok_ids: parseJSONField(c.target_purok_ids, []),
  };
};

export const getAllCycles = async (req, res) => {
  try {
    const cycles = await prisma.cycle.findMany({
      orderBy: { created_at: 'desc' },
    });
    return res.json({ ok: true, cycles: cycles.map(formatCycle) });
  } catch (err) {
    console.error('Error fetching cycles:', err);
    return res.status(500).json({ ok: false, message: 'Failed to fetch distribution cycles.' });
  }
};

export const createCycle = async (req, res) => {
  try {
    const {
      name,
      type,
      description,
      items,
      target_purok_ids,
      distribution_date,
      distribution_time,
      claim_address,
      contact_person,
    } = req.body;

    if (!name || !type) {
      return res.status(400).json({ ok: false, message: 'Name and type are required.' });
    }

    const targetPurokIds = Array.isArray(target_purok_ids) ? target_purok_ids.map(Number) : [];
    let coveragePurokText = 'Entire Barangay Puerto';
    if (targetPurokIds.length > 0) {
      const puroks = await prisma.purok.findMany({
        where: { id: { in: targetPurokIds } },
      });
      coveragePurokText = puroks.length > 0 ? puroks.map((p) => p.name).join(', ') : `${targetPurokIds.length} Puroks`;
    }

    const sectorMatch = await prisma.sector.findUnique({
      where: { code: type },
    });
    const targetBeneficiaryText = type === 'household' || type === 'emergency'
      ? 'All Active Households'
      : `${sectorMatch?.name || type.toUpperCase()} Members`;

    const coverageDetails = `Covered: ${targetBeneficiaryText} (${coveragePurokText})`;
    const cycleItems = items && Array.isArray(items) ? items : [];

    const id = 'cyc-' + shortId();
    const newCycle = await prisma.cycle.create({
      data: {
        id,
        name,
        type,
        description: description || null,
        items: JSON.stringify(cycleItems),
        target_purok_ids: JSON.stringify(targetPurokIds),
        coverage_details: coverageDetails,
        distribution_date: distribution_date || new Date().toISOString().split('T')[0],
        distribution_time: distribution_time || '8:00 AM - 5:00 PM',
        claim_address: claim_address || 'Barangay Puerto Covered Court',
        contact_person: contact_person || null,
        is_active: true,
        activated_at: new Date().toISOString(),
        created_by: req.user.id,
      },
    });

    // Fetch all active households (ignoring archived puroks)
    const archivedPuroks = await prisma.purok.findMany({
      where: { is_archived: true },
      select: { id: true },
    });
    const archivedPurokIds = archivedPuroks.map((p) => p.id);

    const households = await prisma.household.findMany({
      where: {
        status: 'approved',
        purok_id: { notIn: archivedPurokIds },
      },
      include: { members: true },
    });

    let qrCount = 0;
    const notifiedRecipients = new Set();

    for (const hh of households) {
      const generated = await generateQRCodesForHouseholdAndCycle(hh, newCycle);
      qrCount += generated.length;
      if (generated.length > 0 && hh.account_id) {
        notifiedRecipients.add(hh.account_id);
      }
    }

    const scheduleInfo = `Claim Date: ${newCycle.distribution_date} (${newCycle.distribution_time}) at ${newCycle.claim_address}.${newCycle.contact_person ? ` Contact: ${newCycle.contact_person}.` : ''}`;

    for (const accId of notifiedRecipients) {
      await addNotification({
        recipient_id: accId,
        type: 'cycle',
        title: `New Distribution: ${name}`,
        message: `Relief goods for "${name}" are ready! ${coverageDetails}. ${scheduleInfo} Your QR code is generated.`,
        link: '/beneficiary',
      });
    }

    await addActivityLog({
      account_id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      action: 'created_cycle',
      details: `${name} (${type})`,
    });

    return res.status(201).json({
      ok: true,
      message: `Cycle "${name}" created. ${qrCount} QR code(s) generated.`,
      cycle: formatCycle(newCycle),
      qrCount,
    });
  } catch (err) {
    console.error('Error creating cycle:', err);
    return res.status(500).json({ ok: false, message: 'Failed to create distribution cycle.' });
  }
};

export const activateCycle = async (req, res) => {
  try {
    const { id } = req.params;

    const cycle = await prisma.cycle.findUnique({
      where: { id },
    });
    if (!cycle) {
      return res.status(404).json({ ok: false, message: 'Cycle not found.' });
    }

    const updated = await prisma.cycle.update({
      where: { id },
      data: {
        is_active: true,
        activated_at: new Date().toISOString(),
        deactivated_at: null,
      },
    });

    // Generate missing QR codes for households
    const archivedPuroks = await prisma.purok.findMany({
      where: { is_archived: true },
      select: { id: true },
    });
    const archivedPurokIds = archivedPuroks.map((p) => p.id);

    const households = await prisma.household.findMany({
      where: {
        status: 'approved',
        purok_id: { notIn: archivedPurokIds },
      },
      include: { members: true },
    });

    let qrCount = 0;
    const recipients = new Set();

    for (const hh of households) {
      const exists = await prisma.qRCode.findFirst({
        where: { cycle_id: id, household_id: hh.id },
      });
      if (!exists) {
        const generated = await generateQRCodesForHouseholdAndCycle(hh, updated);
        qrCount += generated.length;
      }
      if (hh.account_id) recipients.add(hh.account_id);
    }

    for (const accId of recipients) {
      await addNotification({
        recipient_id: accId,
        type: 'cycle',
        title: `Cycle Reactivated: ${updated.name}`,
        message: 'Your QR code is active again. You may now claim relief.',
        link: '/beneficiary',
      });
    }

    return res.json({
      ok: true,
      message: `Cycle "${updated.name}" reactivated.${qrCount ? ` ${qrCount} new QR codes generated.` : ''}`,
      cycle: formatCycle(updated),
    });
  } catch (err) {
    console.error('Error activating cycle:', err);
    return res.status(500).json({ ok: false, message: 'Failed to activate cycle.' });
  }
};

export const deactivateCycle = async (req, res) => {
  try {
    const { id } = req.params;

    const cycle = await prisma.cycle.findUnique({
      where: { id },
    });
    if (!cycle) {
      return res.status(404).json({ ok: false, message: 'Cycle not found.' });
    }

    const updated = await prisma.cycle.update({
      where: { id },
      data: {
        is_active: false,
        deactivated_at: new Date().toISOString(),
      },
    });

    return res.json({
      ok: true,
      message: `Cycle "${updated.name}" deactivated.`,
      cycle: formatCycle(updated),
    });
  } catch (err) {
    console.error('Error deactivating cycle:', err);
    return res.status(500).json({ ok: false, message: 'Failed to deactivate cycle.' });
  }
};
