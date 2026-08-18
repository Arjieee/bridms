import { prisma } from '../db/prisma.js';
import { addActivityLog, adjustStock } from '../services/dbHelper.js';

export const getAllInventory = async (req, res) => {
  try {
    const inventory = await prisma.inventoryItem.findMany({
      orderBy: { id: 'asc' },
    });
    return res.json({ ok: true, inventory });
  } catch (err) {
    console.error('Error fetching inventory:', err);
    return res.status(500).json({ ok: false, message: 'Failed to fetch inventory items.' });
  }
};

export const addItem = async (req, res) => {
  try {
    const item = req.body;

    if (!item.name || !item.category_id || !item.unit) {
      return res.status(400).json({ ok: false, message: 'Name, category_id, and unit are required.' });
    }

    const cleanName = item.name.trim();
    const cleanUnit = item.unit.trim();
    const categoryId = Number(item.category_id);
    const addQty = parseFloat(item.quantity) || 0;

    // Check for existing item with case-insensitive name and matching category or unit
    const allItems = await prisma.inventoryItem.findMany();
    const existing = allItems.find(
      (i) =>
        i.name.trim().toLowerCase() === cleanName.toLowerCase() &&
        (Number(i.category_id) === categoryId || i.unit.trim().toLowerCase() === cleanUnit.toLowerCase())
    );

    if (existing) {
      const newQty = (parseFloat(existing.quantity) || 0) + addQty;
      const dataToUpdate = { quantity: newQty };
      if (item.low_threshold) dataToUpdate.low_threshold = parseFloat(item.low_threshold);
      if (item.critical_threshold) dataToUpdate.critical_threshold = parseFloat(item.critical_threshold);

      const updatedItem = await prisma.inventoryItem.update({
        where: { id: existing.id },
        data: dataToUpdate,
      });

      await addActivityLog({
        account_id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        action: 'merged_inventory_item',
        details: `Merged +${addQty} ${existing.unit} into "${existing.name}" (Total: ${newQty} ${existing.unit})`,
      });

      return res.status(200).json({
        ok: true,
        merged: true,
        message: `Merged +${addQty} ${existing.unit} into existing item "${existing.name}". New total stock: ${newQty} ${existing.unit}.`,
        item: updatedItem,
      });
    }

    const maxItem = await prisma.inventoryItem.findFirst({
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    const nextId = (maxItem?.id || 0) + 1;
    const itemCode = 'INV-' + String(nextId).padStart(3, '0');

    const newItem = await prisma.inventoryItem.create({
      data: {
        id: nextId,
        item_code: itemCode,
        name: cleanName,
        category_id: categoryId,
        unit: cleanUnit,
        quantity: addQty,
        low_threshold: parseFloat(item.low_threshold) || 15,
        critical_threshold: parseFloat(item.critical_threshold) || 5,
      },
    });

    await addActivityLog({
      account_id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      action: 'added_inventory_item',
      details: `Added ${newItem.name} (${newItem.quantity} ${newItem.unit})`,
    });

    return res.status(201).json({ ok: true, merged: false, item: newItem });
  } catch (err) {
    console.error('Error adding inventory item:', err);
    return res.status(500).json({ ok: false, message: 'Failed to add inventory item.' });
  }
};

export const updateItem = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;

    const item = await prisma.inventoryItem.findUnique({
      where: { id },
    });
    if (!item) {
      return res.status(404).json({ ok: false, message: 'Inventory item not found.' });
    }

    const dataToUpdate = {};
    if (updates.name !== undefined) dataToUpdate.name = updates.name.trim();
    if (updates.category_id !== undefined) dataToUpdate.category_id = Number(updates.category_id);
    if (updates.unit !== undefined) dataToUpdate.unit = updates.unit.trim();
    if (updates.quantity !== undefined) dataToUpdate.quantity = parseFloat(updates.quantity);
    if (updates.low_threshold !== undefined) dataToUpdate.low_threshold = parseFloat(updates.low_threshold);
    if (updates.critical_threshold !== undefined) dataToUpdate.critical_threshold = parseFloat(updates.critical_threshold);

    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: dataToUpdate,
    });

    return res.json({ ok: true, item: updated });
  } catch (err) {
    console.error('Error updating inventory item:', err);
    return res.status(500).json({ ok: false, message: 'Failed to update inventory item.' });
  }
};

export const deleteItem = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const item = await prisma.inventoryItem.findUnique({
      where: { id },
    });
    if (!item) {
      return res.status(404).json({ ok: false, message: 'Inventory item not found.' });
    }

    await prisma.inventoryItem.delete({
      where: { id },
    });

    return res.json({ ok: true, message: 'Item deleted successfully.' });
  } catch (err) {
    console.error('Error deleting inventory item:', err);
    return res.status(500).json({ ok: false, message: 'Failed to delete inventory item.' });
  }
};

export const stockIn = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { quantity, remarks } = req.body;

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ ok: false, message: 'Valid positive quantity required.' });
    }

    const item = await prisma.inventoryItem.findUnique({
      where: { id },
    });
    if (!item) {
      return res.status(404).json({ ok: false, message: 'Inventory item not found.' });
    }

    const updated = await adjustStock(id, qty, 'in', remarks || 'Manual Stock In');
    return res.json({ ok: true, message: `Added ${qty} ${item.unit} to ${item.name}.`, item: updated });
  } catch (err) {
    console.error('Error during stock in:', err);
    return res.status(500).json({ ok: false, message: 'Failed to stock in item.' });
  }
};

export const stockOut = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { quantity, remarks } = req.body;

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ ok: false, message: 'Valid positive quantity required.' });
    }

    const item = await prisma.inventoryItem.findUnique({
      where: { id },
    });
    if (!item) {
      return res.status(404).json({ ok: false, message: 'Inventory item not found.' });
    }

    if (item.quantity < qty) {
      return res.status(400).json({ ok: false, message: `Insufficient stock. Current quantity: ${item.quantity}` });
    }

    const updated = await adjustStock(id, qty, 'out', remarks || 'Manual Stock Out');
    return res.json({ ok: true, message: `Deducted ${qty} ${item.unit} from ${item.name}.`, item: updated });
  } catch (err) {
    console.error('Error during stock out:', err);
    return res.status(500).json({ ok: false, message: 'Failed to stock out item.' });
  }
};
