import { shortId } from '../utils/qr.js';
import { prisma } from '../db/prisma.js';
import { notifyAdmins } from '../services/dbHelper.js';

/**
 * Get all donors (Suppliers module displays donor information only)
 * Fields: Organization / Donor Name, Contact Person, Contact Number, Donation Date, Donor Type
 */
export const getAllSuppliers = async (req, res) => {
  try {
    const donors = await prisma.$queryRawUnsafe(`
      SELECT 
        d.id,
        d.donor_code,
        d.name as org_name,
        d.name,
        d.donor_type,
        d.contact_person,
        d.contact_number,
        d.contact_number as contact_num,
        d.email,
        COALESCE(d.donation_date, DATE(d.created_at)) as donation_date,
        d.created_at,
        d.created_by
      FROM Donor d
      ORDER BY d.created_at DESC
    `);

    return res.json({ ok: true, suppliers: donors });
  } catch (err) {
    console.error('Error fetching suppliers/donors:', err);
    return res.status(500).json({ ok: false, message: 'Failed to fetch donors.' });
  }
};

/**
 * Record a donor (Organization / Donor Name, Contact Person, Contact Number, Donation Date, Donor Type)
 */
export const addSupplier = async (req, res) => {
  try {
    const data = req.body;
    const orgName = (data.org_name || data.name || '').trim();

    if (!orgName) {
      return res.status(400).json({ ok: false, message: 'Organization / Donor name is required.' });
    }

    const id = 'dn-' + shortId();
    const countRes = await prisma.$queryRawUnsafe('SELECT COUNT(*) as total FROM Donor');
    const totalCount = Number(countRes[0]?.total || 0);
    const donorCode = 'DNR-' + String(totalCount + 1).padStart(3, '0');
    const donationDate = data.donation_date || new Date().toISOString().split('T')[0];
    const contactPerson = data.contact_person?.trim() || null;
    const contactNumber = (data.contact_number || data.contact_num)?.trim() || null;
    const donorType = data.donor_type?.trim() || 'Organization';
    const email = data.email?.trim() || null;
    const createdBy = req.user?.username || req.user?.id || 'admin';
    const createdAt = new Date().toISOString();

    await prisma.$executeRawUnsafe(
      `INSERT INTO Donor (id, donor_code, name, donor_type, contact_person, contact_number, email, donation_date, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, donorCode, orgName, donorType, contactPerson, contactNumber, email, donationDate, createdAt, createdBy
    );

    const createdDonor = {
      id,
      donor_code: donorCode,
      org_name: orgName,
      name: orgName,
      contact_person: contactPerson,
      contact_number: contactNumber,
      contact_num: contactNumber,
      donation_date: donationDate,
      donor_type: donorType,
      email,
      created_at: createdAt,
    };

    await notifyAdmins({
      type: 'donation',
      title: 'New Donor Registered',
      message: `Donor "${orgName}" registered. Receive goods via Receiving Donors.`,
      link: '/admin/receiving',
    });

    return res.status(201).json({ ok: true, supplier: createdDonor });
  } catch (err) {
    console.error('Error adding supplier/donor:', err);
    return res.status(500).json({ ok: false, message: 'Failed to record donor.' });
  }
};
