import express from 'express';
import {
  getAllAccounts,
  createAccount,
  getMe,
  updateAccount,
  deleteAccount,
  terminateOtherSessions,
  getAuditLogs,
} from '../controllers/accountsController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';

const router = express.Router();

router.use(requireAuth);

router.get('/me', getMe);
router.post('/terminate-sessions', terminateOtherSessions);
router.get('/audit-logs', requireRoles('admin', 'staff'), getAuditLogs);
router.get('/', requireRoles('admin'), getAllAccounts);
router.post('/', requireRoles('admin'), createAccount);
router.put('/:id', updateAccount);
router.delete('/:id', requireRoles('admin'), deleteAccount);

export default router;
