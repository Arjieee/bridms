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
router.post('/', requireRoles('admin', 'staff'), addSupplier);
router.put('/:id/items/:itemIndex/fulfill', requireRoles('admin', 'staff'), fulfillSupplierItem);
router.delete('/:id', requireRoles('admin', 'staff'), deleteSupplier);

export default router;
