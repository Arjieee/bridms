import { shortId, uuidv4 } from '../utils/qr.js';
import { prisma } from '../db/prisma.js';
import {
  addNotification,
  notifyAdmins,
  parseJSONField,
  ageGroup,
  mkMember,
} from '../services/dbHelper.js';

const formatMember = (m) => {
  if (!m) return null;
  return {
    ...m,
    sectors: parseJSONField(m.sectors, []),
  };
};

export const addMember = async (req, res) => {
  try {
    const { id: hhId } = req.params;
    const memberData = req.body;

    const hh = await prisma.household.findUnique({
      where: { id: hhId },
      include: { members: true },
    });

    if (!hh) {
      return res.status(404).json({ ok: false, message: 'Household not found.' });
    }

    if (req.user.role === 'beneficiary' && hh.account_id !== req.user.id) {
      return res.status(403).json({ ok: false, message: 'Forbidden: Cannot manage members of another household.' });
    }

    const normFname = (memberData.fname || '').trim().toLowerCase();
    const normLname = (memberData.lname || '').trim().toLowerCase();

    const exists = (hh.members || []).some(
      (m) => m.fname.trim().toLowerCase() === normFname && m.lname.trim().toLowerCase() === normLname
    );
    if (exists) {
      return res.status(400).json({
        ok: false,
        message: `A family member named "${memberData.fname.trim()} ${memberData.lname.trim()}" already exists in this household.`,
      });
    }

    const memberId = 'm-' + shortId() + Math.random().toString(36).substr(2, 3);
    const parsedAge = parseInt(memberData.age) || 0;
    const isBeneficiary = req.user.role === 'beneficiary';
    const initialApprovalStatus = isBeneficiary ? 'pending' : 'approved';

    const newMemberRecord = await prisma.member.create({
      data: {
        id: memberId,
        household_id: hhId,
        is_head: false,
        fname: memberData.fname.trim(),
        lname: memberData.lname.trim(),
        age: parsedAge,
        age_group: ageGroup(parsedAge),
        sex: memberData.sex || null,
        relationship: memberData.relationship || 'Other',
        contact: memberData.contact || null,
        email: memberData.email || null,
        sectors: JSON.stringify(memberData.sectors || []),
        status: 'active',
        approval_status: initialApprovalStatus,
      },
    });

    if (isBeneficiary) {
      const head = hh.members?.find((m) => m.is_head);
      const headName = head ? `${head.fname} ${head.lname}` : '';

      const pendingRequest = await prisma.pendingMemberAddition.create({
        data: {
          id: 'req-add-' + shortId() + Math.random().toString(36).substr(2, 3),
          household_id: hhId,
          hh_code: hh.hh_code,
          purok_name: hh.purok_name,
          head_name: headName,
          member_id: newMemberRecord.id,
          member_name: `${newMemberRecord.fname} ${newMemberRecord.lname}`,
          member_data: JSON.stringify(formatMember(newMemberRecord)),
          status: 'pending',
        },
      });

      await notifyAdmins({
        type: 'registration',
        title: 'New Member Addition Request',
        message: `${newMemberRecord.fname} ${newMemberRecord.lname} requested for ${hh.hh_code} (${hh.purok_name}). Awaiting Admin confirmation.`,
        link: '/admin/beneficiaries',
      });

      return res.status(201).json({
        ok: true,
        pending: true,
        member: formatMember(newMemberRecord),
        message: `Addition request for ${newMemberRecord.fname} ${newMemberRecord.lname} submitted! Awaiting Admin confirmation.`,
      });
    }

    // Admin directly adds approved member: generate QR codes for any active matching sector cycles
    const activeCycles = await prisma.cycle.findMany({
      where: { is_active: true },
    });

    const sectorsArray = memberData.sectors || [];
    for (const cycle of activeCycles) {
      if (sectorsArray.includes(cycle.type)) {
        await prisma.qRCode.create({
          data: {
            id: 'qr-' + shortId() + Math.random().toString(36).substr(2, 4),
            qr_token: uuidv4(),
            cycle_id: cycle.id,
            cycle_name: cycle.name,
            cycle_type: cycle.type,
            household_id: hhId,
            member_id: newMemberRecord.id,
            type: 'member',
            is_claimed: false,
            claimed_at: null,
          },
        });
      }
    }

    return res.status(201).json({ ok: true, member: formatMember(newMemberRecord) });
  } catch (err) {
    console.error('Error adding member:', err);
    return res.status(500).json({ ok: false, message: 'Failed to add member.' });
  }
};

export const updateMember = async (req, res) => {
  try {
    const { id: hhId, mid: memberId } = req.params;
    const updatedData = req.body;

    const hh = await prisma.household.findUnique({
      where: { id: hhId },
      include: { members: true },
    });

    if (!hh) {
      return res.status(404).json({ ok: false, message: 'Household not found.' });
    }

    if (req.user.role === 'beneficiary' && hh.account_id !== req.user.id) {
      return res.status(403).json({ ok: false, message: 'Forbidden: Cannot edit another household.' });
    }

    const targetMember = hh.members.find((m) => m.id === memberId);
    if (!targetMember) {
      return res.status(404).json({ ok: false, message: 'Member not found.' });
    }

    const newFname = (updatedData.fname ?? targetMember.fname).trim().toLowerCase();
    const newLname = (updatedData.lname ?? targetMember.lname).trim().toLowerCase();

    const isDuplicate = hh.members.some(
      (m) => m.id !== memberId && m.fname.trim().toLowerCase() === newFname && m.lname.trim().toLowerCase() === newLname
    );
    if (isDuplicate) {
      return res.status(400).json({
        ok: false,
        message: `Another family member named "${updatedData.fname || targetMember.fname} ${updatedData.lname || targetMember.lname}" already exists in this household.`,
      });
    }

    const updateFields = {};
    if (updatedData.fname !== undefined) updateFields.fname = updatedData.fname.trim();
    if (updatedData.lname !== undefined) updateFields.lname = updatedData.lname.trim();
    if (updatedData.age !== undefined) {
      const ageNum = parseInt(updatedData.age) || 0;
      updateFields.age = ageNum;
      updateFields.age_group = ageGroup(ageNum);
    }
    if (updatedData.sex !== undefined) updateFields.sex = updatedData.sex;
    if (updatedData.contact !== undefined) updateFields.contact = updatedData.contact;
    if (updatedData.email !== undefined) updateFields.email = updatedData.email;
    if (updatedData.relationship !== undefined) updateFields.relationship = updatedData.relationship;
    if (updatedData.sectors !== undefined) {
      updateFields.sectors = typeof updatedData.sectors === 'string'
        ? updatedData.sectors
        : JSON.stringify(updatedData.sectors);
    }

    const updated = await prisma.member.update({
      where: { id: memberId },
      data: updateFields,
    });

    return res.json({ ok: true, member: formatMember(updated) });
  } catch (err) {
    console.error('Error updating member:', err);
    return res.status(500).json({ ok: false, message: 'Failed to update member.' });
  }
};

export const removeMember = async (req, res) => {
  try {
    const { id: hhId, mid: memberId } = req.params;

    const hh = await prisma.household.findUnique({
      where: { id: hhId },
      include: { members: true },
    });

    if (!hh) {
      return res.status(404).json({ ok: false, message: 'Household not found.' });
    }

    const targetMember = hh.members?.find((m) => m.id === memberId);
    if (!targetMember) {
      return res.status(404).json({ ok: false, message: 'Member not found.' });
    }

    if (targetMember.is_head) {
      return res.status(400).json({ ok: false, message: 'Cannot remove household head.' });
    }

    await prisma.member.delete({
      where: { id: memberId },
    });

    return res.json({ ok: true, message: 'Member removed.' });
  } catch (err) {
    console.error('Error removing member:', err);
    return res.status(500).json({ ok: false, message: 'Failed to remove member.' });
  }
};

export const getStatusChanges = async (req, res) => {
  try {
    await checkSoloHouseholdDeceasedAutoConfirm();

    if (req.user.role === 'beneficiary') {
      const hh = await prisma.household.findFirst({
        where: { account_id: req.user.id },
      });
      const list = hh
        ? await prisma.pendingMemberStatusChange.findMany({
            where: { hh_id: hh.id },
            orderBy: { proposed_at: 'desc' },
          })
        : [];
      return res.json({ ok: true, pendingMemberStatusChanges: list });
    }

    const list = await prisma.pendingMemberStatusChange.findMany({
      orderBy: { proposed_at: 'desc' },
    });
    return res.json({ ok: true, pendingMemberStatusChanges: list });
  } catch (err) {
    console.error('Error fetching status changes:', err);
    return res.status(500).json({ ok: false, message: 'Failed to fetch status changes.' });
  }
};

export const proposeStatusChange = async (req, res) => {
  try {
    const { hhId, memberId, newStatus, remarks } = req.body;

    const hh = await prisma.household.findUnique({
      where: { id: hhId },
      include: { members: true },
    });
    const member = hh?.members?.find((m) => m.id === memberId);

    if (!hh || !member) {
      return res.status(404).json({ ok: false, message: 'Household or member not found.' });
    }

    if (newStatus === 'active') {
      await prisma.member.update({
        where: { id: memberId },
        data: {
          status: 'active',
          status_remarks: remarks || null,
          status_updated_at: new Date().toISOString(),
        },
      });
      return res.json({ ok: true, applied: true, message: 'Member status set to active.' });
    }

    const id = 'msc-' + shortId();
    const request = await prisma.pendingMemberStatusChange.create({
      data: {
        id,
        hh_id: hhId,
        hh_code: hh.hh_code,
        purok_name: hh.purok_name,
        member_id: memberId,
        member_name: `${member.fname} ${member.lname}`,
        current_status: member.status,
        new_status: newStatus,
        remarks: remarks || null,
        proposed_by: req.user.id,
        proposed_by_name: req.user.full_name,
        status: 'pending',
        proposed_at: new Date().toISOString(),
      },
    });

    if (hh.account_id) {
      await addNotification({
        recipient_id: hh.account_id,
        type: 'registration',
        title: 'Action Required: Confirm Member Status',
        message: `Admin proposed marking ${member.fname} ${member.lname} as "${newStatus}". Please confirm or dispute this change.`,
        link: '/beneficiary',
      });
    }

    return res.status(201).json({
      ok: true,
      applied: false,
      message: 'Status change submitted to beneficiary for confirmation.',
      request,
    });
  } catch (err) {
    console.error('Error proposing status change:', err);
    return res.status(500).json({ ok: false, message: 'Failed to propose status change.' });
  }
};

export const confirmStatusChange = async (req, res) => {
  try {
    const { id } = req.params;

    const reqObj = await prisma.pendingMemberStatusChange.findUnique({
      where: { id },
    });
    if (!reqObj) {
      return res.status(404).json({ ok: false, message: 'Status change request not found.' });
    }

    const hh = await prisma.household.findUnique({
      where: { id: reqObj.hh_id },
    });
    if (req.user.role === 'beneficiary' && hh?.account_id !== req.user.id) {
      return res.status(403).json({ ok: false, message: 'Forbidden: Cannot confirm for another household.' });
    }

    await prisma.$transaction([
      prisma.member.update({
        where: { id: reqObj.member_id },
        data: {
          status: reqObj.new_status,
          status_remarks: reqObj.remarks,
          status_updated_at: new Date().toISOString(),
        },
      }),
      prisma.pendingMemberStatusChange.update({
        where: { id },
        data: {
          status: 'confirmed',
          reviewed_by: req.user.id,
          reviewed_at: new Date().toISOString(),
        },
      }),
    ]);

    if (reqObj.proposed_by) {
      await addNotification({
        recipient_id: reqObj.proposed_by,
        type: 'approval',
        title: 'Status Change Confirmed',
        message: `Beneficiary confirmed ${reqObj.member_name}'s status change to "${reqObj.new_status}".`,
        link: '/admin/beneficiaries',
      });
    }

    return res.json({ ok: true, message: 'Status change confirmed.' });
  } catch (err) {
    console.error('Error confirming status change:', err);
    return res.status(500).json({ ok: false, message: 'Failed to confirm status change.' });
  }
};

export const disputeStatusChange = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const reqObj = await prisma.pendingMemberStatusChange.findUnique({
      where: { id },
    });
    if (!reqObj) {
      return res.status(404).json({ ok: false, message: 'Status change request not found.' });
    }

    const hh = await prisma.household.findUnique({
      where: { id: reqObj.hh_id },
    });
    if (req.user.role === 'beneficiary' && hh?.account_id !== req.user.id) {
      return res.status(403).json({ ok: false, message: 'Forbidden: Cannot dispute for another household.' });
    }

    // INSTANT VERIFICATION: Reset member back to active
    await prisma.$transaction([
      prisma.member.update({
        where: { id: reqObj.member_id },
        data: {
          status: 'active',
          status_remarks: null,
          status_updated_at: new Date().toISOString(),
        },
      }),
      prisma.pendingMemberStatusChange.update({
        where: { id },
        data: {
          status: 'disputed_resolved',
          dispute_reason: reason || null,
          reviewed_by: req.user.id,
          reviewed_at: new Date().toISOString(),
        },
      }),
    ]);

    if (reqObj.proposed_by) {
      await addNotification({
        recipient_id: reqObj.proposed_by,
        type: 'approval',
        title: 'Status Change Disputed & Instantly Verified',
        message: `Beneficiary disputed ${reqObj.member_name}'s status change proposal. Member status has been instantly verified back to Active.${reason ? ` Reason: ${reason}` : ''}`,
        link: '/admin/beneficiaries',
      });
    }

    return res.json({ ok: true, message: 'Status change disputed. Member has been instantly verified as active.' });
  } catch (err) {
    console.error('Error disputing status change:', err);
    return res.status(500).json({ ok: false, message: 'Failed to dispute status change.' });
  }
};

export const requestReactivation = async (req, res) => {
  try {
    const { memberId, reason } = req.body;
    const hh = await prisma.household.findFirst({
      where: { account_id: req.user.id },
      include: { members: true },
    });
    const member = hh?.members?.find((m) => m.id === memberId);

    if (!hh || !member) {
      return res.status(404).json({ ok: false, message: 'Member or household not found.' });
    }

    await notifyAdmins({
      type: 'registration',
      title: 'Reactivation Requested',
      message: `Beneficiary ${member.fname} ${member.lname} (HH Code: ${hh.hh_code}) requested account/member reactivation.${reason ? ` Reason: ${reason}` : ''}`,
      link: '/admin/beneficiaries',
    });

    return res.json({ ok: true, message: 'Reactivation request sent to barangay admin.' });
  } catch (err) {
    console.error('Error requesting reactivation:', err);
    return res.status(500).json({ ok: false, message: 'Failed to request reactivation.' });
  }
};

export const checkSoloHouseholdDeceasedAutoConfirm = async () => {
  try {
    const NinetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const pendingDeceased = await prisma.pendingMemberStatusChange.findMany({
      where: {
        status: 'pending',
        new_status: 'deceased',
      },
    });

    for (const reqObj of pendingDeceased) {
      const hh = await prisma.household.findUnique({
        where: { id: reqObj.hh_id },
        include: { members: true },
      });

      // SOLO HOUSEHOLD ONLY (1 member in household)
      if (hh && (hh.members || []).length === 1) {
        const elapsed = now - new Date(reqObj.proposed_at).getTime();
        if (elapsed >= NinetyDaysMs) {
          await prisma.$transaction([
            prisma.member.update({
              where: { id: reqObj.member_id },
              data: {
                status: 'deceased',
                status_remarks: 'Auto-confirmed deceased after 90 days without response (Solo Household).',
                status_updated_at: new Date().toISOString(),
              },
            }),
            prisma.pendingMemberStatusChange.update({
              where: { id: reqObj.id },
              data: {
                status: 'auto_confirmed',
                reviewed_at: new Date().toISOString(),
                remarks: 'Auto-confirmed after 90 days (Solo Household rule).',
              },
            }),
          ]);
        }
      }
    }
  } catch (err) {
    console.error('Error in checkSoloHouseholdDeceasedAutoConfirm:', err);
  }
};

export const approveMemberAddition = async (req, res) => {
  try {
    const { id } = req.params;

    const reqObj = await prisma.pendingMemberAddition.findUnique({
      where: { id },
    });
    if (!reqObj) {
      return res.status(404).json({ ok: false, message: 'Request not found.' });
    }

    const hh = await prisma.household.findUnique({
      where: { id: reqObj.household_id },
    });

    const targetMember = await prisma.member.findUnique({
      where: { id: reqObj.member_id },
    });

    if (targetMember) {
      await prisma.member.update({
        where: { id: reqObj.member_id },
        data: { approval_status: 'approved' },
      });

      const activeCycles = await prisma.cycle.findMany({
        where: { is_active: true },
      });

      const memberSectors = parseJSONField(targetMember.sectors, []);
      for (const cycle of activeCycles) {
        if (memberSectors.includes(cycle.type)) {
          await prisma.qRCode.create({
            data: {
              id: 'qr-' + shortId() + Math.random().toString(36).substr(2, 4),
              qr_token: uuidv4(),
              cycle_id: cycle.id,
              cycle_name: cycle.name,
              cycle_type: cycle.type,
              household_id: reqObj.household_id,
              member_id: targetMember.id,
              type: 'member',
              is_claimed: false,
              claimed_at: null,
            },
          });
        }
      }
    }

    await prisma.pendingMemberAddition.update({
      where: { id },
      data: { status: 'approved' },
    });

    if (hh?.account_id) {
      await addNotification({
        recipient_id: hh.account_id,
        type: 'approval',
        title: 'Member Addition Approved',
        message: `Admin approved adding ${reqObj.member_name} to your household roster.`,
        link: '/beneficiary',
      });
    }

    return res.json({ ok: true, message: 'Member addition approved.' });
  } catch (err) {
    console.error('Error approving member addition:', err);
    return res.status(500).json({ ok: false, message: 'Failed to approve member addition.' });
  }
};

export const rejectMemberAddition = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const reqObj = await prisma.pendingMemberAddition.findUnique({
      where: { id },
    });
    if (!reqObj) {
      return res.status(404).json({ ok: false, message: 'Request not found.' });
    }

    const hh = await prisma.household.findUnique({
      where: { id: reqObj.household_id },
    });

    await prisma.member.delete({
      where: { id: reqObj.member_id },
    }).catch(() => {});

    await prisma.pendingMemberAddition.update({
      where: { id },
      data: { status: 'rejected' },
    });

    if (hh?.account_id) {
      await addNotification({
        recipient_id: hh.account_id,
        type: 'rejected',
        title: 'Member Addition Declined',
        message: `Admin declined adding ${reqObj.member_name} to your household.${reason ? ` Reason: ${reason}` : ''}`,
        link: '/beneficiary',
      });
    }

    return res.json({ ok: true, message: 'Member addition rejected.' });
  } catch (err) {
    console.error('Error rejecting member addition:', err);
    return res.status(500).json({ ok: false, message: 'Failed to reject member addition.' });
  }
};
