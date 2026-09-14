import express from 'express';
import {
  getAllInventory,
  addItem,
  updateItem,
  deleteItem,
  stockIn,
  stockOut,
} from '../controllers/inventoryController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', getAllInventory);
router.post('/', requireRoles('admin', 'staff'), addItem);
router.put('/:id', requireRoles('admin', 'staff'), updateItem);
router.delete('/:id', requireRoles('admin', 'staff'), deleteItem);
router.post('/:id/stock-in', requireRoles('admin', 'staff'), stockIn);
router.post('/:id/stock-out', requireRoles('admin', 'staff'), stockOut);

export default router;
