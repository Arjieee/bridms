import { prisma } from '../db/prisma.js';
import { shortId } from '../utils/qr.js';
import { addActivityLog, adjustStock, parseJSONField } from '../services/dbHelper.js';

/**
 * Search or list donors (Supports ?q= query param for real-time autocomplete suggestions)
 */
export const getDonors = async (req, res) => {
  try {
    const { q } = req.query;

    let donors;
    if (q && q.trim()) {
      const term = `%${q.trim()}%`;
      donors = await prisma.$queryRawUnsafe(
        `SELECT id, donor_code, name, donor_type, contact_person, contact_number, email, address, 
                COALESCE(donation_date, DATE(created_at)) as donation_date, created_at, created_by
         FROM Donor
         WHERE name LIKE ? OR contact_person LIKE ? OR donor_type LIKE ?
         ORDER BY name ASC LIMIT 25`,
        term, term, term
      );
    } else {
      donors = await prisma.$queryRawUnsafe(
        `SELECT id, donor_code, name, donor_type, contact_person, contact_number, email, address, 
                COALESCE(donation_date, DATE(created_at)) as donation_date, created_at, created_by
         FROM Donor
         ORDER BY name ASC LIMIT 25`
      );
    }

    return res.json({ ok: true, donors });
  } catch (err) {
    console.error('Error fetching donors:', err);
    return res.status(500).json({ ok: false, message: 'Failed to fetch donors.' });
  }
};

/**
 * Register a new donor
 */
export const createDonor = async (req, res) => {
  try {
    const { name, donor_type, contact_person, contact_number, email, address, donation_date } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ ok: false, message: 'Donor / Organization name is required.' });
    }

    const cleanName = name.trim();

    // Check if donor already exists with similar name
    const existing = await prisma.$queryRawUnsafe(
      'SELECT id, donor_code, name, donor_type, contact_person, contact_number, email, address, COALESCE(donation_date, DATE(created_at)) as donation_date FROM Donor WHERE LOWER(name) = LOWER(?)',
      cleanName
    );
    if (existing && existing.length > 0) {
      return res.status(200).json({ ok: true, donor: existing[0], existing: true });
    }

    const countRes = await prisma.$queryRawUnsafe('SELECT COUNT(*) as total FROM Donor');
    const totalCount = Number(countRes[0]?.total || 0);
    const donorCode = 'DNR-' + String(totalCount + 1).padStart(3, '0');
    const donorId = 'dn-' + shortId();
    const donationDateStr = donation_date || new Date().toISOString().split('T')[0];
    const createdAtStr = new Date().toISOString();
    const createdBy = req.user?.username || req.user?.id || 'admin';

    await prisma.$executeRawUnsafe(
      `INSERT INTO Donor (id, donor_code, name, donor_type, contact_person, contact_number, email, address, donation_date, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      donorId,
      donorCode,
      cleanName,
      donor_type || 'organization',
      contact_person?.trim() || null,
      contact_number?.trim() || null,
      email?.trim() || null,
      address?.trim() || null,
      donationDateStr,
      createdAtStr,
      createdBy
    );

    const newDonor = {
      id: donorId,
      donor_code: donorCode,
      name: cleanName,
      donor_type: donor_type || 'organization',
      contact_person: contact_person?.trim() || null,
      contact_number: contact_number?.trim() || null,
      email: email?.trim() || null,
      address: address?.trim() || null,
      donation_date: donationDateStr,
      created_at: createdAtStr,
      created_by: createdBy,
    };

    await addActivityLog({
      account_id: req.user?.id,
      username: req.user?.username,
      role: req.user?.role,
      action: 'created_donor',
      details: `Registered donor "${newDonor.name}" (${newDonor.donor_code})`,
    });

    return res.status(201).json({ ok: true, donor: newDonor });
  } catch (err) {
    console.error('Error creating donor:', err);
    return res.status(500).json({ ok: false, message: 'Failed to create donor.' });
  }
};

/**
 * Get all receiving transactions (chronological history)
 */
export const getAllReceiving = async (req, res) => {
  try {
    const receivings = await prisma.receiving.findMany({
      include: {
        donor: true,
      },
      orderBy: { date: 'desc' },
    });

    const formatted = receivings.map((r) => ({
      ...r,
      items: parseJSONField(r.items, []),
    }));

    return res.json({ ok: true, receivings: formatted });
  } catch (err) {
    console.error('Error fetching receiving batches:', err);
    return res.status(500).json({ ok: false, message: 'Failed to fetch receiving batches.' });
  }
};

/**
 * Record an item receiving batch (Donation)
 * - Resolves or creates Donor
 * - Validates Category for each item
 * - Increments inventory stock / creates new InventoryItem with selected Category
 * - Inserts StockLedger entry with updated running balance
 * - Creates Receiving record
 * - Updates Donor's donation_date to latest receiving date
 */
export const createReceiving = async (req, res) => {
  try {
    const {
      donor_id,
      donor_name,
      donor_type,
      contact_person,
      contact_number,
      email,
      items,
      notes,
      date,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ ok: false, message: 'At least one item must be received.' });
    }

    // Validate that category is identified for all items
    for (const rawItem of items) {
      const itemName = (rawItem.item_name || rawItem.name || '').trim();
      const qty = parseFloat(rawItem.quantity || rawItem.qty);
      if (!itemName || isNaN(qty) || qty <= 0) continue;

      if (!rawItem.category_id && !rawItem.item_id) {
        return res.status(400).json({
          ok: false,
          message: `Category is required for item "${itemName}". Please select a category before saving.`,
        });
      }
    }

    // 1. Resolve Donor
    let targetDonor = null;
    if (donor_id) {
      targetDonor = await prisma.donor.findUnique({
        where: { id: donor_id },
      });
    }

    if (!targetDonor && donor_name && donor_name.trim()) {
      const cleanName = donor_name.trim();
      targetDonor = await prisma.donor.findFirst({
        where: { name: cleanName },
      });

      if (!targetDonor) {
        const countRes = await prisma.$queryRawUnsafe('SELECT COUNT(*) as total FROM Donor');
        const totalDonors = Number(countRes[0]?.total || 0);
        const donorCode = 'DNR-' + String(totalDonors + 1).padStart(3, '0');
        const donorId = 'dn-' + shortId();
        const donationDateStr = date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        const createdAtStr = new Date().toISOString();
        const createdBy = req.user?.username || req.user?.id || 'admin';

        await prisma.$executeRawUnsafe(
          `INSERT INTO Donor (id, donor_code, name, donor_type, contact_person, contact_number, email, donation_date, created_at, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          donorId,
          donorCode,
          cleanName,
          donor_type || 'organization',
          contact_person?.trim() || null,
          contact_number?.trim() || null,
          email?.trim() || null,
          donationDateStr,
          createdAtStr,
          createdBy
        );

        targetDonor = {
          id: donorId,
          donor_code: donorCode,
          name: cleanName,
          donor_type: donor_type || 'organization',
        };
      }
    }

    if (!targetDonor) {
      return res.status(400).json({ ok: false, message: 'Valid donor or donor name is required.' });
    }

    const receiveCode = 'RCV-' + Date.now().toString().slice(-8);
    const receivingId = 'rcv-' + shortId();
    const processedItems = [];

    // 2. Process each item: adjust stock & record into stock ledger
    for (const rawItem of items) {
      const itemName = (rawItem.item_name || rawItem.name || '').trim();
      const qty = parseFloat(rawItem.quantity || rawItem.qty);
      const uom = (rawItem.uom || rawItem.unit || 'pcs').trim();

      if (!itemName || isNaN(qty) || qty <= 0) {
        continue;
      }

      // Check if inventory item already exists with matching name AND unit AND donor
      let invItem = null;
      if (rawItem.item_id) {
        const potential = await prisma.inventoryItem.findUnique({
          where: { id: Number(rawItem.item_id) },
        });
        if (
          potential &&
          potential.unit.trim().toLowerCase() === uom.toLowerCase() &&
          ((potential.donor_id && potential.donor_id === targetDonor.id) ||
            (!potential.donor_id && (!potential.donor_name || potential.donor_name === targetDonor.name)))
        ) {
          invItem = potential;
        }
      }

      if (!invItem) {
        // Match by exact name AND exact unit AND specific donor (donor_id or donor_name)
        const allItems = await prisma.inventoryItem.findMany();
        invItem = allItems.find(
          (i) =>
            i.name.trim().toLowerCase() === itemName.toLowerCase() &&
            i.unit.trim().toLowerCase() === uom.toLowerCase() &&
            (i.donor_id === targetDonor.id ||
              (i.donor_name && i.donor_name.trim().toLowerCase() === targetDonor.name.trim().toLowerCase()))
        );
      }

      let updatedItem = null;
      if (invItem) {
        // Increment stock and record in StockLedger with donor attribution
        updatedItem = await adjustStock(
          invItem.id,
          qty,
          'in',
          `Received from Donor: ${targetDonor.name} (+${qty} ${invItem.unit})`,
          {
            reference_id: receiveCode,
            donor_name: targetDonor.name,
            recorded_by: req.user?.username || req.user?.full_name || req.user?.id,
          }
        );
      } else {
        // Create new inventory item attributed specifically to this donor
        const maxItem = await prisma.inventoryItem.findFirst({
          orderBy: { id: 'desc' },
          select: { id: true },
        });
        const nextId = (maxItem?.id || 0) + 1;
        const itemCode = 'INV-' + String(nextId).padStart(3, '0');
        const categoryId = Number(rawItem.category_id) || 1;

        invItem = await prisma.inventoryItem.create({
          data: {
            id: nextId,
            item_code: itemCode,
            name: itemName,
            category_id: categoryId,
            unit: uom,
            quantity: qty,
            low_threshold: 15,
            critical_threshold: 5,
            donor_id: targetDonor.id,
            donor_name: targetDonor.name,
            is_repacked: false,
          },
        });

        // Record initial StockLedger entry with donor_name
        await prisma.stockLedger.create({
          data: {
            id: 'ledg-' + shortId() + Math.random().toString(36).substr(2, 3),
            item_id: invItem.id,
            item_name: invItem.name,
            date: new Date(),
            type: 'in',
            qty: qty,
            balance_after: qty,
            description: `Initial Stock from Donor: ${targetDonor.name}`,
            reference_id: receiveCode,
            donor_name: targetDonor.name,
            recorded_by: req.user?.username || req.user?.full_name || req.user?.id,
          },
        });

        updatedItem = invItem;
      }

      processedItems.push({
        item_id: invItem.id,
        item_name: invItem.name,
        category_id: invItem.category_id,
        quantity: qty,
        uom: uom || invItem.unit,
        remarks: rawItem.remarks || null,
        new_balance: updatedItem?.quantity || qty,
      });
    }

    if (processedItems.length === 0) {
      return res.status(400).json({ ok: false, message: 'No valid items with positive quantities were provided.' });
    }

    // 3. Save Receiving Batch Record
    const receivingRecord = await prisma.receiving.create({
      data: {
        id: receivingId,
        receive_code: receiveCode,
        donor_id: targetDonor.id,
        date: date ? new Date(date) : new Date(),
        items: JSON.stringify(processedItems),
        total_items: processedItems.length,
        notes: notes?.trim() || null,
        received_by: req.user?.full_name || req.user?.username || 'Staff',
      },
      include: {
        donor: true,
      },
    });

    // 4. Update Donor's donation_date to latest donation date
    const receivingDateStr = date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    await prisma.$executeRawUnsafe(
      'UPDATE Donor SET donation_date = ? WHERE id = ?',
      receivingDateStr,
      targetDonor.id
    );

    await addActivityLog({
      account_id: req.user?.id,
      username: req.user?.username,
      role: req.user?.role,
      action: 'received_donation',
      details: `Received ${processedItems.length} item(s) from "${targetDonor.name}" (${receiveCode})`,
    });

    return res.status(201).json({
      ok: true,
      message: `Successfully received ${processedItems.length} item(s) from ${targetDonor.name}.`,
      receiving: {
        ...receivingRecord,
        items: processedItems,
      },
    });
  } catch (err) {
    console.error('Error creating receiving batch:', err);
    return res.status(500).json({ ok: false, message: 'Failed to record item receiving.' });
  }
};
