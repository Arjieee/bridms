import express from 'express';
import {
  getNotificationsMe,
  markRead,
  deleteNotification,
} from '../controllers/notificationsController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);

router.get('/me', getNotificationsMe);
router.put('/:id/read', markRead);
router.delete('/:id', deleteNotification);

export default router;
