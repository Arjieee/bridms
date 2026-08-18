import express from 'express';
import {
  getDashboardStats,
  getDistributionsReport,
  getInventoryReport,
} from '../controllers/reportsController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';

const router = express.Router();

router.use(requireAuth, requireRoles('admin', 'staff'));

router.get('/dashboard', getDashboardStats);
router.get('/distributions', getDistributionsReport);
router.get('/inventory', getInventoryReport);

export default router;
