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

router.use(requireAuth);

router.get('/', getAllQRCodes);
router.get('/:token', verifyQRToken);
router.post('/generate', requireRoles('admin'), generateQRCodesForCycle);
router.put('/:id/claim', requireRoles('admin', 'staff'), claimQRCode);

export default router;
