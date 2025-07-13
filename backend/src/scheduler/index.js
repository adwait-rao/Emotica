import notificationScheduler from './notificationScheduler.js';
import notificationProcessor from './notificationProcessor.js';
import notificationGenerator from './notificationGenerator.js';
import { getCurrentISTTime } from '../services/events_utils.js';

class SchedulerManager {
  constructor() {
    this.initialized = false;
    this.startTime = null;
  }

  // Initialize the entire scheduler system
  async initialize() {
    if (this.initialized) {
      console.log('⚠️ Scheduler system already initialized');
      return;
    }

    try {
      this.startTime = getCurrentISTTime();
      
      console.log('🚀 Initializing notification scheduler system...');
      console.log(`📅 Start time: ${this.startTime.format('YYYY-MM-DD HH:mm:ss IST')}`);
      
      // Start the main scheduler
      notificationScheduler.start();
      
      // Run initial notification processing
      console.log('🔄 Running initial notification processing...');
      await notificationProcessor.processPendingNotifications();
      
      this.initialized = true;
      
      console.log('✅ Notification scheduler system initialized successfully');
      console.log('🎯 System is now monitoring and processing notifications');
      
    } catch (error) {
      console.error('❌ Failed to initialize scheduler system:', error);
      throw error;
    }
  }

  // Shutdown the scheduler system gracefully
  async shutdown() {
    if (!this.initialized) {
      console.log('⚠️ Scheduler system is not initialized');
      return;
    }

    try {
      console.log('🛑 Shutting down notification scheduler system...');
      
      // Stop the scheduler
      notificationScheduler.stop();
      
      // Wait for any ongoing processing to complete
      let attempts = 0;
      while (notificationProcessor.getProcessingStats().isProcessing && attempts < 10) {
        console.log('⏳ Waiting for ongoing processing to complete...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
      
      this.initialized = false;
      
      const endTime = getCurrentISTTime();
      const uptime = endTime.diff(this.startTime, 'seconds');
      
      console.log('✅ Scheduler system shutdown completed');
      console.log(`⏱️ Total uptime: ${uptime} seconds`);
      
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      throw error;
    }
  }

  // Get system status
  getSystemStatus() {
    return {
      initialized: this.initialized,
      startTime: this.startTime?.format('YYYY-MM-DD HH:mm:ss IST') || null,
      uptime: this.startTime ? getCurrentISTTime().diff(this.startTime, 'seconds') : 0,
      schedulerStatus: notificationScheduler.getStatus(),
      processorStats: notificationProcessor.getProcessingStats()
    };
  }

  // Health check for the entire system
  async performSystemHealthCheck() {
    console.log('🔍 Performing system health check...');
    
    const status = this.getSystemStatus();
    
    console.log('📊 System Health Report:');
    console.log(`   - System initialized: ${status.initialized}`);
    console.log(`   - Uptime: ${status.uptime} seconds`);
    console.log(`   - Scheduler running: ${status.schedulerStatus.isRunning}`);
    console.log(`   - Active tasks: ${status.schedulerStatus.tasksCount}`);
    console.log(`   - Processor busy: ${status.processorStats.isProcessing}`);
    
    // Test database connectivity
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
      
      const { data, error } = await supabase
        .from('notifications')
        .select('count(*)', { count: 'exact' })
        .eq('sent', false)
        .limit(1);

      if (error) {
        console.error('❌ Database health check failed:', error);
        return { healthy: false, error: error.message };
      } else {
        console.log('✅ Database connection healthy');
        console.log(`   - Pending notifications: ${data[0]?.count || 0}`);
      }
      
    } catch (error) {
      console.error('❌ Database health check error:', error);
      return { healthy: false, error: error.message };
    }
    
    return { healthy: true, status };
  }

  // Manual trigger for immediate processing
  async triggerManualProcessing() {
    console.log('🔧 Manual processing triggered');
    await notificationScheduler.triggerManualRun();
  }

  // Restart the entire system
  async restart() {
    console.log('🔄 Restarting scheduler system...');
    await this.shutdown();
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    await this.initialize();
  }

  // Process a specific notification by ID (for testing)
  async processSpecificNotification(notificationId) {
    console.log(`🎯 Processing specific notification: ${notificationId}`);
    return await notificationProcessor.triggerNotificationById(notificationId);
  }

  // Generate notifications for a new event
  async generateNotificationsForEvent(eventId, userId, eventDate, eventSummary, eventType, notificationSchedule, priority = 'medium') {
    console.log(`📝 Generating notifications for event: ${eventId}`);
    return await notificationGenerator.generateNotificationsForEvent(
      eventId, 
      userId, 
      eventDate, 
      eventSummary, 
      eventType, 
      notificationSchedule, 
      priority
    );
  }
}

// Create and export singleton instance
const schedulerManager = new SchedulerManager();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT signal, shutting down gracefully...');
  await schedulerManager.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM signal, shutting down gracefully...');
  await schedulerManager.shutdown();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  console.error('❌ Uncaught Exception:', error);
  await schedulerManager.shutdown();
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  await schedulerManager.shutdown();
  process.exit(1);
});

export default schedulerManager;

// Export individual components for direct access if needed
export {
  notificationScheduler,
  notificationProcessor,
  notificationGenerator
};