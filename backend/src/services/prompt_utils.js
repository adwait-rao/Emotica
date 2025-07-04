import dayjs from "dayjs";

export function buildSystemPrompt({
  redisChatHistory = [],
  similarMessages = [],
  currentMessage,
}) 
{
  const safeRedisHistory = Array.isArray(redisChatHistory) ? redisChatHistory : [];
  const safeSimilarMessages = Array.isArray(similarMessages) ? similarMessages : [];
  
  console.log("🔍 buildSystemPrompt inputs:");
  console.log("  - redisChatHistory:", safeRedisHistory.length, "messages");
  console.log("  - similarMessages:", safeSimilarMessages.length, "messages");
  console.log("  - currentMessage:", currentMessage);

   const formattedChat = safeRedisHistory
    .map((m) => `• (${m.role || 'unknown'}) ${m.content || ''}`)
    .join("\n");

  const formattedSimilar = safeSimilarMessages
    .map((m) => `• ${m.text || m.content || ''}`)
    .join("\n");


  const currentDate = dayjs().toISOString();

  return `
You are a compassionate and emotionally aware mental health companion AI Agent.

Context You Have
Current Chat History:
${formattedChat || "No chat history available."}

Similar Past Messages:
${formattedSimilar || "No similar messages found."}

Given the message:
"${currentMessage}"

Respond kindly, naturally and offer advice, like a mental health companion based on similar messages and Chat history(This is very important).

Classify the message:
is_important: Is it emotionally or contextually significant? Include messages with names and information about people too.
is_event: Does it mention a specific time/date-based event?
If it's an event:
Extract event_date (ISO format) and a brief event_summary.

Return only a JSON object with the following fields:
 {
   "is_important": "yes" | "no",
   "is_event": "yes" | "no",
   "event_date": "YYYY-MM-DDTHH:MM:SS" | null,
   "event_summary": "..." | null,
   "reply": "Your supportive response to the user"
 }

Use ${currentDate} as the reference for resolving dates like “tomorrow” or “next Monday.”
`.trim();
}

export function buildEventCategorizationPrompt(eventSummary, eventDate, originalMessage) {
  const currentDate = dayjs().toISOString();
  
  return `
You are an AI assistant that categorizes events and determines appropriate notification schedules.

Original Message: "${originalMessage}"
Event Summary: "${eventSummary}"
Event Date: "${eventDate}"
Current Date: "${currentDate}"

Analyze this event and categorize it appropriately. Consider:

1. Event Categories:
   - "birthday" - birthdays, anniversaries, celebrations
   - "exam" - tests, exams, assessments, papers
   - "appointment" - medical appointments, meetings, interviews
   - "deadline" - project deadlines, submission dates, due dates
   - "workout" - gym sessions, exercise, sports activities
   - "medication" - taking medicine, health reminders
   - "social" - parties, gatherings, social events
   - "travel" - flights, trips, vacations
   - "work" - work tasks, meetings, presentations
   - "personal" - personal tasks, errands, chores
   - "reminder" - general reminders, miscellaneous

2. Priority Levels:
   - "high" - critical, urgent, cannot be missed
   - "medium" - important, should not be missed
   - "low" - nice to remember, not critical

3. Notification Schedule (when to notify):
   - "one_week_before" - 7 days before
   - "three_days_before" - 3 days before
   - "one_day_before" - 1 day before
   - "same_day_morning" - morning of the event (9 AM)
   - "same_day" - 2 hours before event
   - "one_hour_before" - 1 hour before
   - "thirty_minutes_before" - 30 minutes before

Guidelines:
- Birthdays: notify 1 day before and same day morning
- Exams: notify 3 days before, 1 day before, and same day morning
- Appointments: notify 1 day before and 1 hour before
- Deadlines: notify 1 week before, 3 days before, and 1 day before
- Workouts: notify same day morning and 30 minutes before
- Medication: notify same day and 1 hour before
- Social events: notify 1 day before and 2 hours before
- Travel: notify 1 day before and same day morning
- Work tasks: notify 1 day before and same day morning
- Personal tasks: notify same day morning
- General reminders: notify same day

Return only a JSON object:
{
  "category": "...",
  "priority": "high|medium|low",
  "notification_schedule": ["array", "of", "notification", "times"],
  "description": "Brief description of the event"
}
`.trim();
}