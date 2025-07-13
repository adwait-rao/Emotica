import express from "express";
import schedulerManager from "../scheduler/index.js";
import { deadLetterQueue } from "../scheduler/notifications.js"; // Export this from notifications.js
import {
  getNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getNotificationStats
} from "../scheduler/notifications.js";
import { authenticate } from "../middleware/authentication.js";
import { requireRole } from "../middleware/requireRole.js";

const router = express.Router();

// Manual trigger for notification processing (admin only)
router.post("/admin/process-now", authenticate, requireRole(['admin']), async (req, res) => {
  await schedulerManager.triggerManualProcessing();
  res.json({ success: true, message: "Manual processing triggered" });
});

// Get notification system status (admin only)
router.get("/admin/status", authenticate, requireRole(['admin']), (req, res) => {
  const status = schedulerManager.getSystemStatus();
  res.json(status);
});

// List all notifications (admin/debug)
router.get("/admin/all", authenticate, requireRole(['admin']), async (req, res) => {
  // Example: fetch all notifications from DB (implement as needed)
  const { data, error } = await supabase.from("notifications").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// View dead letter queue
router.get("/admin/dead-letter", authenticate, requireRole(['admin']), (req, res) => {
  res.json(deadLetterQueue);
});

// Force-send a notification (debug)
router.post("/admin/force-send", authenticate, requireRole(['admin']), async (req, res) => {
  const { userId, notification } = req.body;
  const result = await sendNotificationWithRetry(notification, userId, 1);
  res.json({ success: result });
});

router.get("/:userId", authenticate, getNotifications);
router.get("/:userId/unread-count", authenticate, getUnreadCount);
router.post("/:userId/mark-read", authenticate, async (req, res) => {
  const { notificationId } = req.body;
  const { userId } = req.params;
  const result = await markNotificationAsRead(notificationId, userId);
  res.json({ success: result });
});
router.post("/:userId/mark-all-read", authenticate, async (req, res) => {
  const { userId } = req.params;
  const result = await markAllNotificationsAsRead(userId);
  res.json({ success: result });
});
router.delete("/:userId/:notificationId", authenticate, async (req, res) => {
  const { userId, notificationId } = req.params;
  const result = await deleteNotification(notificationId, userId);
  res.json({ success: result });
});
router.get("/:userId/stats", authenticate, async (req, res) => {
  const { userId } = req.params;
  const stats = await getNotificationStats(userId);
  res.json(stats);
});

export default router;