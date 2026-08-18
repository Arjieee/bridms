import express from 'express';
import {
  getAllDistributions,
  recordDistribution,
  getDistributionsByCycle,
} from '../controllers/distributionsController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', getAllDistributions);
router.get('/cycle/:id', getDistributionsByCycle);
router.post('/', requireRoles('admin', 'staff'), recordDistribution);

export default router;
