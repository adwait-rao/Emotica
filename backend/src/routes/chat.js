import express from "express";
import { chatRateLimiter } from "../middleware/ratelimiter.js";
import { authenticate } from "../middleware/authentication.js";
import {
  storeMessage,
  getChatHistory,
  preloadChatHistory,
  setSessionStatus,
  getSessionStatus,
  getSessionId,
  clearUserSession,
  cacheSessionIdInRedis,
} from "../services/redis_utils.js";
import {
  upsertUserChat,
  upsertSingleMessage,
  loadAllUserMessages,
  createSession,
  endSession,
  ensureSessionExists,
  getLatestOpenSession,
} from "../services/supabase_utils.js";
import { createEventWithMessage } from "../services/events_utils.js";
import { getSimilarMessages, upsertIfNotSimilar } from "../services/pineconeService.js";
import { ChatOpenAI } from "@langchain/openai";
import { buildSystemPrompt, buildEventCategorizationPrompt } from "../services/prompt_utils.js";
import { z } from "zod";
import { format } from "date-fns";
import { StructuredOutputParser } from "langchain/output_parsers";

const router = express.Router();

const openai = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-4o",
  temperature: 0.7,
});

const baseParser = StructuredOutputParser.fromZodSchema(
  z.object({
    is_important: z.enum(["yes", "no"]),
    is_event: z.enum(["yes", "no"]),
    event_date: z.string().nullable(),
    event_summary: z.string().nullable(),
    reply: z.string(),
  })
);

// Enhanced function to categorize events using OpenAI
async function categorizeEventWithOpenAI(eventSummary, eventDate, userMessage) {
  try {
    const prompt = buildEventCategorizationPrompt(eventSummary, eventDate, userMessage);

    const result = await openai.invoke([
      { role: "system", content: prompt },
    ]);

    const rawOutput = result.content;
    const cleanOutput = rawOutput.replace(/```json|```/g, "").trim();

    let parsedCategory;
    try {
      parsedCategory = JSON.parse(cleanOutput);
    } catch (error) {
      console.error("❌ Failed to parse event categorization:", error);
      // Fallback to simple categorization
      parsedCategory = {
        category: "reminder",
        priority: "medium",
        notification_schedule: ["same_day"],
        description: eventSummary || "Event reminder"
      };
    }

    console.log("🎯 Event categorized:", parsedCategory);
    return parsedCategory;

  } catch (error) {
    console.error("❌ Error in OpenAI event categorization:", error);
    // Fallback to simple categorization
    return {
      category: "reminder",
      priority: "medium",
      notification_schedule: ["same_day"],
      description: eventSummary || "Event reminder"
    };
  }
}


// Helper function to validate UUID format
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuid && typeof uuid === 'string' && uuid !== 'null' && uuidRegex.test(uuid);
}





async function ensureValidSession(userId) {
  try {
    console.log("🔍 Checking session for user:", userId);

    let sessionId = await getSessionId(userId);
    const isSessionActive = await getSessionStatus(userId);

    console.log("📊 Session status:", { sessionId, isSessionActive });

    // Check if sessionId is valid UUID
    if (!isValidUUID(sessionId)) {
      console.log("❌ Invalid sessionId detected, clearing session...");
      await clearUserSession(userId);
      sessionId = null;
    }

    // If no valid session exists, create or find one
    if (!sessionId || !isSessionActive) {
      console.log("🔍 Looking for existing open session...");
      sessionId = await getLatestOpenSession(userId);

      if (!isValidUUID(sessionId)) {
        console.log("🆕 Creating new session...");
        sessionId = await createSession(userId);
        console.log("✅ Created new session:", sessionId);
      } else {
        console.log("🔄 Found existing session:", sessionId);
      }

      // Load past messages if any exist
      const pastMessages = await loadAllUserMessages(userId, sessionId);

      if (pastMessages.length > 0) {
        console.log(`📚 Preloading ${pastMessages.length} past messages`);
        await preloadChatHistory(userId, pastMessages);
      } else {
        console.log("📝 No past messages, caching session");
        await cacheSessionIdInRedis(userId, sessionId);
        await setSessionStatus(userId);
      }
    } else {
      console.log("✅ Using existing valid session:", sessionId);
      await ensureSessionExists(userId, sessionId);
    }

    // Double-check we have a valid UUID before returning
    if (!isValidUUID(sessionId)) {
      throw new Error(`Invalid sessionId generated: ${sessionId}`);
    }

    return sessionId;
  } catch (error) {
    console.error("❌ Error in ensureValidSession:", error);
    throw error;
  }
}

// Process message function - Enhanced version combining both approaches
async function processMessage(userId, sessionId, currentMessage) {
  try {
    // 1. Store user message in Redis first
    const userMessageData = await storeMessage(userId, "user", currentMessage);

    // 2. Immediately sync user message to Supabase for real-time updates
    await upsertSingleMessage(userId, sessionId, userMessageData);

    // 3. Get chat history and similar messages
    const fullChatHistory = await getChatHistory(userId);

    // 📌 FILTER: Only take the latest 10 messages
    const recentChatHistory = fullChatHistory.slice(-6);
    console.log(
      "🔍 Filtering chat history to latest 6 messages",
      recentChatHistory
    );

    console.log( `📊 Chat history: ${ fullChatHistory.length } total, using latest ${ recentChatHistory.length }`);
    const similarMessages = await getSimilarMessages(currentMessage, 3, userId);

    // 4. Build system prompt and get AI response
    let systemPrompt;

    try {
      // Try to use the imported buildSystemPrompt function
      systemPrompt = buildSystemPrompt({
      redisChatHistory: recentChatHistory, // Pass filtered history
      similarMessages,
      currentMessage,
    });
    } catch (error) {
      // Fallback to local implementation
      // systemPrompt = buildSystemPromptFallback(chatHistory, similarMessages, currentMessage);
      console.log("dont have buildSystemPromptFallback yet");
    }

    const result = await openai.invoke([
      { role: "system", content: systemPrompt },
    ]);

    // 5. Parse AI response
    const rawOutput = result.content;
    const cleanOutput = rawOutput.replace(/```json|```/g, "").trim();

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(cleanOutput);
    } catch (error) {
      console.error("❌ Failed to parse AI response:", error);
      parsedResponse = {
        is_important: "no",
        is_event: "no",
        event_date: null,
        event_summary: null,
        reply: cleanOutput,
      };
    }

    // 6. Store assistant message in Redis
    const assistantMessageData = await storeMessage(userId, "assistant", parsedResponse.reply);

    // 7. Immediately sync assistant message to Supabase
    await upsertSingleMessage(userId, sessionId, assistantMessageData);

    console.log("💾 Messages stored in database for session:", sessionId);

    // 8. Handle important messages - store in vector database
    if (parsedResponse.is_important === "yes") {
      try {
        const { upserted, similarMessages: pineconeMatches } =
          await upsertIfNotSimilar(userId, currentMessage, 0.8);

        if (!upserted && pineconeMatches.length > 0) {
          return {
            ...parsedResponse,
            similarMessages: pineconeMatches.map((m) => ({
              text: m.metadata?.chunk_text,
              score: m.score,
            })),
            info: "Similar message found, not upserted.",
          };
        }
      } catch (vectorError) {
        console.error("❌ Error storing in vector DB:", vectorError);
        // Continue execution even if vector storage fails
      }
    }

    // 9. Create event if needed - AFTER both messages are in Supabase
    if (parsedResponse.is_event === "yes" && parsedResponse.event_date) {
      try {
        // Use OpenAI to categorize the event
        const eventCategory = await categorizeEventWithOpenAI(
          parsedResponse.event_summary,
          parsedResponse.event_date,
          currentMessage
        );

        const eventResult = await createEventWithMessage(userId, sessionId, userMessageData, {
          event_date: parsedResponse.event_date,
          event_summary: parsedResponse.event_summary,
          event_type: eventCategory.category,
          priority: eventCategory.priority,
          notification_schedule: eventCategory.notification_schedule,
          description: eventCategory.description,
        });

        console.log("✅ Event created successfully:", eventResult?.event?.[0]?.id);

        // Add event info to response
        parsedResponse.event_created = {
          id: eventResult?.event?.[0]?.id,
          category: eventCategory.category,
          priority: eventCategory.priority,
          notification_schedule: eventCategory.notification_schedule
        };

      } catch (eventError) {
        console.error("❌ Failed to create event:", eventError);
        // Continue execution even if event creation fails
      }
    }

    return parsedResponse;
  } catch (error) {
    console.error("❌ Error in processMessage:", error);
    throw error;
  }
}

// 🟢 CHAT ENTRY POINT
router.post("/chat", authenticate,chatRateLimiter, async (req, res) => {
  const { message: currentMessage } = req.body;
  const userId = req.user.id;

  // Validate input
  if (!currentMessage || !currentMessage.trim()) {
    return res.status(400).json({ error: "Message is required and cannot be empty" });
  }

  try {
    console.log("🚀 Starting chat for user:", userId);

    // Ensure we have a valid session
    const sessionId = await ensureValidSession(userId);

    // Process the message
    const response = await processMessage(userId, sessionId, currentMessage);

    console.log("✅ Chat completed successfully");
    return res.json(response);

  } catch (err) {
    console.error("❌ Chat Error:", err);
    return res.status(500).json({
      error: "Server error",
      details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});


// Get chat history
router.get("/chat/history", authenticate, async (req, res) => {
  const userId = req.user.id;

  try {
    console.log("📚 Fetching chat history for user:", userId);

    // Clear Redis cache and reload from database
    await clearUserSession(userId);

    // Get the latest session
    const sessionId = await getLatestOpenSession(userId);

    // if (!sessionId) {
    //   return res.json({ userId, history: [] });
    // }

    // Load all messages for the user
    const pastMessages = await loadAllUserMessages(userId, sessionId);

    // Preload into Redis
    await preloadChatHistory(userId, pastMessages);
    await setSessionStatus(userId);

    console.log(`✅ Loaded ${pastMessages.length} messages from history`);
    return res.json({ userId, history: pastMessages });

  } catch (err) {
    console.error("❌ History Fetch Error:", err);
    return res.status(500).json({
      error: "Failed to fetch history",
      details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

// 🔴 End Session
router.post("/end-session", authenticate, async (req, res) => {
  const userId = req.user.id;

  try {
    console.log("🔚 Ending session for user:", userId);

    const sessionId = await getSessionId(userId);

    if (!isValidUUID(sessionId)) {
      console.log("⚠️ No valid session to end");
      return res.json({ message: "No active session to end" });
    }

    // Get final chat history
    const finalHistory = await getChatHistory(userId);

    // End the session in database
    await endSession(sessionId);

    // Save final chat history
    if (finalHistory.length > 0) {
      await upsertUserChat(userId, sessionId, finalHistory);
    }

    // Clear Redis cache
    await clearUserSession(userId);

    console.log("✅ Session ended successfully");
    return res.json({ message: "Session ended and saved successfully" });

  } catch (err) {
    console.error("❌ End Session Error:", err);
    return res.status(500).json({
      error: "Failed to end session",
      details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

export default router;