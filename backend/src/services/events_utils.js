import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import notificationGenerator from "../scheduler/notificationGenerator.js"
dayjs.extend(utc);
dayjs.extend(timezone);

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Constants
const IST_TIMEZONE = 'Asia/Kolkata';
const NOTIFICATION_BUFFER_MINUTES = 2;
const MAX_NOTIFICATION_ENTRIES = 10;

export function debugNotificationTimes(eventDate, notificationSchedule) {
  console.log("=== DEBUG NOTIFICATION TIMES ===");
  console.log("Event Date:", eventDate);
  console.log("Current Time (IST):", dayjs().tz(IST_TIMEZONE).format());
  console.log("Event Time (IST):", dayjs(eventDate).tz(IST_TIMEZONE).format());

  notificationSchedule.forEach(scheduleType => {
    const notificationTime = calculateNotificationTime(eventDate, scheduleType);
    const isInFuture = dayjs(notificationTime).isAfter(dayjs());

    console.log(`\n${scheduleType}:`);
    console.log(`  Notification Time (IST): ${dayjs(notificationTime).tz(IST_TIMEZONE).format()}`);
    console.log(`  Is in future: ${isInFuture}`);
    console.log(`  Time difference: ${dayjs(notificationTime).diff(dayjs(), 'minute')} minutes`);
  });
}

export async function saveEvent(event) {
  try {
    // Ensure event_date is properly formatted as UTC
    const eventData = {
      ...event,
      event_date: dayjs(event.event_date).utc().toISOString()
    };
    
    const { data, error } = await supabase.from("events").insert([eventData]).select();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('❌ Error saving event:', error);
    throw error;
  }
}

export async function createEventWithMessage(userId, sessionId, messageData, eventData) {
  const client = supabase;
  
  try {
    console.log('🔍 Creating event with message:', {
      userId,
      sessionId,
      messageId: messageData.id,
      eventDate: eventData.event_date,
      category: eventData.event_type,
      priority: eventData.priority,
      notificationSchedule: eventData.notification_schedule
    });

    // Start a transaction-like approach
    const { data: messageResult, error: messageError } = await client
      .from('mess')
      .upsert([{
        id: messageData.id,
        session_id: sessionId,
        user_id: userId,
        role: messageData.role,
        content: messageData.content,
        created_at: messageData.created_at,
      }], {
        onConflict: 'id',
        ignoreDuplicates: false
      })
      .select();

    if (messageError) {
      console.error('❌ Error upserting message:', messageError);
      throw messageError;
    }

    console.log('✅ Message upserted successfully');

    // Create the main event with proper timezone handling
    const eventToCreate = {
      user_id: userId,
      message_id: messageData.id,
      event_date: dayjs(eventData.event_date).utc().toISOString(),
      event_summary: eventData.event_summary,
      event_type: eventData.event_type || 'reminder',
      priority: eventData.priority || 'medium',
      description: eventData.description || eventData.event_summary,
      notification_schedule: eventData.notification_schedule || ['same_day'],
      notified: false,
      created_at: dayjs().utc().toISOString(),
      updated_at: dayjs().utc().toISOString()
    };

    const { data: eventResult, error: eventError } = await client
      .from("events")
      .insert([eventToCreate])
      .select();

    if (eventError) {
      console.error('❌ Error creating event:', eventError);
      throw eventError;
    }

    console.log('✅ Successfully created main event');

    // Create individual notification entries
    const eventId = eventResult[0].id;
    const notificationEntries = await notificationGenerator.generateNotificationsForEvent(
      eventId,
      userId,
      eventData.event_date,
      eventData.event_summary,
      eventData.event_type,
      eventData.notification_schedule || ['same_day'],
      eventData.priority
    );

    console.log(`✅ Created ${notificationEntries.length} notification entries`);

    return {
      message: messageResult,
      event: eventResult,
      notifications: notificationEntries
    };

  } catch (error) {
    console.error('❌ Error in createEventWithMessage:', error);
    throw error;
  }
}

function getAdaptiveSchedule(timeUntilEvent, eventType = 'reminder') {
  // Priority-based scheduling for different event types
  const urgentTypes = ['exam', 'appointment', 'medication', 'deadline'];
  const isUrgent = urgentTypes.includes(eventType);
  
  if (timeUntilEvent <= 1) {
    return ['immediate']; // Immediate notification
  } else if (timeUntilEvent <= 3) {
    return ['five_minutes_before'];
  } else if (timeUntilEvent <= 5) {
    return ['five_minutes_before'];
  } else if (timeUntilEvent <= 10) {
    return ['five_minutes_before'];
  } else if (timeUntilEvent <= 15) {
    return isUrgent ? ['five_minutes_before', 'fifteen_minutes_before'] : ['fifteen_minutes_before'];
  } else if (timeUntilEvent <= 30) {
    return isUrgent ? ['fifteen_minutes_before', 'thirty_minutes_before'] : ['thirty_minutes_before'];
  } else if (timeUntilEvent <= 60) {
    return isUrgent ? ['thirty_minutes_before', 'one_hour_before'] : ['one_hour_before'];
  } else if (timeUntilEvent <= 120) {
    return ['one_hour_before'];
  } else if (timeUntilEvent <= 1440) { // Within 24 hours
    return ['same_day'];
  } else {
    return ['one_day_before'];
  }
}


function createFallbackNotification(eventId, userId, eventSummary, eventType, priority, now, timeUntilEvent) {
  let fallbackTime;
  let fallbackType;
  
  if (timeUntilEvent <= 0.5) {
    fallbackTime = now.add(10, 'second');
    fallbackType = "immediate";
    console.log("🚨 Event is within 30 seconds - immediate notification");
  } else if (timeUntilEvent <= 1) {
    fallbackTime = now.add(30, 'second');
    fallbackType = "urgent";
    console.log("🚨 Event is within 1 minute - urgent notification");
  } else if (timeUntilEvent <= 3) {
    fallbackTime = now.add(1, 'minute');
    fallbackType = "very_soon";
    console.log("⚡ Event is within 3 minutes - very soon notification");
  } else if (timeUntilEvent <= 5) {
    fallbackTime = now.add(1, 'minute');
    fallbackType = "soon";
    console.log("⚡ Event is within 5 minutes - soon notification");
  } else if (timeUntilEvent <= 15) {
    fallbackTime = now.add(2, 'minute');
    fallbackType = "upcoming";
    console.log("⏰ Event is within 15 minutes - upcoming notification");
  } else {
    fallbackTime = now.add(3, 'minute');
    fallbackType = "fallback";
    console.log("📅 Standard fallback notification");
  }
  
  return {
    event_id: eventId,
    user_id: userId,
    notification_time: fallbackTime.utc().toISOString(),
    notification_type: fallbackType,
    event_summary: eventSummary,
    event_type: eventType,
    priority: priority,
    sent: false,
    created_at: now.utc().toISOString(),
    event_date: null 
  };
}

function calculateNotificationTime(eventDateTime, scheduleType) {
  try {
    // Parse the event time and ensure it's in IST
    const eventTime = dayjs(eventDateTime).tz(IST_TIMEZONE);
    const now = dayjs().tz(IST_TIMEZONE);
    
    console.log(`📅 Calculating ${scheduleType} for event: ${eventTime.format()}`);
    console.log(`🕐 Current time: ${now.format()}`);

    let notificationTime;
    const timeUntilEvent = eventTime.diff(now, 'minute');
    
    console.log(`⏱️ Time until event: ${timeUntilEvent} minutes`);

    switch (scheduleType) {
      case 'immediate':
        notificationTime = now.add(5, 'second');
        break;

      case 'one_week_before':
        notificationTime = eventTime.subtract(7, 'day');
        break;

      case 'three_days_before':
        notificationTime = eventTime.subtract(3, 'day');
        break;

      case 'one_day_before':
        notificationTime = eventTime.subtract(1, 'day');
        break;

      case 'same_day_morning':
        notificationTime = eventTime.startOf('day').hour(9).minute(0).second(0);
        // If event is before 9 AM, set for previous day
        if (eventTime.hour() < 9) {
          notificationTime = notificationTime.subtract(1, 'day');
        }
        break;

      case 'same_day':
        notificationTime = calculateSameDayNotification(eventTime, now, timeUntilEvent);
        break;

      case 'one_hour_before':
        if (timeUntilEvent <= 60) {
          const bufferMinutes = Math.max(3, Math.floor(timeUntilEvent * 0.6));
          notificationTime = eventTime.subtract(bufferMinutes, 'minute');
          console.log(`⚡ Event too soon for 1 hour notice, scheduling ${bufferMinutes} minutes before`);
        } else {
          notificationTime = eventTime.subtract(1, 'hour');
        }
        break;

      case 'thirty_minutes_before':
        if (timeUntilEvent <= 30) {
          const bufferMinutes = Math.max(2, Math.floor(timeUntilEvent * 0.6));
          notificationTime = eventTime.subtract(bufferMinutes, 'minute');
          console.log(`⚡ Event too soon for 30 min notice, scheduling ${bufferMinutes} minutes before`);
        } else {
          notificationTime = eventTime.subtract(30, 'minute');
        }
        break;

      case 'fifteen_minutes_before':
        if (timeUntilEvent <= 15) {
          const bufferMinutes = Math.max(1, Math.floor(timeUntilEvent * 0.6));
          notificationTime = eventTime.subtract(bufferMinutes, 'minute');
          console.log(`⚡ Event too soon for 15 min notice, scheduling ${bufferMinutes} minutes before`);
        } else {
          notificationTime = eventTime.subtract(15, 'minute');
        }
        break;

      case 'five_minutes_before':
        if (timeUntilEvent <= 5) {
          const bufferMinutes = Math.max(0.5, Math.floor(timeUntilEvent * 0.6));
          notificationTime = eventTime.subtract(bufferMinutes, 'minute');
          console.log(`⚡ Event too soon for 5 min notice, scheduling ${bufferMinutes} minutes before`);
        } else {
          notificationTime = eventTime.subtract(5, 'minute');
        }
        break;

      default:
        console.log(`⚠️ Unknown schedule type: ${scheduleType}, using same_day logic`);
        notificationTime = calculateSameDayNotification(eventTime, now, timeUntilEvent);
        break;
    }

    // Final validation - ensure notification time is in the future
    if (notificationTime.isBefore(now)) {
      console.log(`⚠️ Calculated time ${notificationTime.format()} is in the past, adjusting...`);
      notificationTime = getEmergencyNotificationTime(eventTime, now, timeUntilEvent);
    }

    console.log(`⏰ ${scheduleType} calculated as: ${notificationTime.format()}`);
    return notificationTime.toDate();

  } catch (error) {
    console.error(`❌ Error calculating notification time for ${scheduleType}:`, error);
    return null;
  }
}

function calculateSameDayNotification(eventTime, now, timeUntilEvent) {
  let notificationTime;
  
  if (timeUntilEvent > 480) { // More than 8 hours away
    notificationTime = eventTime.subtract(4, 'hour');
  } else if (timeUntilEvent > 240) { // 4-8 hours away
    notificationTime = eventTime.subtract(2, 'hour');
  } else if (timeUntilEvent > 120) { // 2-4 hours away
    notificationTime = eventTime.subtract(1, 'hour');
  } else if (timeUntilEvent > 60) { // 1-2 hours away
    notificationTime = eventTime.subtract(30, 'minute');
  } else if (timeUntilEvent > 30) { // 30-60 minutes away
    notificationTime = eventTime.subtract(15, 'minute');
  } else if (timeUntilEvent > 15) { // 15-30 minutes away
    notificationTime = eventTime.subtract(8, 'minute');
  } else if (timeUntilEvent > 10) { // 10-15 minutes away
    notificationTime = eventTime.subtract(5, 'minute');
  } else if (timeUntilEvent > 5) { // 5-10 minutes away
    notificationTime = eventTime.subtract(3, 'minute');
  } else if (timeUntilEvent > 2) { // 2-5 minutes away
    notificationTime = eventTime.subtract(1, 'minute');
  } else { // Less than 2 minutes away
    notificationTime = now.add(20, 'second');
  }
  
  console.log(`🎯 Same day notification: ${timeUntilEvent} mins until event → notify ${eventTime.diff(notificationTime, 'minute')} mins before`);
  return notificationTime;
}

function getEmergencyNotificationTime(eventTime, now, timeUntilEvent) {
  if (timeUntilEvent <= 0.5) {
    return now.add(5, 'second');
  } else if (timeUntilEvent <= 1) {
    return now.add(15, 'second');
  } else if (timeUntilEvent <= 3) {
    return eventTime.subtract(1, 'minute');
  } else if (timeUntilEvent <= 5) {
    return eventTime.subtract(2, 'minute');
  } else if (timeUntilEvent <= 10) {
    return eventTime.subtract(3, 'minute');
  } else {
    return eventTime.subtract(5, 'minute');
  }
}

export async function createEventWithoutMessage(userId, eventData) {
  try {
    const eventToCreate = {
      user_id: userId,
      event_date: dayjs(eventData.event_date).utc().toISOString(),
      event_summary: eventData.event_summary,
      event_type: eventData.event_type || 'reminder',
      priority: eventData.priority || 'medium',
      description: eventData.description || eventData.event_summary,
      notification_schedule: eventData.notification_schedule || ['same_day'],
      notified: false,
      created_at: dayjs().utc().toISOString(),
      updated_at: dayjs().utc().toISOString()
    };

    const { data, error } = await supabase
      .from("events")
      .insert([eventToCreate])
      .select();

    if (error) throw error;

    const eventId = data[0].id;
    const notificationEntries = await notificationGenerator.generateNotificationsForEvent(
      eventId,
      userId,
      eventData.event_date,
      eventData.event_summary,
      eventData.event_type,
      eventData.notification_schedule || ['same_day'],
      eventData.priority
    );

    return { event: data, notifications: notificationEntries };
  } catch (error) {
    console.error('❌ Error creating event without message:', error);
    throw error;
  }
}

export async function getUpcomingNotifications(limitMinutes = 10) {
  try {
    const now = dayjs().utc();
    const futureLimit = now.add(limitMinutes, 'minute');

    console.log(`🔍 Checking for notifications between ${now.format()} and ${futureLimit.format()}`);

    const { data, error } = await supabase
      .from("notifications")
      .select(`
        *,
        events!inner (
          event_date,
          event_summary,
          event_type,
          priority,
          user_id
        )
      `)
      .eq("sent", false)
      .lte("notification_time", futureLimit.toISOString())
      .gte("notification_time", now.subtract(NOTIFICATION_BUFFER_MINUTES, 'minute').toISOString())
      .order("priority", { ascending: false })
      .order("notification_time", { ascending: true });

    if (error) {
      console.error('❌ Error fetching upcoming notifications:', error);
      return [];
    }

    const validNotifications = (data || []).filter(notification => {
      const notificationTime = dayjs(notification.notification_time);
      const isValid = notificationTime.isAfter(now.subtract(NOTIFICATION_BUFFER_MINUTES, 'minute'));
      
      if (!isValid) {
        console.log(`⏳ Filtering out expired notification: ${notification.id}`);
      }
      
      return isValid;
    }).map(notification => ({
      ...notification,
      // Flatten the event data for backward compatibility
      event_date: notification.event_date || notification.events.event_date,
      event_summary: notification.event_summary || notification.events.event_summary,
      event_type: notification.event_type || notification.events.event_type,
      priority: notification.priority || notification.events.priority
    }));

    console.log(`📬 Found ${validNotifications.length} valid notifications to process`);
    return validNotifications;

  } catch (error) {
    console.error('❌ Error in getUpcomingNotifications:', error);
    return [];
  }
}

export async function markNotificationAsSent(notificationId) {
  try {
    const { error } = await supabase
      .from("notifications")
      .update({ 
        sent: true, 
        sent_at: dayjs().utc().toISOString() 
      })
      .eq("id", notificationId);

    if (error) {
      console.error('❌ Error marking notification as sent:', error);
      throw error;
    }

    console.log(`✅ Notification ${notificationId} marked as sent`);
    return true;
  } catch (error) {
    console.error('❌ Error in markNotificationAsSent:', error);
    throw error;
  }
}

// Utility function to get current IST time
export function getCurrentISTTime() {
  return dayjs().tz(IST_TIMEZONE);
}

// Utility function to convert any time to IST
export function toIST(dateTime) {
  return dayjs(dateTime).tz(IST_TIMEZONE);
}

// Utility function to get time difference in human readable format
export function getTimeDifference(futureTime, currentTime = dayjs()) {
  const future = dayjs(futureTime);
  const current = dayjs(currentTime);
  
  const diffInMinutes = future.diff(current, 'minute');
  const diffInHours = future.diff(current, 'hour');
  const diffInDays = future.diff(current, 'day');
  
  if (diffInMinutes < 1) {
    return 'now';
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''}`;
  } else if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''}`;
  } else {
    return `${diffInDays} day${diffInDays !== 1 ? 's' : ''}`;
  }
}

export function getNotificationPriority(eventType, timeUntilEvent) {
  const urgentTypes = ['exam', 'appointment', 'medication', 'deadline'];
  const importantTypes = ['work', 'travel', 'birthday'];
  
  if (timeUntilEvent <= 5) {
    return 'high';
  } else if (urgentTypes.includes(eventType)) {
    return 'high';
  } else if (importantTypes.includes(eventType)) {
    return 'medium';
  } else {
    return 'low';
  }
}

export function validateNotificationSchedule(schedule, eventType) {
  const validScheduleTypes = [
    'immediate',
    'five_minutes_before',
    'fifteen_minutes_before',
    'thirty_minutes_before',
    'one_hour_before',
    'same_day',
    'same_day_morning',
    'one_day_before',
    'three_days_before',
    'one_week_before'
  ];
  
  return schedule.filter(type => validScheduleTypes.includes(type));
}

// Batch notification operations for efficiency
export async function batchCreateNotifications(notifications) {
  try {
    if (!notifications || notifications.length === 0) {
      return [];
    }
    
    const { data, error } = await supabase
      .from("notifications")
      .insert(notifications)
      .select();

    if (error) {
      console.error('❌ Error batch creating notifications:', error);
      throw error;
    }

    console.log(`✅ Batch created ${data.length} notifications`);
    return data;
  } catch (error) {
    console.error('❌ Error in batchCreateNotifications:', error);
    throw error;
  }
}

export async function batchMarkNotificationsAsSent(notificationIds) {
  try {
    if (!notificationIds || notificationIds.length === 0) {
      return;
    }
    
    const { error } = await supabase
      .from("notifications")
      .update({ 
        sent: true, 
        sent_at: dayjs().utc().toISOString() 
      })
      .in("id", notificationIds);

    if (error) {
      console.error('❌ Error batch marking notifications as sent:', error);
      throw error;
    }

    console.log(`✅ Batch marked ${notificationIds.length} notifications as sent`);
  } catch (error) {
    console.error('❌ Error in batchMarkNotificationsAsSent:', error);
    throw error;
  }
}