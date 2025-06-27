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
