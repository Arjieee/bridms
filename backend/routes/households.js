import express from 'express';
import {
  getApprovedHouseholds,
  getPendingRegistrations,
  getHouseholdById,
  registerHousehold,
  updateHousehold,
  approveRegistration,
  rejectRegistration,
} from '../controllers/householdsController.js';
import {
  addMember,
  updateMember,
  removeMember,
} from '../controllers/membersController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';

const router = express.Router();

// Self registration does not require auth
router.post('/', registerHousehold);

// All other endpoints require authentication
router.use(requireAuth);

router.get('/', getApprovedHouseholds);
router.get('/pending', requireRoles('admin'), getPendingRegistrations);
router.get('/:id', getHouseholdById);
router.put('/:id', requireRoles('admin'), updateHousehold);
router.post('/:id/approve', requireRoles('admin'), approveRegistration);
router.post('/:id/reject', requireRoles('admin'), rejectRegistration);

// Member endpoints under /api/households/:id/members
router.post('/:id/members', addMember);
router.put('/:id/members/:mid', updateMember);
router.delete('/:id/members/:mid', requireRoles('admin'), removeMember);

export default router;
