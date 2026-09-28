import express from 'express';
import {
  getAllSuppliers,
  addSupplier,
} from '../controllers/suppliersController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', getAllSuppliers);
router.post('/', requireRoles('admin', 'staff'), addSupplier);

export default router;
