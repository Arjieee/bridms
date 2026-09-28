import express from 'express';
import {
  getDonors,
  createDonor,
  getAllReceiving,
  createReceiving,
} from '../controllers/receivingController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';

const router = express.Router();

router.use(requireAuth);

// Donors endpoints
router.get('/donors', getDonors);
router.post('/donors', requireRoles('admin', 'staff'), createDonor);

// Receiving batches endpoints
router.get('/', getAllReceiving);
router.post('/', requireRoles('admin', 'staff'), createReceiving);

export default router;
