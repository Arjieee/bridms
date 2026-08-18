import { prisma } from '../db/prisma.js';
import { parseJSONField } from '../services/dbHelper.js';

export const getDashboardStats = async (req, res) => {
  try {
    const totalHouseholds = await prisma.household.count();
    const pendingRegs = await prisma.pendingRegistration.count({
      where: { status: 'pending' },
    });
    const activeCycles = await prisma.cycle.count({
      where: { is_active: true },
    });
    const totalDistributions = await prisma.distribution.count();

    const inventory = await prisma.inventoryItem.findMany();
    const lowStockCount = inventory.filter((i) => i.quantity <= i.low_threshold).length;
    const criticalStockCount = inventory.filter((i) => i.quantity <= i.critical_threshold).length;

    const activeCycleObj = await prisma.cycle.findFirst({
      where: { is_active: true },
    });

    let claimRate = 0;
    if (activeCycleObj) {
      const totalQRs = await prisma.qRCode.count({
        where: { cycle_id: activeCycleObj.id },
      });
      const claimedQRs = await prisma.qRCode.count({
        where: { cycle_id: activeCycleObj.id, is_claimed: true },
      });
      claimRate = totalQRs > 0 ? Math.round((claimedQRs / totalQRs) * 100) : 0;
    }

    return res.json({
      ok: true,
      stats: {
        totalHouseholds,
        pendingRegs,
        activeCycles,
        totalDistributions,
        lowStockCount,
        criticalStockCount,
        claimRate,
      },
    });
  } catch (err) {
    console.error('Error getting dashboard stats:', err);
    return res.status(500).json({ ok: false, message: 'Failed to compute dashboard stats.' });
  }
};

export const getDistributionsReport = async (req, res) => {
  try {
    const distributions = await prisma.distribution.findMany({
      orderBy: { recorded_at: 'desc' },
    });
    const totalCycles = await prisma.cycle.count();

    const formattedDistributions = distributions.map((d) => ({
      ...d,
      officials: parseJSONField(d.officials, []),
      items: parseJSONField(d.items, []),
    }));

    return res.json({
      ok: true,
      distributions: formattedDistributions,
      summary: {
        total_count: distributions.length,
        cycles_count: totalCycles,
      },
    });
  } catch (err) {
    console.error('Error fetching distributions report:', err);
    return res.status(500).json({ ok: false, message: 'Failed to fetch distributions report.' });
  }
};

export const getInventoryReport = async (req, res) => {
  try {
    const inventory = await prisma.inventoryItem.findMany({
      orderBy: { id: 'asc' },
    });
    const categories = await prisma.category.findMany({
      orderBy: { id: 'asc' },
    });

    return res.json({
      ok: true,
      inventory,
      categories,
      summary: {
        total_items: inventory.length,
        low_stock_items: inventory.filter((i) => i.quantity <= i.low_threshold),
        critical_items: inventory.filter((i) => i.quantity <= i.critical_threshold),
      },
    });
  } catch (err) {
    console.error('Error fetching inventory report:', err);
    return res.status(500).json({ ok: false, message: 'Failed to fetch inventory report.' });
  }
};
