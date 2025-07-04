// notification.js - Complete In-App Notification System
import cron from "node-cron";
import { createClient } from "@supabase/supabase-js";
import { getUpcomingNotifications, markNotificationAsSent } from "../services/events_utils.js";
import { WebSocketServer } from 'ws';
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// WebSocket server for real-time notifications
let wss;
const userConnections = new Map(); // Store user connections

// Initialize WebSocket server
export function initializeWebSocketServer(server) {
  wss = new WebSocketServer({ server });
  
  wss.on('connection', (ws, req) => {
    console.log('📱 New WebSocket connection');
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        
        if (data.type === 'auth' && data.userId) {
          // Associate this connection with the user
          userConnections.set(data.userId, ws);
          console.log(`✅ User ${data.userId} connected via WebSocket`);
          
          // Send any pending notifications immediately
          sendPendingNotifications(data.userId);
        }
      } catch (error) {
        console.error('❌ Error processing WebSocket message:', error);
      }
    });
    
    ws.on('close', () => {
      // Remove connection from map
      for (const [userId, connection] of userConnections.entries()) {
        if (connection === ws) {
          userConnections.delete(userId);
          console.log(`📴 User ${userId} disconnected`);
          break;
        }
      }
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });
  });
  
  console.log('🚀 WebSocket server initialized for real-time notifications');
}

// Enhanced notification function with different message templates
function getNotificationMessage(notification) {
  const { event_type, event_summary, notification_type } = notification;
  
  const templates = {
    birthday: {
      one_day_before: `🎂 Tomorrow is ${event_summary}! Don't forget to prepare something special.`,
      same_day_morning: `🎉 Happy ${event_summary}! Make sure to wish them well today.`,
      same_day: `🎈 It's ${event_summary} today! Time to celebrate!`
    },
    exam: {
      three_days_before: `📚 Your ${event_summary} is in 3 days. Time to start intensive preparation!`,
      one_day_before: `⏰ Your ${event_summary} is tomorrow! Final review time.`,
      same_day_morning: `📖 Good morning! Today is your ${event_summary}. You've got this!`
    },
    appointment: {
      one_day_before: `📅 Reminder: You have ${event_summary} tomorrow. Make sure to prepare any documents needed.`,
      one_hour_before: `⏰ Your ${event_summary} is in 1 hour. Time to head out!`
    },
    deadline: {
      one_week_before: `📋 One week left for ${event_summary}. Start planning your approach!`,
      three_days_before: `⚠️ Only 3 days left for ${event_summary}. Time to focus!`,
      one_day_before: `🚨 Tomorrow is the deadline for ${event_summary}. Final push!`
    },
    workout: {
      same_day_morning: `💪 Good morning! Time for your ${event_summary}. Let's get moving!`,
      thirty_minutes_before: `🏃‍♂️ Your ${event_summary} starts in 30 minutes. Get ready!`
    },
    medication: {
      same_day: `💊 Time to take your ${event_summary}. Stay healthy!`,
      one_hour_before: `⏰ Reminder: Take your ${event_summary} in 1 hour.`
    },
    social: {
      one_day_before: `🎉 Don't forget about ${event_summary} tomorrow! It's going to be fun.`,
      same_day: `🥳 ${event_summary} is starting soon! Time to get ready.`
    },
    travel: {
      one_day_before: `✈️ Your ${event_summary} is tomorrow! Check your bookings and pack your bags.`,
      same_day_morning: `🧳 Travel day! Your ${event_summary} is today. Safe travels!`
    },
    work: {
      one_day_before: `💼 Tomorrow you have ${event_summary}. Prepare any materials you need.`,
      same_day_morning: `☕ Good morning! You have ${event_summary} today. Have a productive day!`
    },
    personal: {
      same_day_morning: `✅ Don't forget: ${event_summary} is on your agenda for today.`
    },
    reminder: {
      same_day: `🔔 Reminder: ${event_summary}`,
      one_hour_before: `⏰ In 1 hour: ${event_summary}`,
      thirty_minutes_before: `⏰ In 30 minutes: ${event_summary}`
    }
  };

  const categoryTemplates = templates[event_type] || templates.reminder;
  const message = categoryTemplates[notification_type] || categoryTemplates.same_day || `🔔 Reminder: ${event_summary}`;
  
  return message;
}

// Get notification priority and category emoji
function getNotificationMeta(notification) {
  const priorityEmojis = {
    high: '🔴',
    medium: '🟡',
    low: '🟢'
  };
  
  const categoryEmojis = {
    birthday: '🎂',
    exam: '📚',
    appointment: '📅',
    deadline: '🚨',
    workout: '💪',
    medication: '💊',
    social: '🎉',
    travel: '✈️',
    work: '💼',
    personal: '✅',
    reminder: '🔔'
  };
  
  return {
    priorityEmoji: priorityEmojis[notification.priority] || '🔔',
    categoryEmoji: categoryEmojis[notification.event_type] || '🔔'
  };
}

// Create in-app notification in database
async function createInAppNotification(userId, notification) {
  try {
    const message = getNotificationMessage(notification);
    const { priorityEmoji, categoryEmoji } = getNotificationMeta(notification);
    
    const inAppNotification = {
      user_id: userId,
      title: `${categoryEmoji} ${notification.event_type.charAt(0).toUpperCase() + notification.event_type.slice(1)} Reminder`,
      message: message,
      type: notification.event_type,
      priority: notification.priority || 'medium',
      event_id: notification.event_id,
      notification_id: notification.id,
      is_read: false,
      created_at: new Date().toISOString(),
      data: {
        event_summary: notification.event_summary,
        event_date: notification.event_date,
        notification_type: notification.notification_type,
        priority_emoji: priorityEmoji,
        category_emoji: categoryEmoji
      }
    };
    
    const { data, error } = await supabase
      .from('in_app_notifications')
      .insert([inAppNotification])
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error creating in-app notification:', error);
      return null;
    }
    
    console.log(`✅ In-app notification created: ${data.id}`);
    return data;
    
  } catch (error) {
    console.error('❌ Error in createInAppNotification:', error);
    return null;
  }
}

// Send real-time notification via WebSocket
function sendRealTimeNotification(userId, notificationData) {
  const userConnection = userConnections.get(userId);
  
  if (userConnection && userConnection.readyState === 1) { // 1 = OPEN
    try {
      userConnection.send(JSON.stringify({
        type: 'notification',
        data: notificationData
      }));
      console.log(`📱 Real-time notification sent to user ${userId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error sending real-time notification to user ${userId}:`, error);
      return false;
    }
  }
  
  console.log(`📴 User ${userId} not connected via WebSocket`);
  return false;
}

// Send pending notifications to newly connected user
async function sendPendingNotifications(userId) {
  try {
    const { data: pendingNotifications, error } = await supabase
      .from('in_app_notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('❌ Error fetching pending notifications:', error);
      return;
    }
    
    if (pendingNotifications && pendingNotifications.length > 0) {
      const userConnection = userConnections.get(userId);
      if (userConnection && userConnection.readyState === 1) {
        userConnection.send(JSON.stringify({
          type: 'pending_notifications',
          data: pendingNotifications
        }));
        console.log(`📬 Sent ${pendingNotifications.length} pending notifications to user ${userId}`);
      }
    }
  } catch (error) {
    console.error('❌ Error sending pending notifications:', error);
  }
}

// Main notification sending function
async function sendNotification(notification) {
  try {
    console.log(`📱 Processing notification for user ${notification.user_id}`);
    
    // 1. Create in-app notification in database
    const inAppNotification = await createInAppNotification(notification.user_id, notification);
    
    if (!inAppNotification) {
      console.log(`❌ Failed to create in-app notification for user ${notification.user_id}`);
      return false;
    }
    
    // 2. Send real-time notification via WebSocket
    const realTimeSent = sendRealTimeNotification(notification.user_id, inAppNotification);
    
    // 3. Update notification delivery status
    await supabase
      .from('in_app_notifications')
      .update({ 
        delivered_at: new Date().toISOString(),
        delivery_status: realTimeSent ? 'delivered' : 'pending'
      })
      .eq('id', inAppNotification.id);
    
    console.log(`✅ Notification processed for user ${notification.user_id}`);
    return true;
    
  } catch (error) {
    console.error('❌ Error in sendNotification:', error);
    return false;
  }
}

// Check and send notifications - runs every minute
cron.schedule("* * * * *", async () => {
  try {
    console.log("🔍 Checking for notifications to send...");
    
    const notifications = await getUpcomingNotifications();
    
    if (notifications.length === 0) {
      console.log("✅ No notifications to send at this time.");
      return;
    }

    console.log(`📬 Found ${notifications.length} notifications to send`);

    for (const notification of notifications) {
      try {
        // Send the notification
        const sent = await sendNotification(notification);
        
        if (sent) {
          // Mark as sent in database
          await markNotificationAsSent(notification.id);
          console.log(`✅ Notification sent and marked as sent: ${notification.id}`);
        } else {
          console.log(`❌ Failed to send notification: ${notification.id}`);
        }
      } catch (notificationError) {
        console.error(`❌ Error processing notification ${notification.id}:`, notificationError);
      }
    }

  } catch (error) {
    console.error("❌ Error in notification cron job:", error);
  }
});

// Cleanup old notifications - runs daily at 2 AM
cron.schedule("0 2 * * *", async () => {
  try {
    console.log("🧹 Cleaning up old notifications...");
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Clean up old scheduled notifications
    const { error: scheduleError } = await supabase
      .from("notifications")
      .delete()
      .lt("notification_time", thirtyDaysAgo.toISOString())
      .eq("sent", true);

    if (scheduleError) {
      console.error("❌ Error cleaning up old scheduled notifications:", scheduleError);
    }
    
    // Clean up old in-app notifications (keep read ones for 7 days, unread for 30 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { error: inAppError } = await supabase
      .from("in_app_notifications")
      .delete()
      .or(`and(is_read.eq.true,created_at.lt.${sevenDaysAgo.toISOString()}),and(is_read.eq.false,created_at.lt.${thirtyDaysAgo.toISOString()})`);

    if (inAppError) {
      console.error("❌ Error cleaning up old in-app notifications:", inAppError);
    } else {
      console.log("✅ Old notifications cleaned up successfully");
    }
    
  } catch (error) {
    console.error("❌ Error in cleanup cron job:", error);
  }
});

// Health check - runs every 15 minutes
cron.schedule("*/15 * * * *", async () => {
  try {
    const { data: pendingScheduled, error: scheduledError } = await supabase
      .from("notifications")
      .select("count", { count: "exact", head: true })
      .eq("sent", false);

    const { data: pendingInApp, error: inAppError } = await supabase
      .from("in_app_notifications")
      .select("count", { count: "exact", head: true })
      .eq("is_read", false);

    if (scheduledError || inAppError) {
      console.error("❌ Health check failed:", scheduledError || inAppError);
    } else {
      console.log(`💚 System healthy. ${pendingScheduled?.count || 0} pending scheduled notifications, ${pendingInApp?.count || 0} unread in-app notifications. ${userConnections.size} active WebSocket connections.`);
    }
  } catch (error) {
    console.error("❌ Health check error:", error);
  }
});

// API endpoints for managing in-app notifications
export const notificationRoutes = (app) => {
  // Get user's in-app notifications
  app.get('/api/notifications/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20, unread_only = false } = req.query;
      
      const offset = (page - 1) * limit;
      
      let query = supabase
        .from('in_app_notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (unread_only === 'true') {
        query = query.eq('is_read', false);
      }
      
      const { data, error, count } = await query;
      
      if (error) {
        return res.status(500).json({ error: 'Failed to fetch notifications' });
      }
      
      res.json({
        notifications: data || [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count || 0,
          hasMore: (offset + limit) < (count || 0)
        }
      });
      
    } catch (error) {
      console.error('❌ Error fetching notifications:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Mark notification as read
  app.put('/api/notifications/:notificationId/read', async (req, res) => {
    try {
      const { notificationId } = req.params;
      const { userId } = req.body;
      
      const { error } = await supabase
        .from('in_app_notifications')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('id', notificationId)
        .eq('user_id', userId);
      
      if (error) {
        return res.status(500).json({ error: 'Failed to mark notification as read' });
      }
      
      res.json({ success: true });
      
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Mark all notifications as read
  app.put('/api/notifications/read-all/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      
      const { error } = await supabase
        .from('in_app_notifications')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('user_id', userId)
        .eq('is_read', false);
      
      if (error) {
        return res.status(500).json({ error: 'Failed to mark all notifications as read' });
      }
      
      res.json({ success: true });
      
    } catch (error) {
      console.error('❌ Error marking all notifications as read:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Delete notification
  app.delete('/api/notifications/:notificationId', async (req, res) => {
    try {
      const { notificationId } = req.params;
      const { userId } = req.body;
      
      const { error } = await supabase
        .from('in_app_notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId);
      
      if (error) {
        return res.status(500).json({ error: 'Failed to delete notification' });
      }
      
      res.json({ success: true });
      
    } catch (error) {
      console.error('❌ Error deleting notification:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Get notification count
  app.get('/api/notifications/count/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      
      const { data, error } = await supabase
        .from('in_app_notifications')
        .select('count', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      
      if (error) {
        return res.status(500).json({ error: 'Failed to fetch notification count' });
      }
      
      res.json({ count: data?.count || 0 });
      
    } catch (error) {
      console.error('❌ Error fetching notification count:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
};

console.log("🚀 Enhanced in-app notification system started!");
console.log("📱 Real-time WebSocket notifications enabled!");
console.log("🔔 Notification API endpoints configured!");