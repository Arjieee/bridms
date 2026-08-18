import express from 'express';
import {
  getPuroks,
  addPurok,
  updatePurok,
  deletePurok,
  restorePurok,
  getSectors,
  addSector,
  getActivityLogs,
} from '../controllers/settingsController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';

const router = express.Router();

router.use(requireAuth);

router.get('/puroks', getPuroks);
router.post('/puroks', requireRoles('admin'), addPurok);
router.put('/puroks/:id', requireRoles('admin'), updatePurok);
router.delete('/puroks/:id', requireRoles('admin'), deletePurok);
router.put('/puroks/:id/restore', requireRoles('admin'), restorePurok);

router.get('/sectors', getSectors);
router.post('/sectors', requireRoles('admin'), addSector);

router.get('/activity', requireRoles('admin'), getActivityLogs);

export default router;
