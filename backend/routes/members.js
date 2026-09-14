import express from 'express';
import {
  getStatusChanges,
  proposeStatusChange,
  confirmStatusChange,
  disputeStatusChange,
  requestReactivation,
  approveMemberAddition,
  rejectMemberAddition,
} from '../controllers/membersController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', getStatusChanges);
router.post('/', requireRoles('admin', 'staff'), proposeStatusChange);
router.post('/request-reactivation', requestReactivation);
router.put('/:id/confirm', confirmStatusChange);
router.put('/:id/dispute', disputeStatusChange);

router.post('/additions/:id/approve', requireRoles('admin', 'staff'), approveMemberAddition);
router.post('/additions/:id/reject', requireRoles('admin', 'staff'), rejectMemberAddition);

export default router;
