import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export async function saveEvent(event) {
  const { data, error } = await supabase.from("events").insert([event]);
  if (error) throw error;
  return data;
}

// Enhanced function to create event with proper message handling and notification scheduling
export async function createEventWithMessage(userId, sessionId, messageData, eventData) {
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

    // First, ensure the message exists in Supabase
    const { data: messageResult, error: messageError } = await supabase
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

    // Create the main event
    const eventToCreate = {
      user_id: userId,
      message_id: messageData.id,
      event_date: eventData.event_date,
      event_summary: eventData.event_summary,
      event_type: eventData.event_type || 'reminder',
      priority: eventData.priority || 'medium',
      description: eventData.description || eventData.event_summary,
      notification_schedule: eventData.notification_schedule || ['same_day'],
      notified: false,
    };

    const { data: eventResult, error: eventError } = await supabase
      .from("events")
      .insert([eventToCreate])
      .select();

    if (eventError) {
      console.error('❌ Error creating event:', eventError);
      throw eventError;
    }

    console.log('✅ Successfully created main event');

    // Create individual notification entries based on the notification schedule
    const eventId = eventResult[0].id;
    const notificationEntries = await createNotificationEntries(
      eventId,
      userId,
      eventData.event_date,
      eventData.notification_schedule || ['same_day'],
      eventData.event_summary,
      eventData.event_type
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

// Create individual notification entries for different notification times
async function createNotificationEntries(eventId, userId, eventDate, notificationSchedule, eventSummary, eventType) {
  try {
    const eventDateTime = new Date(eventDate);
    const notificationEntries = [];
    const now = new Date();
    const bufferMs = 2 * 60 * 1000; // 2-minute grace buffer

    for (const scheduleType of notificationSchedule) {
      const notificationTime = calculateNotificationTime(eventDateTime, scheduleType);

      if (!notificationTime) {
        console.log(`⚠️ Skipped ${scheduleType} - could not calculate time`);
        continue;
      }

      if (notificationTime.getTime() > now.getTime() - bufferMs) {
        const notificationEntry = {
          event_id: eventId,
          user_id: userId,
          notification_time: notificationTime.toISOString(),
          notification_type: scheduleType,
          event_summary: eventSummary,
          event_type: eventType,
          sent: false,
          created_at: new Date().toISOString()
        };

        notificationEntries.push(notificationEntry);
      } else {
        console.log(`⏳ Skipped ${scheduleType} - time (${notificationTime.toISOString()}) already passed`);
      }
    }

    // Optional fallback notification if all skipped
    if (notificationEntries.length === 0) {
      const fallbackTime = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now
      notificationEntries.push({
        event_id: eventId,
        user_id: userId,
        notification_time: fallbackTime.toISOString(),
        notification_type: "fallback",
        event_summary: eventSummary,
        event_type: eventType,
        sent: false,
        created_at: now.toISOString()
      });
      console.log("⚠️ All scheduled notifications skipped. Added fallback notification for 5 minutes later.");
    }

    const { data, error } = await supabase
      .from("notifications")
      .insert(notificationEntries)
      .select();

    if (error) {
      console.error('❌ Error creating notification entries:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('❌ Error in createNotificationEntries:', error);
    throw error;
  }
}
const eventDate = '2025-07-04T14:36:00';
const notificationSchedule = ['same_day_morning', 'thirty_minutes_before'];
// Calculate when to send notification based on schedule type
function calculateNotificationTime(eventDateTime, scheduleType) {
  const eventTime = new Date(eventDateTime);

  switch (scheduleType) {
    case 'one_week_before':
      return new Date(eventTime.getTime() - (7 * 24 * 60 * 60 * 1000));

    case 'three_days_before':
      return new Date(eventTime.getTime() - (3 * 24 * 60 * 60 * 1000));

    case 'one_day_before':
      return new Date(eventTime.getTime() - (24 * 60 * 60 * 1000));

    case 'same_day_morning':
      const morningTime = new Date(eventTime);
      morningTime.setUTCHours(9, 0, 0, 0); // 9 AM
      return morningTime;

    case 'same_day':
      return new Date(eventTime.getTime() - (2 * 60 * 60 * 1000)); // 2 hours before

    case 'one_hour_before':
      return new Date(eventTime.getTime() - (60 * 60 * 1000));

    case 'thirty_minutes_before':
      return new Date(eventTime.getTime() - (30 * 60 * 1000));

    default:
      return new Date(eventTime.getTime() - (2 * 60 * 60 * 1000)); // Default: 2 hours before
  }
}

console.log("=== DEBUG NOTIFICATION TIMES ===");
console.log("Event Date:", eventDate);
console.log("Current Time:", new Date().toISOString());
console.log("Event Time:", new Date(eventDate).toISOString());

notificationSchedule.forEach(scheduleType => {
  const notificationTime = calculateNotificationTime(eventDate, scheduleType);
  const isInFuture = notificationTime > new Date();

  console.log(`\n${scheduleType}:`);
  console.log(`  Notification Time: ${notificationTime.toISOString()}`);
  console.log(`  Is in future: ${isInFuture}`);
  console.log(`  Time difference: ${(notificationTime.getTime() - new Date().getTime()) / 1000 / 60} minutes`);
});

// Check what would happen if we were creating this now
const currentTime = new Date();
const eventTime = new Date(eventDate);
const thirtyMinutesBefore = new Date(eventTime.getTime() - (30 * 60 * 1000));

console.log("\n=== DETAILED THIRTY MINUTES BEFORE ===");
console.log("Event time:", eventTime.toISOString());
console.log("30 minutes before:", thirtyMinutesBefore.toISOString());
console.log("Current time:", currentTime.toISOString());
console.log("Is 30min before in future?", thirtyMinutesBefore > currentTime);
console.log("Difference in minutes:", (thirtyMinutesBefore.getTime() - currentTime.getTime()) / 1000 / 60);
// Create event without message reference (alternative approach)
export async function createEventWithoutMessage(userId, eventData) {
  try {
    const eventToCreate = {
      user_id: userId,
      event_date: eventData.event_date,
      event_summary: eventData.event_summary,
      event_type: eventData.event_type || 'reminder',
      priority: eventData.priority || 'medium',
      description: eventData.description || eventData.event_summary,
      notification_schedule: eventData.notification_schedule || ['same_day'],
      notified: false,
    };

    const { data, error } = await supabase
      .from("events")
      .insert([eventToCreate])
      .select();

    if (error) throw error;

    // Create notification entries for this event too
    const eventId = data[0].id;
    const notificationEntries = await createNotificationEntries(
      eventId,
      userId,
      eventData.event_date,
      eventData.notification_schedule || ['same_day'],
      eventData.event_summary,
      eventData.event_type
    );

    return { event: data, notifications: notificationEntries };
  } catch (error) {
    console.error('❌ Error creating event without message:', error);
    throw error;
  }
}

// Get upcoming notifications that need to be sent
export async function getUpcomingNotifications() {
  try {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("sent", false)
      .lte("notification_time", now)
      .order("notification_time", { ascending: true });

    if (error) {
      console.error('❌ Error fetching upcoming notifications:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Error in getUpcomingNotifications:', error);
    return [];
  }
}

// Mark notification as sent
export async function markNotificationAsSent(notificationId) {
  try {
    const { error } = await supabase
      .from("notifications")
      .update({ sent: true, sent_at: new Date().toISOString() })
      .eq("id", notificationId);

    if (error) {
      console.error('❌ Error marking notification as sent:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('❌ Error in markNotificationAsSent:', error);
    throw error;
  }
}