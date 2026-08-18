import { shortId } from '../utils/qr.js';
import { prisma } from '../db/prisma.js';
import { notifyAdmins, parseJSONField } from '../services/dbHelper.js';

const formatSupplier = (s) => {
  if (!s) return null;
  return {
    ...s,
    items: parseJSONField(s.items, []),
  };
};

export const getAllSuppliers = async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { created_at: 'desc' },
    });
    return res.json({ ok: true, suppliers: suppliers.map(formatSupplier) });
  } catch (err) {
    console.error('Error fetching suppliers:', err);
    return res.status(500).json({ ok: false, message: 'Failed to fetch suppliers.' });
  }
};

export const addSupplier = async (req, res) => {
  try {
    const data = req.body;

    if (!data.org_name) {
      return res.status(400).json({ ok: false, message: 'Organization name is required.' });
    }

    const id = 'sup-' + shortId();
    const supCode = 'SUP-' + Date.now().toString().slice(-6);

    const sup = await prisma.supplier.create({
      data: {
        id,
        sup_code: supCode,
        org_name: data.org_name.trim(),
        contact_person: data.contact_person || null,
        contact_number: data.contact_number || null,
        email: data.email || null,
        items: JSON.stringify(data.items || []),
        recorded_by: req.user.id,
      },
    });

    await notifyAdmins({
      type: 'donation',
      title: 'New Donation Recorded',
      message: `Donation from "${data.org_name}" recorded. Review and update inventory.`,
      link: '/admin/inventory',
    });

    return res.status(201).json({ ok: true, supplier: formatSupplier(sup) });
  } catch (err) {
    console.error('Error adding supplier:', err);
    return res.status(500).json({ ok: false, message: 'Failed to add supplier donation record.' });
  }
};

export const deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    const target = await prisma.supplier.findUnique({
      where: { id },
    });
    if (!target) {
      return res.status(404).json({ ok: false, message: 'Supplier record not found.' });
    }

    await prisma.supplier.delete({
      where: { id },
    });

    return res.json({ ok: true, message: 'Supplier record deleted.' });
  } catch (err) {
    console.error('Error deleting supplier:', err);
    return res.status(500).json({ ok: false, message: 'Failed to delete supplier record.' });
  }
};

export const fulfillSupplierItem = async (req, res) => {
  try {
    const { id, itemIndex } = req.params;

    const supplier = await prisma.supplier.findUnique({
      where: { id },
    });
    if (!supplier) {
      return res.status(404).json({ ok: false, message: 'Supplier record not found.' });
    }

    const items = parseJSONField(supplier.items, []);
    const indexNum = parseInt(itemIndex);

    if (items && items[indexNum]) {
      items[indexNum].fulfilled = true;
    }

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        items: JSON.stringify(items),
      },
    });

    return res.json({ ok: true, supplier: formatSupplier(updated) });
  } catch (err) {
    console.error('Error fulfilling supplier item:', err);
    return res.status(500).json({ ok: false, message: 'Failed to update supplier item status.' });
  }
};
