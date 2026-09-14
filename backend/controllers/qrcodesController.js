import { shortId } from '../utils/qr.js';
import { prisma } from '../db/prisma.js';
import {
  addActivityLog,
  addNotification,
  generateQRCodesForHouseholdAndCycle,
  parseJSONField,
} from '../services/dbHelper.js';

export const getAllQRCodes = async (req, res) => {
  try {
    if (req.user.role === 'beneficiary') {
      const hh = await prisma.household.findFirst({
        where: { account_id: req.user.id },
      });
      const codes = hh
        ? await prisma.qRCode.findMany({
            where: { household_id: hh.id },
            orderBy: { created_at: 'desc' },
          })
        : [];
      return res.json({ ok: true, qrCodes: codes });
    }

    const codes = await prisma.qRCode.findMany({
      orderBy: { created_at: 'desc' },
    });
    return res.json({ ok: true, qrCodes: codes });
  } catch (err) {
    console.error('Error fetching QR codes:', err);
    return res.status(500).json({ ok: false, message: 'Failed to fetch QR codes.' });
  }
};

export const verifyQRToken = async (req, res) => {
  try {
    const { token } = req.params;
    let trimmed = decodeURIComponent(token || '').trim();

    if (trimmed.includes('token=')) {
      trimmed = trimmed.split('token=')[1].split('&')[0].trim();
    }
    if (trimmed.startsWith('BPR-SECURED::')) {
      trimmed = trimmed.replace('BPR-SECURED::', '').trim();
    }

    if (!trimmed) {
      return res.status(400).json({ status: 'error', message: 'Empty QR token.' });
    }

    const qr = await prisma.qRCode.findFirst({
      where: {
        OR: [
          { qr_token: trimmed },
          { id: trimmed },
        ],
      },
    });

    if (!qr) {
      return res.status(404).json({
        status: 'not_found',
        is_system_verified: false,
        message: 'QR code not registered in this system. Not an authentic relief pass.',
      });
    }

    const cycle = await prisma.cycle.findUnique({
      where: { id: qr.cycle_id },
    });

    if (!cycle || !cycle.is_active) {
      return res.json({
        status: 'inactive',
        message: `This QR belongs to "${cycle?.name || 'Unknown'}" which is no longer active.`,
        qr,
      });
    }

    const hh = await prisma.household.findUnique({
      where: { id: qr.household_id },
      include: { members: true },
    });

    const member = qr.member_id
      ? hh?.members?.find((m) => m.id === qr.member_id)
      : hh?.members?.find((m) => m.is_head);

    if (member && (member.status === 'inactive' || member.status === 'deceased')) {
      return res.json({
        status: 'inactive_member',
        message: `Member "${member.fname} ${member.lname}" is marked ${member.status.toUpperCase()} and is not eligible for relief distribution.`,
        qr,
        cycle: {
          ...cycle,
          items: parseJSONField(cycle.items, []),
          target_purok_ids: parseJSONField(cycle.target_purok_ids, []),
        },
        household: hh,
        member: member ? { ...member, sectors: parseJSONField(member.sectors, []) } : null,
      });
    }

    const pendingChange = await prisma.pendingMemberStatusChange.findFirst({
      where: {
        hh_id: hh?.id,
        status: 'pending',
      },
    });

    if (pendingChange) {
      return res.json({
        status: 'on_hold',
        message: `DISTRIBUTION ON HOLD: Member "${pendingChange.member_name}" has a pending status change (${pendingChange.current_status} → ${pendingChange.new_status}) awaiting beneficiary confirmation on portal.`,
        qr,
        cycle: {
          ...cycle,
          items: parseJSONField(cycle.items, []),
          target_purok_ids: parseJSONField(cycle.target_purok_ids, []),
        },
        household: hh,
        member: member ? { ...member, sectors: parseJSONField(member.sectors, []) } : null,
        pendingChange,
      });
    }

    if (qr.is_claimed) {
      return res.json({
        status: 'claimed',
        message: `Already claimed for cycle: "${cycle.name}".`,
        qr,
        cycle: {
          ...cycle,
          items: parseJSONField(cycle.items, []),
          target_purok_ids: parseJSONField(cycle.target_purok_ids, []),
        },
        household: hh,
        member: member ? { ...member, sectors: parseJSONField(member.sectors, []) } : null,
        claimed_at: qr.claimed_at,
      });
    }

    let pkg = parseJSONField(cycle.items, []);
    if (!pkg || pkg.length === 0) {
      const standardPkgs = await prisma.standardPackage.findMany({
        where: { sector_code: cycle.type },
      });
      pkg = standardPkgs;
    }

    return res.json({
      status: 'eligible',
      message: `Active Cycle: ${cycle?.name || 'Barangay Relief Distribution'}.`,
      qr,
      cycle: {
        ...cycle,
        items: parseJSONField(cycle.items, []),
        target_purok_ids: parseJSONField(cycle.target_purok_ids, []),
      },
      household: hh,
      member: member ? { ...member, sectors: parseJSONField(member.sectors, []) } : null,
      items: pkg,
    });
  } catch (err) {
    console.error('Error verifying QR token:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to verify QR token.' });
  }
};

export const generateQRCodesForCycle = async (req, res) => {
  try {
    const { cycle_id } = req.body;

    const cycle = await prisma.cycle.findUnique({
      where: { id: cycle_id },
    });
    if (!cycle) {
      return res.status(404).json({ ok: false, message: 'Cycle not found.' });
    }

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
    for (const hh of households) {
      const generated = await generateQRCodesForHouseholdAndCycle(hh, cycle);
      qrCount += generated.length;
    }

    return res.json({
      ok: true,
      message: `Generated ${qrCount} QR codes for cycle "${cycle.name}".`,
      qrCount,
    });
  } catch (err) {
    console.error('Error generating QR codes for cycle:', err);
    return res.status(500).json({ ok: false, message: 'Failed to generate QR codes.' });
  }
};

export const claimQRCode = async (req, res) => {
  try {
    const { id } = req.params;

    const qr = await prisma.qRCode.findUnique({
      where: { id },
    });
    if (!qr) {
      return res.status(404).json({ ok: false, message: 'QR code not found.' });
    }

    if (qr.is_claimed) {
      return res.status(400).json({ ok: false, message: 'QR code already claimed.' });
    }

    const cycle = await prisma.cycle.findUnique({
      where: { id: qr.cycle_id },
    });
    if (!cycle || !cycle.is_active) {
      return res.status(400).json({ ok: false, message: 'Cycle is inactive.' });
    }

    const hh = await prisma.household.findUnique({
      where: { id: qr.household_id },
    });

    const claimedAt = new Date().toISOString();
    const updatedQR = await prisma.qRCode.update({
      where: { id },
      data: {
        is_claimed: true,
        claimed_at: claimedAt,
      },
    });

    if (hh?.account_id) {
      await addNotification({
        recipient_id: hh.account_id,
        type: 'distribution',
        title: 'QR Code Verified! ✅',
        message: `Your QR code was verified for cycle: "${cycle.name}".`,
        link: '/beneficiary/history',
      });
    }

    await addActivityLog({
      account_id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      action: 'scanned_qr',
      details: `Verified ${hh?.hh_code || 'HH'} for ${cycle.name}`,
    });

    return res.json({
      ok: true,
      message: `QR code verified successfully for cycle: "${cycle.name}".`,
      qr: updatedQR,
    });
  } catch (err) {
    console.error('Error claiming QR code:', err);
    return res.status(500).json({ ok: false, message: 'Failed to claim QR code.' });
  }
};
