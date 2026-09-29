import { prisma } from '../db/prisma.js';
import { addActivityLog } from '../services/dbHelper.js';

export const getPuroks = async (req, res) => {
  try {
    const puroks = await prisma.purok.findMany({
      orderBy: { id: 'asc' },
    });
    return res.json({ ok: true, puroks });
  } catch (err) {
    console.error('Error fetching puroks:', err);
    return res.status(500).json({ ok: false, message: 'Failed to fetch puroks.' });
  }
};

export const addPurok = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ ok: false, message: 'Purok name is required.' });
    }

    const newPurok = await prisma.purok.create({
      data: {
        name: name.trim(),
        is_active: true,
        is_archived: false,
      },
    });

    return res.status(201).json({ ok: true, purok: newPurok });
  } catch (err) {
    console.error('Error adding purok:', err);
    return res.status(500).json({ ok: false, message: 'Failed to add purok.' });
  }
};

export const updatePurok = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name } = req.body;

    const purok = await prisma.purok.findUnique({
      where: { id },
    });
    if (!purok) {
      return res.status(404).json({ ok: false, message: 'Purok not found.' });
    }

    const updated = await prisma.purok.update({
      where: { id },
      data: { name: name ? name.trim() : purok.name },
    });

    return res.json({ ok: true, purok: updated });
  } catch (err) {
    console.error('Error updating purok:', err);
    return res.status(500).json({ ok: false, message: 'Failed to update purok.' });
  }
};

export const deletePurok = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const purok = await prisma.purok.findUnique({
      where: { id },
    });
    if (!purok) {
      return res.status(404).json({ ok: false, message: 'Purok not found.' });
    }

    const updated = await prisma.purok.update({
      where: { id },
      data: {
        is_archived: true,
        is_active: false,
      },
    });

    return res.json({ ok: true, message: `Purok "${updated.name}" safely archived to Backup Vault.` });
  } catch (err) {
    console.error('Error archiving purok:', err);
    return res.status(500).json({ ok: false, message: 'Failed to archive purok.' });
  }
};

export const restorePurok = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const purok = await prisma.purok.findUnique({
      where: { id },
    });
    if (!purok) {
      return res.status(404).json({ ok: false, message: 'Purok not found.' });
    }

    const updated = await prisma.purok.update({
      where: { id },
      data: {
        is_archived: false,
        is_active: true,
      },
    });

    return res.json({ ok: true, message: `Purok "${updated.name}" restored successfully.`, purok: updated });
  } catch (err) {
    console.error('Error restoring purok:', err);
    return res.status(500).json({ ok: false, message: 'Failed to restore purok.' });
  }
};

export const getSectors = async (req, res) => {
  try {
    const sectors = await prisma.sector.findMany({
      orderBy: { id: 'asc' },
    });

    const standardPkgRows = await prisma.standardPackage.findMany();
    const standardPackages = {};

    standardPkgRows.forEach((row) => {
      if (!standardPackages[row.sector_code]) {
        standardPackages[row.sector_code] = [];
      }
      standardPackages[row.sector_code].push({
        item_id: row.item_id,
        item_name: row.item_name,
        quantity: row.quantity,
        unit: row.unit,
      });
    });

    return res.json({ ok: true, sectors, standardPackages });
  } catch (err) {
    console.error('Error fetching sectors:', err);
    return res.status(500).json({ ok: false, message: 'Failed to fetch sectors.' });
  }
};

export const addSector = async (req, res) => {
  try {
    const { name, code: customCode, standardPackage } = req.body;

    if (!name) {
      return res.status(400).json({ ok: false, message: 'Sector name is required.' });
    }

    const code = (customCode || name).toLowerCase().replace(/[^a-z0-9_]/g, '_');

    const existing = await prisma.sector.findUnique({
      where: { code },
    });
    if (existing) {
      return res.status(400).json({ ok: false, message: 'A sector with that code already exists.' });
    }

    const newSector = await prisma.sector.create({
      data: {
        code,
        name: name.trim(),
        custom: true,
      },
    });

    if (Array.isArray(standardPackage)) {
      for (const item of standardPackage) {
        await prisma.standardPackage.create({
          data: {
            sector_code: code,
            item_id: item.item_id || null,
            item_name: item.item_name || 'Standard Item',
            quantity: parseFloat(item.quantity) || 1,
            unit: item.unit || 'pcs',
          },
        });
      }
    }

    return res.status(201).json({ ok: true, sector: newSector, code });
  } catch (err) {
    console.error('Error adding sector:', err);
    return res.status(500).json({ ok: false, message: 'Failed to add sector.' });
  }
};

export const getActivityLogs = async (req, res) => {
  try {
    const activityLogs = await prisma.activityLog.findMany({
      orderBy: { created_at: 'desc' },
      take: 200,
    });

    return res.json({
      ok: true,
      activityLogs: activityLogs.map((l) => ({
        ...l,
        login_at: l.created_at.toISOString(),
      })),
    });
  } catch (err) {
    console.error('Error fetching activity logs:', err);
    return res.status(500).json({ ok: false, message: 'Failed to fetch activity logs.' });
  }
};

export const updateStandardPackage = async (req, res) => {
  try {
    const { sector_code } = req.params;
    const { items } = req.body;

    if (!sector_code) {
      return res.status(400).json({ ok: false, message: 'Sector code is required.' });
    }
    if (!Array.isArray(items)) {
      return res.status(400).json({ ok: false, message: 'Items array is required.' });
    }

    const cleanSectorCode = sector_code.trim().toLowerCase();

    // Delete existing package items for this sector_code
    await prisma.standardPackage.deleteMany({
      where: { sector_code: cleanSectorCode },
    });

    const allInv = await prisma.inventoryItem.findMany();
    const createdItems = [];

    for (const it of items) {
      let matchedInv = null;
      if (it.item_id) {
        matchedInv = allInv.find((inv) => inv.id === Number(it.item_id));
      }
      if (!matchedInv && it.item_name && it.unit) {
        matchedInv = allInv.find(
          (inv) =>
            inv.name.trim().toLowerCase() === it.item_name.trim().toLowerCase() &&
            inv.unit.trim().toLowerCase() === it.unit.trim().toLowerCase()
        );
      }

      const qty = parseFloat(it.quantity) || 1;
      if (qty > 0) {
        const newPkg = await prisma.standardPackage.create({
          data: {
            sector_code: cleanSectorCode,
            item_id: matchedInv ? matchedInv.id : (Number(it.item_id) || null),
            item_name: matchedInv?.name || it.item_name || 'Standard Item',
            quantity: qty,
            unit: matchedInv?.unit || it.unit || 'pcs',
          },
        });
        createdItems.push(newPkg);
      }
    }

    await addActivityLog({
      account_id: req.user?.id,
      username: req.user?.username,
      role: req.user?.role,
      action: 'updated_standard_package',
      details: `Updated standard package template for sector "${cleanSectorCode}" (${createdItems.length} items)`,
    });

    return res.json({
      ok: true,
      message: `Standard package template for sector "${cleanSectorCode}" updated successfully.`,
      sector_code: cleanSectorCode,
      items: createdItems,
    });
  } catch (err) {
    console.error('Error updating standard package:', err);
    return res.status(500).json({ ok: false, message: 'Failed to update standard package.' });
  }
};

