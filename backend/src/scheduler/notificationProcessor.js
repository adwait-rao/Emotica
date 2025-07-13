import { createClient } from "@supabase/supabase-js";
import { getCurrentISTTime } from "../services/events_utils.js";
import fcmService from "../services/fcmService.js";
import notificationGenerator from "./notificationGenerator.js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

class NotificationProcessor {
  constructor() {
    this.isProcessing = false;
    this.batchSize = 50; // Process notifications in batches
  }

  async processPendingNotifications() {
    if (this.isProcessing) {
      console.log('⏳ Notification processing already in progress');
      return;
    }

    this.isProcessing = true;
    const startTime = getCurrentISTTime();
    console.log(`🚀 Starting notification processing at ${startTime.format('YYYY-MM-DD HH:mm:ss IST')}`);

    try {
      // Get pending notifications
      const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('sent', false)
        .lte('notification_time', getCurrentISTTime().utc().toISOString())
        .order('priority', { ascending: false })
        .order('notification_time', { ascending: true })
        .limit(this.batchSize);

      if (error) {
        console.error('❌ Error fetching notifications:', error);
        return;
      }

      if (!notifications || notifications.length === 0) {
        console.log('✅ No pending notifications found');
        return;
      }

      console.log(`📋 Found ${notifications.length} pending notifications`);

      // Group notifications by user for efficient processing
      const userNotifications = this.groupNotificationsByUser(notifications);

      let totalProcessed = 0;
      let totalSuccessful = 0;
      let totalFailed = 0;

      // Process each user's notifications
      for (const [userId, userNotifs] of Object.entries(userNotifications)) {
        const result = await this.processUserNotifications(userId, userNotifs);
        totalProcessed += result.processed;
        totalSuccessful += result.successful;
        totalFailed += result.failed;
      }

      const endTime = getCurrentISTTime();
      const duration = endTime.diff(startTime, 'seconds');
      
      console.log(`✅ Notification processing completed in ${duration}s`);
      console.log(`📊 Stats: ${totalProcessed} processed, ${totalSuccessful} successful, ${totalFailed} failed`);

    } catch (error) {
      console.error('❌ Error processing notifications:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  groupNotificationsByUser(notifications) {
    return notifications.reduce((acc, notification) => {
      const userId = notification.user_id;
      if (!acc[userId]) {
        acc[userId] = [];
      }
      acc[userId].push(notification);
      return acc;
    }, {});
  }

  async processUserNotifications(userId, notifications) {
    let processed = 0;
    let successful = 0;
    let failed = 0;

    try {
      // Get user's FCM tokens
      const { data: devices, error } = await supabase
        .from('user_devices')
        .select('fcm_token, device_type')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {
        console.error(`❌ Error fetching devices for user ${userId}:`, error);
        // Mark notifications as failed
        await this.markNotificationsAsFailed(notifications.map(n => n.id), 'Failed to fetch user devices');
        return { processed: notifications.length, successful: 0, failed: notifications.length };
      }

      const fcmTokens = devices?.map(device => device.fcm_token) || [];
      const hasDevices = fcmTokens.length > 0;

      // Process each notification
      for (const notification of notifications) {
        processed++;
        
        try {
          // Always create in-app notification
          const inAppResult = await notificationGenerator.createInAppNotification(userId, notification);
          
          // Send FCM push notification if devices exist
          let fcmResult = { success: true };
          if (hasDevices) {
            fcmResult = await this.sendFCMNotification(notification, fcmTokens);
          }

          if (inAppResult && fcmResult.success) {
            // Mark notification as sent
            await this.markNotificationsAsSent([notification.id]);
            successful++;
            console.log(`✅ Notification ${notification.id} sent successfully`);
          } else {
            // Mark as failed
            await this.markNotificationsAsFailed([notification.id], 'Failed to send notification');
            failed++;
            console.error(`❌ Failed to send notification ${notification.id}`);
          }

          // Handle failed FCM tokens
          if (fcmResult.failedTokens && fcmResult.failedTokens.length > 0) {
            await this.handleFailedTokens(fcmResult.failedTokens);
          }

        } catch (error) {
          console.error(`❌ Error processing notification ${notification.id}:`, error);
          await this.markNotificationsAsFailed([notification.id], error.message);
          failed++;
        }
      }

      console.log(`👤 User ${userId}: ${processed} processed, ${successful} successful, ${failed} failed`);

    } catch (error) {
      console.error(`❌ Error processing notifications for user ${userId}:`, error);
      await this.markNotificationsAsFailed(notifications.map(n => n.id), error.message);
      failed = notifications.length;
    }

    return { processed, successful, failed };
  }

  async sendFCMNotification(notification, fcmTokens) {
    try {
      const title = notificationGenerator.generateFCMTitle(notification);
      const body = notificationGenerator.generateFCMBody(notification);
      const data = {
        notification_id: notification.id,
        event_id: notification.event_id,
        event_type: notification.event_type,
        notification_type: notification.notification_type,
        priority: notification.priority,
        event_summary: notification.event_summary,
        event_date: notification.event_date,
      };

      // Send to multiple devices
      const result = await fcmService.sendToMultipleDevices(fcmTokens, title, body, data);
      
      return result;

    } catch (error) {
      console.error(`❌ Error sending FCM notification ${notification.id}:`, error);
      return { success: false, error: error.message };
    }
  }

  async markNotificationsAsSent(notificationIds) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ 
          sent: true, 
          sent_at: getCurrentISTTime().utc().toISOString()
        })
        .in('id', notificationIds);

      if (error) {
        console.error('❌ Error marking notifications as sent:', error);
      }
    } catch (error) {
      console.error('❌ Error in markNotificationsAsSent:', error);
    }
  }

  async markNotificationsAsFailed(notificationIds, errorMessage) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ 
          sent: false, 
          sent_at: getCurrentISTTime().utc().toISOString(),
          error_message: errorMessage
        })
        .in('id', notificationIds);

      if (error) {
        console.error('❌ Error marking notifications as failed:', error);
      }
    } catch (error) {
      console.error('❌ Error in markNotificationsAsFailed:', error);
    }
  }

  async handleFailedTokens(failedTokens) {
    try {
      // Deactivate failed tokens
      const { error } = await supabase
        .from('user_devices')
        .update({ is_active: false })
        .in('fcm_token', failedTokens);

      if (error) {
        console.error('❌ Error deactivating failed tokens:', error);
      } else {
        console.log(`🔄 Deactivated ${failedTokens.length} failed tokens`);
      }
    } catch (error) {
      console.error('❌ Error in handleFailedTokens:', error);
    }
  }

  // Manual trigger for testing
  async triggerNotificationById(notificationId) {
    try {
      const { data: notification, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('id', notificationId)
        .single();

      if (error || !notification) {
        console.error('❌ Notification not found:', notificationId);
        return { success: false, error: 'Notification not found' };
      }

      const result = await this.processUserNotifications(notification.user_id, [notification]);
      return { success: true, result };

    } catch (error) {
      console.error('❌ Error triggering notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Get processing stats
  getProcessingStats() {
    return {
      isProcessing: this.isProcessing,
      batchSize: this.batchSize,
    };
  }
}

export default new NotificationProcessor();