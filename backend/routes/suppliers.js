import express from 'express';
import {
  getAllSuppliers,
  addSupplier,
  deleteSupplier,
  fulfillSupplierItem,
} from '../controllers/suppliersController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', getAllSuppliers);
router.post('/', requireRoles('admin'), addSupplier);
router.put('/:id/items/:itemIndex/fulfill', requireRoles('admin'), fulfillSupplierItem);
router.delete('/:id', requireRoles('admin'), deleteSupplier);

export default router;
