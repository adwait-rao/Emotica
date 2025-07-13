import cron from "node-cron";
import { createClient } from "@supabase/supabase-js";
import { getUpcomingNotifications, markNotificationAsSent, getCurrentISTTime, toIST } from "../services/events_utils.js";
import { WebSocketServer } from 'ws';
import dotenv from "dotenv";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import { jwtVerify } from "jose"; 

dayjs.extend(utc);
dayjs.extend(timezone);

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const JWT_SECRET = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET);
const deadLetterQueue = [];
// Constants
const IST_TIMEZONE = 'Asia/Kolkata';
const MAX_RETRY_ATTEMPTS = 3;
const NOTIFICATION_BATCH_SIZE = 10;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const NOTIFICATION_CLEANUP_DAYS = 30; // Keep notifications for 30 days

// WebSocket server for real-time notifications
let wss;
const userConnections = new Map();
const connectionHeartbeat = new Map();

// Initialize WebSocket server with enhanced connection management
export function initializeWebSocketServer(server) {
  wss = new WebSocketServer({ 
    server,
    clientTracking: true,
    perMessageDeflate: true
  });
  
 wss.on('connection', (ws, req) => {
  console.log('📱 New WebSocket connection established');

  ws.isAlive = true;
  ws.isAuthenticated = false;
  ws.userId = null;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      // --- AUTHENTICATION REQUIRED ---
      if (!ws.isAuthenticated) {
        if (data.type === 'auth' && data.token) {
          try {
            // Verify JWT
            const { payload } = await jwtVerify(data.token, JWT_SECRET, {
              algorithms: ["HS256"],
              issuer: `${process.env.SUPABASE_URL}/auth/v1`,
            });
            ws.userId = payload.sub;
            ws.isAuthenticated = true;

            // Clean up any existing connection for this user
            const existingConnection = userConnections.get(ws.userId);
            if (existingConnection && existingConnection !== ws) {
              existingConnection.terminate();
            }

            // Associate this connection with the user
            userConnections.set(ws.userId, ws);
            connectionHeartbeat.set(ws.userId, dayjs());

            console.log(`✅ User ${ws.userId} authenticated via WebSocket`);

            // Send pending notifications immediately
            sendPendingNotifications(ws.userId);

            // Send connection confirmation
            ws.send(JSON.stringify({
              type: 'connection_confirmed',
              timestamp: getCurrentISTTime().toISOString(),
              message: 'Connected to notification service'
            }));
          } catch (err) {
            ws.send(JSON.stringify({ type: "error", message: "Invalid or expired token" }));
            ws.terminate();
          }
        } else {
          ws.send(JSON.stringify({ type: "error", message: "Authentication required. Send {type: 'auth', token: '<JWT>'}" }));
        }
        return;
      }

      // --- AUTHENTICATED USER ONLY BELOW THIS LINE ---

      if (data.type === 'ping') {
        ws.send(JSON.stringify({
          type: 'pong',
          timestamp: getCurrentISTTime().toISOString()
        }));
      }

      if (data.type === 'mark_read' && data.notificationId) {
        markNotificationAsRead(data.notificationId, ws.userId);
      }
      if (data.type === 'mark_all_read') {
        markAllNotificationsAsRead(ws.userId);
      }
      if (data.type === 'delete_notification' && data.notificationId) {
        deleteNotification(data.notificationId, ws.userId);
      }

    } catch (error) {
      console.error('❌ Error processing WebSocket message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  });

  ws.on('close', () => {
    // Remove connection from map
    for (const [userId, connection] of userConnections.entries()) {
      if (connection === ws) {
        userConnections.delete(userId);
        connectionHeartbeat.delete(userId);
        console.log(`📴 User ${userId} disconnected from WebSocket`);
        break;
      }
    }
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
});
    


async function sendNotificationWithRetry(notification, userId, attempt = 1) {
  const ws = userConnections.get(userId);
  if (!ws || ws.readyState !== ws.OPEN) {
    if (attempt >= MAX_RETRY_ATTEMPTS) {
      deadLetterQueue.push({ notification, userId, reason: "No active connection" });
      console.error(`❌ Notification to ${userId} failed after ${attempt} attempts`);
      return false;
    }
    setTimeout(() => sendNotificationWithRetry(notification, userId, attempt + 1), 1000 * attempt);
    return;
  }
  try {
    ws.send(JSON.stringify(notification));
    return true;
  } catch (err) {
    if (attempt >= MAX_RETRY_ATTEMPTS) {
      deadLetterQueue.push({ notification, userId, reason: err.message });
      console.error(`❌ Notification to ${userId} failed after ${attempt} attempts`);
      return false;
    }
    setTimeout(() => sendNotificationWithRetry(notification, userId, attempt + 1), 1000 * attempt);
  }
}
   
  // Heartbeat interval to detect dead connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      
      ws.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL);
  
  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });
  
  console.log('🚀 Enhanced WebSocket server initialized for real-time notifications');
}

// Enhanced notification message templates with IST timestamps
function getNotificationMessage(notification) {
  const { event_type, event_summary, notification_type, event_date } = notification;
  const eventTimeIST = toIST(event_date);
  const timeString = eventTimeIST.format('h:mm A, MMM DD');
  
  const templates = {
    birthday: {
      one_day_before: `🎂 Tomorrow is ${event_summary}! Don't forget to prepare something special.`,
      same_day_morning: `🎉 Today is ${event_summary}! Make sure to wish them well.`,
      same_day: `🎈 It's ${event_summary} today! Time to celebrate!`,
      one_hour_before: `🎂 ${event_summary} is coming up at ${timeString}!`
    },
    exam: {
      one_week_before: `📚 Your ${event_summary} is in one week (${timeString}). Start your preparation plan!`,
      three_days_before: `📖 Your ${event_summary} is in 3 days (${timeString}). Intensive study time!`,
      one_day_before: `⏰ Your ${event_summary} is tomorrow at ${timeString}. Final review time!`,
      same_day_morning: `📝 Good morning! Today is your ${event_summary} at ${timeString}. You've got this!`,
      one_hour_before: `🎯 Your ${event_summary} starts in 1 hour. Time to head to the exam hall!`
    },
    appointment: {
      one_day_before: `📅 Reminder: You have ${event_summary} tomorrow at ${timeString}. Prepare any needed documents.`,
      same_day_morning: `📋 Good morning! You have ${event_summary} today at ${timeString}.`,
      one_hour_before: `⏰ Your ${event_summary} is in 1 hour. Time to head out!`,
      thirty_minutes_before: `🚗 Your ${event_summary} starts in 30 minutes. Leave now to arrive on time.`
    },
    deadline: {
      one_week_before: `📋 One week left for ${event_summary} (due ${timeString}). Start planning!`,
      three_days_before: `⚠️ Only 3 days left for ${event_summary} (due ${timeString}). Focus time!`,
      one_day_before: `🚨 Tomorrow is the deadline for ${event_summary} at ${timeString}. Final push!`,
      same_day: `⏰ ${event_summary} is due today at ${timeString}. Time to submit!`
    },
    workout: {
      same_day_morning: `💪 Good morning! Time for your ${event_summary} at ${timeString}. Let's get moving!`,
      one_hour_before: `🏃‍♂️ Your ${event_summary} starts in 1 hour. Get ready!`,
      thirty_minutes_before: `💪 Your ${event_summary} starts in 30 minutes. Time to gear up!`
    },
    medication: {
      same_day: `💊 Time to take your ${event_summary}. Stay healthy!`,
      one_hour_before: `⏰ Reminder: Take your ${event_summary} in 1 hour.`,
      thirty_minutes_before: `💊 Don't forget to take your ${event_summary} in 30 minutes.`
    },
    social: {
      one_day_before: `🎉 Don't forget about ${event_summary} tomorrow at ${timeString}! It's going to be fun.`,
      same_day_morning: `🥳 Today is ${event_summary} at ${timeString}! Looking forward to it.`,
      one_hour_before: `🎊 ${event_summary} starts in 1 hour. Time to get ready!`
    },
    travel: {
      one_day_before: `✈️ Your ${event_summary} is tomorrow at ${timeString}! Check bookings and pack bags.`,
      same_day_morning: `🧳 Travel day! Your ${event_summary} is today at ${timeString}. Safe travels!`,
      one_hour_before: `🚗 Your ${event_summary} is in 1 hour. Time to head to the airport/station!`
    },
    work: {
      one_day_before: `💼 Tomorrow you have ${event_summary} at ${timeString}. Prepare materials needed.`,
      same_day_morning: `☕ Good morning! You have ${event_summary} today at ${timeString}. Productive day ahead!`,
      one_hour_before: `💼 Your ${event_summary} starts in 1 hour. Final preparations!`
    },
    personal: {
      same_day_morning: `✅ Don't forget: ${event_summary} is scheduled for today at ${timeString}.`,
      one_hour_before: `📝 Reminder: ${event_summary} in 1 hour.`
    },
    reminder: {
      same_day: `🔔 Reminder: ${event_summary} today at ${timeString}`,
      one_hour_before: `⏰ In 1 hour: ${event_summary}`,
      thirty_minutes_before: `⏰ In 30 minutes: ${event_summary}`,
      fifteen_minutes_before: `⏰ In 15 minutes: ${event_summary}`,
      five_minutes_before: `⏰ In 5 minutes: ${event_summary}`
    }
  };

  const categoryTemplates = templates[event_type] || templates.reminder;
  const message = categoryTemplates[notification_type] || 
                 categoryTemplates.same_day || 
                 `🔔 Reminder: ${event_summary} at ${timeString}`;
  
  return message;
}

// Enhanced notification metadata
function getNotificationMeta(notification) {
  const priorityConfig = {
    high: { emoji: '🔴', color: '#FF4444', urgency: 'high' },
    medium: { emoji: '🟡', color: '#FFAA00', urgency: 'medium' },
    low: { emoji: '🟢', color: '#44AA44', urgency: 'low' }
  };
  
  const categoryConfig = {
    birthday: { emoji: '🎂', color: '#FF69B4', bgColor: '#FFF0F8' },
    exam: { emoji: '📚', color: '#4169E1', bgColor: '#F0F4FF' },
    appointment: { emoji: '📅', color: '#32CD32', bgColor: '#F0FFF0' },
    deadline: { emoji: '🚨', color: '#FF4500', bgColor: '#FFF8F0' },
    workout: { emoji: '💪', color: '#FF6347', bgColor: '#FFF5F5' },
    medication: { emoji: '💊', color: '#DA70D6', bgColor: '#FDF0FF' },
    social: { emoji: '🎉', color: '#FFD700', bgColor: '#FFFDF0' },
    travel: { emoji: '✈️', color: '#87CEEB', bgColor: '#F0FEFF' },
    work: { emoji: '💼', color: '#708090', bgColor: '#F8F9FA' },
    personal: { emoji: '✅', color: '#90EE90', bgColor: '#F0FFF0' },
    reminder: { emoji: '🔔', color: '#B0C4DE', bgColor: '#F8F9FF' }
  };
  
  const priority = priorityConfig[notification.priority] || priorityConfig.medium;
  const category = categoryConfig[notification.event_type] || categoryConfig.reminder;
  
  return {
    ...priority,
    categoryEmoji: category.emoji,
    categoryColor: category.color,
    categoryBgColor: category.bgColor

  };
}

// Enhanced in-app notification creation with better error handling
async function createInAppNotification(userId, notification) {
  try {
    const message = getNotificationMessage(notification);
    const meta = getNotificationMeta(notification);
    const currentTime = getCurrentISTTime();
    
    const inAppNotification = {
      user_id: userId,
      title: `${meta.categoryEmoji} ${notification.event_type.charAt(0).toUpperCase() + notification.event_type.slice(1)} Reminder`,
      message: message,
      type: notification.event_type,
      priority: notification.priority || 'medium',
      event_id: notification.event_id,
      notification_id: notification.id,
      is_read: false,
      created_at: currentTime.utc().toISOString(),
      data: {
        event_summary: notification.event_summary,
        event_date: notification.event_date,
        notification_type: notification.notification_type,
        priority_emoji: meta.emoji,
        category_emoji: meta.categoryEmoji,
        priority_color: meta.color,
        category_color: meta.categoryColor,
        urgency: meta.urgency,
        event_time_ist: toIST(notification.event_date).format('YYYY-MM-DD HH:mm:ss'),
        created_time_ist: currentTime.format('YYYY-MM-DD HH:mm:ss'),
        action_buttons: getActionButtons(notification.event_type)
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
    
    console.log(`✅ In-app notification created: ${data.id} for user ${userId}`);
    return data;
    
  } catch (error) {
    console.error('❌ Error in createInAppNotification:', error);
    return null;
  }
}

// Get action buttons based on event type
function getActionButtons(eventType) {
  const actionButtons = {
    exam: [
      { label: 'Study Now', action: 'study', color: '#4169E1' },
      { label: 'Set Timer', action: 'timer', color: '#32CD32' }
    ],
    appointment: [
      { label: 'Get Directions', action: 'directions', color: '#32CD32' },
      { label: 'Call', action: 'call', color: '#FF6347' }
    ],
    medication: [
      { label: 'Taken', action: 'taken', color: '#32CD32' },
      { label: 'Snooze 10min', action: 'snooze', color: '#FFAA00' }
    ],
    workout: [
      { label: 'Start Workout', action: 'start', color: '#FF6347' },
      { label: 'Skip Today', action: 'skip', color: '#708090' }
    ],
    deadline: [
      { label: 'Work Now', action: 'work', color: '#FF4500' },
      { label: 'View Details', action: 'details', color: '#4169E1' }
    ]
  };
  
  return actionButtons[eventType] || [
    { label: 'View', action: 'view', color: '#4169E1' },
    { label: 'Done', action: 'done', color: '#32CD32' }
  ];
}


// Enhanced real-time notification with retry mechanism
async function sendRealTimeNotification(userId, notificationData, retryCount = 0) {
  const userConnection = userConnections.get(userId);
  
  if (!userConnection || userConnection.readyState !== 1) {
    console.log(`📴 User ${userId} not connected via WebSocket`);
    return false;
  }
  
  try {
    const payload = {
      type: 'notification',
      data: notificationData,
      timestamp: getCurrentISTTime().toISOString(),
      retry_count: retryCount
    };
    
    userConnection.send(JSON.stringify(payload));
    
    // Update connection heartbeat
    connectionHeartbeat.set(userId, dayjs());
    
    console.log(`📱 Real-time notification sent to user ${userId}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Error sending real-time notification to user ${userId}:`, error);
    
    // Retry mechanism
    if (retryCount < MAX_RETRY_ATTEMPTS) {
      console.log(`🔄 Retrying notification send (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`);
      setTimeout(() => {
        sendRealTimeNotification(userId, notificationData, retryCount + 1);
      }, 1000 * (retryCount + 1)); // Exponential backoff
    } else {
      console.error(`❌ Failed to send notification after ${MAX_RETRY_ATTEMPTS} attempts`);
      // Remove dead connection
      userConnections.delete(userId);
      connectionHeartbeat.delete(userId);
    }
    
    return false;
  }
}

// Enhanced pending notifications with pagination
async function sendPendingNotifications(userId) {
  try {
    const { data: pendingNotifications, error } = await supabase
      .from('in_app_notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(20); // Limit to prevent overwhelming the client
    
    if (error) {
      console.error('❌ Error fetching pending notifications:', error);
      return;
    }
    
    if (pendingNotifications && pendingNotifications.length > 0) {
      const userConnection = userConnections.get(userId);
      
      if (userConnection && userConnection.readyState === 1) {
        const payload = {
          type: 'pending_notifications',
          data: pendingNotifications,
          count: pendingNotifications.length,
          timestamp: getCurrentISTTime().toISOString()
        };
        
        userConnection.send(JSON.stringify(payload));
        console.log(`📬 Sent ${pendingNotifications.length} pending notifications to user ${userId}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error sending pending notifications:', error);
  }
}

// Mark notification as read
export async function markNotificationAsRead(notificationId, userId) {
  try {
    const { error } = await supabase
      .from('in_app_notifications')
      .update({ 
        is_read: true, 
        read_at: getCurrentISTTime().utc().toISOString() 
      })
      .eq('id', notificationId)
      .eq('user_id', userId);
    
    if (error) {
      console.error('❌ Error marking notification as read:', error);
      return false;
    }
    
    console.log(`✅ Notification ${notificationId} marked as read for user ${userId}`);

    // Broadcast update to connected user
    const userConnection = userConnections.get(userId);
    if (userConnection && userConnection.readyState === 1) {
      userConnection.send(JSON.stringify({
        type: 'notification_read',
        notificationId: notificationId,
        timestamp: getCurrentISTTime().toISOString()
      }));
    }
    return true;
    
  } catch (error) {
    console.error('❌ Error in markNotificationAsRead:', error);
    return false;
  }
}

// Mark all notifications as read
export async function markAllNotificationsAsRead(userId) {
  try {
    const { error } = await supabase
      .from('in_app_notifications')
      .update({ 
        is_read: true, 
        read_at: getCurrentISTTime().utc().toISOString() 
      })
      .eq('user_id', userId)
      .eq('is_read', false);
    
    if (error) {
      console.error('❌ Error marking all notifications as read:', error);
      return false;
    }
    
    console.log(`✅ All notifications marked as read for user ${userId}`);
    
    // Broadcast update to connected user
    const userConnection = userConnections.get(userId);
    if (userConnection && userConnection.readyState === 1) {
      userConnection.send(JSON.stringify({
        type: 'all_notifications_read',
        timestamp: getCurrentISTTime().toISOString()
      }));
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error in markAllNotificationsAsRead:', error);
    return false;
  }
}

// Delete notification
export async function deleteNotification(notificationId, userId) {
  try {
    const { error } = await supabase
      .from('in_app_notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', userId);
    
    if (error) {
      console.error('❌ Error deleting notification:', error);
      return false;
    }
    
    console.log(`✅ Notification ${notificationId} deleted for user ${userId}`);
    
    // Broadcast update to connected user
    const userConnection = userConnections.get(userId);
    if (userConnection && userConnection.readyState === 1) {
      userConnection.send(JSON.stringify({
        type: 'notification_deleted',
        notificationId: notificationId,
        timestamp: getCurrentISTTime().toISOString()
      }));
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error in deleteNotification:', error);
    return false;
  }
}


// Process notification batch with enhanced error handling
async function processNotificationBatch(notifications) {
  const results = {
    successful: 0,
    failed: 0,
    errors: []
  };
  
  for (const notification of notifications) {
    try {
      console.log(`🔄 Processing notification ${notification.id} for user ${notification.user_id}`);
      
      const inAppNotification = await createInAppNotification(notification.user_id, notification);
      
      if (inAppNotification) {
        const realtimeSent = await sendRealTimeNotification(notification.user_id, inAppNotification);
        await markNotificationAsSent(notification.id);
        
        results.successful++;
        console.log(`✅ Successfully processed notification ${notification.id} (realtime: ${realtimeSent})`);
      } else {
        results.failed++;
        results.errors.push(`Failed to create in-app notification for ${notification.id}`);
      }
      
    } catch (error) {
      results.failed++;
      results.errors.push(`Error processing notification ${notification.id}: ${error.message}`);
      console.error(`❌ Error processing notification ${notification.id}:`, error);
    }
  }
  
  return results;
}

// Main notification processing function
async function processNotifications() {
  try {
    const currentTime = getCurrentISTTime();
    console.log(`🕐 Starting notification processing at ${currentTime.format()}`);
    
    const upcomingNotifications = await getUpcomingNotifications(5);
    
    if (upcomingNotifications.length === 0) {
      console.log('📭 No notifications to process');
      return;
    }
    
    console.log(`📬 Found ${upcomingNotifications.length} notifications to process`);
    
    // Process notifications in batches
    const batches = [];
    for (let i = 0; i < upcomingNotifications.length; i += NOTIFICATION_BATCH_SIZE) {
      batches.push(upcomingNotifications.slice(i, i + NOTIFICATION_BATCH_SIZE));
    }
    
    let totalSuccessful = 0;
    let totalFailed = 0;
    
    for (const [index, batch] of batches.entries()) {
      console.log(`🔄 Processing batch ${index + 1}/${batches.length} (${batch.length} notifications)`);
      
      const results = await processNotificationBatch(batch);
      totalSuccessful += results.successful;
      totalFailed += results.failed;
      
      if (results.errors.length > 0) {
        console.error('❌ Batch errors:', results.errors);
      }
    }
    
    console.log(`✅ Notification processing complete: ${totalSuccessful} successful, ${totalFailed} failed`);
    
  } catch (error) {
    console.error('❌ Error in notification processing:', error);
  }
}

// Cleanup old notifications
async function cleanupOldNotifications() {
  try {
    const cutoffDate = dayjs().subtract(NOTIFICATION_CLEANUP_DAYS, 'day').utc().toISOString();
    
    const { data, error } = await supabase
      .from('in_app_notifications')
      .delete()
      .lt('created_at', cutoffDate)
      .select('id');
    
    if (error) {
      console.error('❌ Error cleaning up old notifications:', error);
      return;
    }
    
    console.log(`🧹 Cleaned up ${data?.length || 0} old notifications`);
    
  } catch (error) {
    console.error('❌ Error in cleanupOldNotifications:', error);
  }
}

// Start the notification system
export function startNotificationSystem() {
  console.log('🚀 Starting notification system...');
  
  // Process notifications every minute
  cron.schedule('* * * * *', async () => {
    await processNotifications();
  });
  
  // Cleanup old notifications daily at 2 AM IST
  cron.schedule('0 2 * * *', async () => {
    await cleanupOldNotifications();
  }, {
    timezone: IST_TIMEZONE
  });
  
  // Health check every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    const connectedUsers = userConnections.size;
    const currentTime = getCurrentISTTime();
    console.log(`💓 Health check: ${connectedUsers} users connected at ${currentTime.format()}`);
  });
  
  console.log('✅ Notification system started successfully');
}

// Get notification statistics
export async function getNotificationStats(userId) {
  try {
    const { data, error } = await supabase
      .from('in_app_notifications')
      .select('is_read, type, priority, created_at')
      .eq('user_id', userId)
      .gte('created_at', dayjs().subtract(30, 'day').utc().toISOString());
    
    if (error) {
      console.error('❌ Error fetching notification stats:', error);
      return null;
    }
    
    const stats = {
      total: data.length,
      unread: data.filter(n => !n.is_read).length,
      read: data.filter(n => n.is_read).length,
      byType: {},
      byPriority: {
        high: data.filter(n => n.priority === 'high').length,
        medium: data.filter(n => n.priority === 'medium').length,
        low: data.filter(n => n.priority === 'low').length
      }
    };
    
    // Count by type
    data.forEach(notification => {
      stats.byType[notification.type] = (stats.byType[notification.type] || 0) + 1;
    });
    
    return stats;
    
  } catch (error) {
    console.error('❌ Error in getNotificationStats:', error);
    return null;
  }
}

// API Routes for notifications
export async function getNotifications(req, res) {
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
      query = query.eq('is_read', true);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('❌ Error fetching notifications:', error);
      return res.status(500).json({ error: 'Failed to fetch notifications' });
    }
    
    res.json({
      notifications: data,
      page: parseInt(page),
      limit: parseInt(limit),
      total: data.length
    });
    
  } catch (error) {
    console.error('❌ Error in getNotifications API:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getUnreadCount(req, res) {
  try {
    const { userId } = req.params;
    
    const { count, error } = await supabase
      .from('in_app_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    
    if (error) {
      console.error('❌ Error fetching unread count:', error);
      return res.status(500).json({ error: 'Failed to fetch unread count' });
    }
    
    res.json({ unread_count: count || 0 });
    
  } catch (error) {
    console.error('❌ Error in getUnreadCount API:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export { deadLetterQueue };

