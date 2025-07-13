import express from "express";
import { chatRateLimiter } from "../middleware/ratelimiter.js";
import { authenticate } from "../middleware/authentication.js";
import {
  storeMessage,
  getChatHistory,
  preloadChatHistory,
  setSessionStatus,
  getSessionStatus,
  getSessionKey,
  getSessionId,
  clearUserSession,
  cacheSessionIdInRedis,
  redisClient,
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
import {
  getSimilarMessages,
  upsertIfNotSimilar,
} from "../services/pineconeService.js";
import { ChatOpenAI } from "@langchain/openai";
import {
  buildSystemPrompt,
  buildEventCategorizationPrompt,
} from "../services/prompt_utils.js";
import { z } from "zod";
import { format } from "date-fns";
import { StructuredOutputParser } from "langchain/output_parsers";
const SESSION_TTL_SECONDS = 3600;
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
    const prompt = buildEventCategorizationPrompt(
      eventSummary,
      eventDate,
      userMessage
    );

    const result = await openai.invoke([{ role: "system", content: prompt }]);

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
        description: eventSummary || "Event reminder",
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
      description: eventSummary || "Event reminder",
    };
  }
}

// Helper function to validate UUID format
function isValidUUID(uuid) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return (
    uuid && typeof uuid === "string" && uuid !== "null" && uuidRegex.test(uuid)
  );
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

      // ✅ ALWAYS load ENTIRE chat history (all sessions) at session start
      console.log("📥 Loading ENTIRE chat history from Supabase...");
      const allMessages = await loadAllUserMessages(userId); // No sessionId filter

      if (allMessages.length > 0) {
        console.log(
          `📚 Preloading ${allMessages.length} messages from ALL sessions`
        );
        await preloadChatHistory(userId, allMessages, sessionId);
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

// ENHANCED: processMessage - Continue using Redis for active sessions
async function processMessage(userId, sessionId, currentMessage) {
  try {
    // 1. Store user message in Redis first
    const userMessageData = await storeMessage(userId, "user", currentMessage);
    console.log(userMessageData, "ugadibooo");
    // 2. Immediately sync user message to Supabase for real-time updates
    await upsertSingleMessage(userId, sessionId, userMessageData);

    // 3. Get chat history from Redis (should contain entire history)
    const fullChatHistory = await getChatHistory(userId);

    // 📌 FILTER: Only take the latest 6 messages for AI context
    const recentChatHistory = fullChatHistory.slice(-6);
    console.log(
      `🔍 Using latest 6 messages from ${fullChatHistory.length} total messages`
    );

    const similarMessages = await getSimilarMessages(currentMessage, 3, userId);

    // 4. Build system prompt and get AI response
    let systemPrompt;
    try {
      systemPrompt = buildSystemPrompt({
        redisChatHistory: recentChatHistory,
        similarMessages,
        currentMessage,
      });
    } catch (error) {
      console.log("❌ buildSystemPrompt failed, using fallback");
      throw error;
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
    const assistantMessageData = await storeMessage(
      userId,
      "assistant",
      parsedResponse.reply
    );

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
      }
    }

    // 9. Create event if needed
    if (parsedResponse.is_event === "yes" && parsedResponse.event_date) {
      try {
        const eventCategory = await categorizeEventWithOpenAI(
          parsedResponse.event_summary,
          parsedResponse.event_date,
          currentMessage
        );

        const eventResult = await createEventWithMessage(
          userId,
          sessionId,
          userMessageData,
          {
            event_date: parsedResponse.event_date,
            event_summary: parsedResponse.event_summary,
            event_type: eventCategory.category,
            priority: eventCategory.priority,
            notification_schedule: eventCategory.notification_schedule,
            description: eventCategory.description,
          }
        );

        console.log(
          "✅ Event created successfully:",
          eventResult?.event?.[0]?.id
        );

        parsedResponse.event_created = {
          id: eventResult?.event?.[0]?.id,
          category: eventCategory.category,
          priority: eventCategory.priority,
          notification_schedule: eventCategory.notification_schedule,
        };
      } catch (eventError) {
        console.error("❌ Failed to create event:", eventError);
      }
    }

    return parsedResponse;
  } catch (error) {
    console.error("❌ Error in processMessage:", error);
    throw error;
  }
}

// 🟢 CHAT ENTRY POINT
router.post("/chat", authenticate, chatRateLimiter, async (req, res) => {
  const { message: currentMessage } = req.body;
  const userId = req.user.id;

  // Validate input
  if (!currentMessage || !currentMessage.trim()) {
    return res
      .status(400)
      .json({ error: "Message is required and cannot be empty" });
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
      details:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Internal server error",
    });
  }
});

// FIXED: Chat history endpoint - Always get from Redis during active session
router.get("/chat/history", authenticate, async (req, res) => {
  const userId = req.user.id;

  try {
    console.log("📚 Fetching chat history for user:", userId);

    // Check if we have an active session
    const sessionId = await getSessionId(userId);
    const isSessionActive = await getSessionStatus(userId);

    console.log("📊 Session status:", { sessionId, isSessionActive });

    if (isSessionActive && sessionId) {
      // ✅ ACTIVE SESSION: Get from Redis (should contain entire history)
      console.log("🔥 Active session detected - retrieving from Redis");

      const history = await getChatHistory(userId);

      if (history && history.length > 0) {
        // Group messages by session for better organization
        // const sessionGroups = {};
        // history.forEach((msg) => {
        //   const msgSessionId = msg.session_id || "unknown";
        //   if (!sessionGroups[msgSessionId]) {
        //     sessionGroups[msgSessionId] = [];
        //   }
        //   sessionGroups[msgSessionId].push(msg);
        // });

        console.log(`✅ Returning ${history.length} messages from Redis`);
        console.log(`📍 Current session: ${sessionId}`);

        return res.json({
          userId,
          currentSessionId: sessionId,
          history, // All messages in chronological order
          totalMessages: history.length,
          // sessionCount: Object.keys(sessionGroups).length,
          // sessionGroups,
          source: "redis", // Debug info
        });
      } else {
        console.log(
          "⚠️ Redis empty despite active session, falling back to Supabase"
        );
      }
    }

    // ✅ NO ACTIVE SESSION or Redis empty: Load from Supabase and create session
    console.log("💾 No active session or Redis empty - loading from Supabase");

    // Get or create session
    let currentSessionId = await getLatestOpenSession(userId);
    if (!currentSessionId) {
      currentSessionId = await createSession(userId);
      console.log("🆕 Created new session:", currentSessionId);
    }

    // Load ENTIRE history from Supabase
    console.log("📥 Loading ALL messages from Supabase...");
    const allMessages = await loadAllUserMessages(userId);

    // Preload Redis with complete history
    await preloadChatHistory(userId, allMessages, currentSessionId);

    // Set session as active
    await setSessionStatus(userId);

    // Group messages by session
    // const sessionGroups = {};
    // allMessages.forEach((msg) => {
    //   const msgSessionId = msg.session_id || "unknown";
    //   if (!sessionGroups[msgSessionId]) {
    //     sessionGroups[msgSessionId] = [];
    //   }
    //   sessionGroups[msgSessionId].push(msg);
    // });

    console.log(`✅ Returning ${allMessages.length} messages from Supabase`);
    console.log(`📍 Current session: ${currentSessionId}`);

    return res.json({
      userId,
      currentSessionId,
      history: allMessages,
      totalMessages: allMessages.length,
      // sessionCount: Object.keys(sessionGroups).length,
      // sessionGroups,
      source: "supabase", // Debug info
    });
  } catch (err) {
    console.error("❌ History Fetch Error:", err);
    return res.status(500).json({
      error: "Failed to fetch history",
      details:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Internal server error",
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
      details:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Internal server error",
    });
  }
});

export default router;
