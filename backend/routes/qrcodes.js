import express from 'express';
import {
  getAllQRCodes,
  verifyQRToken,
  generateQRCodesForCycle,
  claimQRCode,
} from '../controllers/qrcodesController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';

const router = express.Router();

// Publicly accessible verification routes (works for phone camera scans and system verification)
router.get('/public-verify/:token', verifyQRToken);
router.get('/verify/:token', verifyQRToken);
router.get('/:token', verifyQRToken);

// Protected routes requiring authentication
router.use(requireAuth);

router.get('/', getAllQRCodes);
router.post('/generate', requireRoles('admin', 'staff'), generateQRCodesForCycle);
router.put('/:id/claim', requireRoles('admin', 'staff'), claimQRCode);

export default router;

