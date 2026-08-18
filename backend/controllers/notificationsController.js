import { prisma } from '../db/prisma.js';

export const getNotificationsMe = async (req, res) => {
  try {
    const userNotifs = await prisma.notification.findMany({
      where: {
        OR: [
          { recipient_id: req.user.id },
          { recipient_role: req.user.role },
        ],
      },
      orderBy: { created_at: 'desc' },
      take: 100,
    });

    return res.json({ ok: true, notifications: userNotifs });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    return res.status(500).json({ ok: false, message: 'Failed to fetch notifications.' });
  }
};

export const markRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notif = await prisma.notification.findUnique({
      where: { id },
    });
    if (!notif) {
      return res.status(404).json({ ok: false, message: 'Notification not found.' });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: {
        is_read: true,
        read_at: new Date().toISOString(),
      },
    });

    return res.json({ ok: true, notification: updated });
  } catch (err) {
    console.error('Error marking notification as read:', err);
    return res.status(500).json({ ok: false, message: 'Failed to update notification.' });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const notif = await prisma.notification.findUnique({
      where: { id },
    });
    if (!notif) {
      return res.status(404).json({ ok: false, message: 'Notification not found.' });
    }

    await prisma.notification.delete({
      where: { id },
    });

    return res.json({ ok: true, message: 'Notification deleted.' });
  } catch (err) {
    console.error('Error deleting notification:', err);
    return res.status(500).json({ ok: false, message: 'Failed to delete notification.' });
  }
};
