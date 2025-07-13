import cron from 'node-cron';
import notificationProcessor from './notificationProcessor.js';
import { getCurrentISTTime } from '../services/events_utils.js';

class NotificationScheduler {
  constructor() {
    this.isRunning = false;
    this.scheduledTasks = new Map();
  }

  start() {
    if (this.isRunning) {
      console.log('⚠️ Notification scheduler is already running');
      return;
    }

    // Main notification processor - runs every 5 minutes
    const mainTask = cron.schedule('*/5 * * * *', async () => {
      console.log(`🔄 Running notification processor at ${getCurrentISTTime().format('YYYY-MM-DD HH:mm:ss IST')}`);
      await notificationProcessor.processPendingNotifications();
    }, {
      scheduled: false,
      timezone: 'Asia/Kolkata'
    });

    // Cleanup old notifications - runs daily at 2 AM IST
    const cleanupTask = cron.schedule('0 2 * * *', async () => {
      console.log(`🧹 Running notification cleanup at ${getCurrentISTTime().format('YYYY-MM-DD HH:mm:ss IST')}`);
      await this.cleanupOldNotifications();
    }, {
      scheduled: false,
      timezone: 'Asia/Kolkata'
    });

    // Health check - runs every hour
    const healthTask = cron.schedule('0 * * * *', async () => {
      console.log(`❤️ Scheduler health check at ${getCurrentISTTime().format('YYYY-MM-DD HH:mm:ss IST')}`);
      await this.performHealthCheck();
    }, {
      scheduled: false,
      timezone: 'Asia/Kolkata'
    });

    // Store tasks for management
    this.scheduledTasks.set('main', mainTask);
    this.scheduledTasks.set('cleanup', cleanupTask);
    this.scheduledTasks.set('health', healthTask);

    // Start all tasks
    mainTask.start();
    cleanupTask.start();
    healthTask.start();

    this.isRunning = true;
    
    console.log('✅ Notification scheduler started successfully');
    console.log('📋 Scheduled tasks:');
    console.log('   - Main processor: Every 5 minutes');
    console.log('   - Cleanup: Daily at 2 AM IST');
    console.log('   - Health check: Every hour');
  }

  stop() {
    if (!this.isRunning) {
      console.log('⚠️ Notification scheduler is not running');
      return;
    }

    // Stop all scheduled tasks
    this.scheduledTasks.forEach((task, name) => {
      task.stop();
      console.log(`🛑 Stopped ${name} task`);
    });

    this.scheduledTasks.clear();
    this.isRunning = false;
    
    console.log('🛑 Notification scheduler stopped');
  }

  restart() {
    console.log('🔄 Restarting notification scheduler...');
    this.stop();
    setTimeout(() => {
      this.start();
    }, 1000);
  }

  // Manual trigger for immediate processing
  async triggerManualRun() {
    console.log('🚀 Manual notification processing triggered');
    await notificationProcessor.processPendingNotifications();
  }

  // Cleanup old sent notifications (older than 30 days)
  async cleanupOldNotifications() {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
      
      const thirtyDaysAgo = getCurrentISTTime().subtract(30, 'days').utc().toISOString();
      
      // Delete old sent notifications
      const { data, error } = await supabase
        .from('notifications')
        .delete()
        .eq('sent', true)
        .lt('sent_at', thirtyDaysAgo);

      if (error) {
        console.error('❌ Error during cleanup:', error);
      } else {
        console.log(`✅ Cleanup completed - removed old notifications`);
      }

      // Cleanup old in-app notifications (older than 7 days and read)
      const sevenDaysAgo = getCurrentISTTime().subtract(7, 'days').utc().toISOString();
      
      const { error: inAppError } = await supabase
        .from('in_app_notifications')
        .delete()
        .eq('is_read', true)
        .lt('created_at', sevenDaysAgo);

      if (inAppError) {
        console.error('❌ Error during in-app cleanup:', inAppError);
      } else {
        console.log('✅ In-app notifications cleanup completed');
      }

    } catch (error) {
      console.error('❌ Error in cleanupOldNotifications:', error);
    }
  }

  // Health check to ensure everything is working
  async performHealthCheck() {
    try {
      const stats = notificationProcessor.getProcessingStats();
      
      console.log('📊 Scheduler Health Status:');
      console.log(`   - Scheduler running: ${this.isRunning}`);
      console.log(`   - Processor busy: ${stats.isProcessing}`);
      console.log(`   - Batch size: ${stats.batchSize}`);
      console.log(`   - Active tasks: ${this.scheduledTasks.size}`);
      
      // Check database connection
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
      
      const { data, error } = await supabase
        .from('notifications')
        .select('count(*)', { count: 'exact' })
        .limit(1);

      if (error) {
        console.error('❌ Database connection issue:', error);
      } else {
        console.log('✅ Database connection healthy');
      }

    } catch (error) {
      console.error('❌ Health check failed:', error);
    }
  }

  // Get current status
  getStatus() {
    return {
      isRunning: this.isRunning,
      tasksCount: this.scheduledTasks.size,
      tasks: Array.from(this.scheduledTasks.keys()),
      processorStats: notificationProcessor.getProcessingStats()
    };
  }

  // Schedule a one-time notification processing at specific time
  scheduleOneTimeRun(cronExpression, description = 'One-time run') {
    const task = cron.schedule(cronExpression, async () => {
      console.log(`🎯 ${description} triggered at ${getCurrentISTTime().format('YYYY-MM-DD HH:mm:ss IST')}`);
      await notificationProcessor.processPendingNotifications();
      // Auto-destroy after execution
      task.destroy();
    }, {
      scheduled: true,
      timezone: 'Asia/Kolkata'
    });

    console.log(`⏰ One-time task scheduled: ${description} - ${cronExpression}`);
    return task;
  }
}

export default new NotificationScheduler();