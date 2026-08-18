import express from 'express';
import {
  getAllCycles,
  createCycle,
  activateCycle,
  deactivateCycle,
} from '../controllers/cyclesController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', getAllCycles);
router.post('/', requireRoles('admin'), createCycle);
router.put('/:id/activate', requireRoles('admin'), activateCycle);
router.put('/:id/deactivate', requireRoles('admin'), deactivateCycle);

export default router;
