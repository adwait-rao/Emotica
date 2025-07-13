import { createClient } from "@supabase/supabase-js";
import { getCurrentISTTime, toIST } from "../services/events_utils.js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

class NotificationGenerator {
  constructor() {
    this.notificationTypes = {
      'one_week_before': { days: 7, hours: 0 },
      'three_days_before': { days: 3, hours: 0 },
      'one_day_before': { days: 1, hours: 0 },
      'same_day_morning': { days: 0, hours: 9, setTime: true }, // 9 AM
      'same_day': { days: 0, hours: 2 }, // 2 hours before
      'one_hour_before': { days: 0, hours: 1 },
      'thirty_minutes_before': { days: 0, hours: 0, minutes: 30 },
      'fifteen_minutes_before': { days: 0, hours: 0, minutes: 15 },
      'five_minutes_before': { days: 0, hours: 0, minutes: 5 }
    };
  }

  // Generate notifications for a new event
  async generateNotificationsForEvent(eventId, userId, eventDate, eventSummary, eventType, notificationSchedule, priority = 'medium') {
    const notifications = [];
    
    for (const scheduleType of notificationSchedule) {
      const notificationTime = this.calculateNotificationTime(eventDate, scheduleType);
      
      // Only create notification if it's in the future
      if (notificationTime.isAfter(getCurrentISTTime())) {
        notifications.push({
          event_id: eventId,
          user_id: userId,
          notification_time: notificationTime.utc().toISOString(),
          notification_type: scheduleType,
          event_summary: eventSummary,
          event_type: eventType,
          priority: priority,
          sent: false,
          event_date: eventDate,
        });
      }
    }

    if (notifications.length > 0) {
      const { data, error } = await supabase
        .from('notifications')
        .insert(notifications)
        .select();

      if (error) {
        console.error('❌ Error creating notifications:', error);
        return { success: false, error: error.message };
      }

      console.log(`✅ Created ${notifications.length} notifications for event ${eventId}`);
      return { success: true, count: notifications.length, notifications: data };
    }

    return { success: true, count: 0, notifications: [] };
  }

  calculateNotificationTime(eventDate, scheduleType) {
    const eventDateTime = toIST(eventDate);
    const config = this.notificationTypes[scheduleType];
    
    if (!config) {
      throw new Error(`Unknown schedule type: ${scheduleType}`);
    }

    const notificationTime = eventDateTime.clone();
    
    // Handle special case for same_day_morning
    if (config.setTime) {
      notificationTime.hour(config.hours).minute(0).second(0);
      // If the event is before 9 AM, set notification for previous day
      if (eventDateTime.hour() < config.hours) {
        notificationTime.subtract(1, 'day');
      }
    } else {
      // Subtract time from event date
      if (config.days) {
        notificationTime.subtract(config.days, 'days');
      }
      if (config.hours) {
        notificationTime.subtract(config.hours, 'hours');
      }
      if (config.minutes) {
        notificationTime.subtract(config.minutes, 'minutes');
      }
    }

    return notificationTime;
  }

  // Enhanced notification message templates with IST timestamps
  getNotificationMessage(notification) {
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
  getNotificationMeta(notification) {
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

  // Get action buttons based on event type
  getActionButtons(eventType) {
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
  
  // Generate FCM notification title
  generateFCMTitle(notification) {
    const meta = this.getNotificationMeta(notification);
    return `${meta.categoryEmoji} ${notification.event_type.charAt(0).toUpperCase() + notification.event_type.slice(1)} Reminder`;
  }

  // Generate FCM notification body
  generateFCMBody(notification) {
    return this.getNotificationMessage(notification);
  }
}

export default new NotificationGenerator();