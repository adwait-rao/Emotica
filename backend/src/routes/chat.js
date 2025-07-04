import express from "express";
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
  loadAllUserMessages,
  createSession,
  endSession,
  ensureSessionExists,
  getLatestOpenSession,
} from "../services/supabase_utils.js";

import {
  getSimilarMessages,
  upsertIfNotSimilar,
} from "../services/pineconeService.js";

import { ChatOpenAI } from "@langchain/openai";
import { format } from "date-fns";
import { z } from "zod";
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

function buildSystemPrompt(chatHistory, similarMessages, currentMessage) {
  const formattedChat = chatHistory
    .map((m) => `• (${m.role}) ${m.content}`)
    .join("\n");
  const formattedSimilar = similarMessages
    .map((m) => `• ${m.content}`)
    .join("\n");
  const currentDate = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss");

  return `
You are a compassionate, emotionally aware mental health companion AI.

Chat History:
${formattedChat || "No chat history."}

Similar Past Messages:
${formattedSimilar || "None found."}

User just sent:
"${currentMessage}"

Only return a JSON object:
${baseParser.getFormatInstructions()}

Use ${currentDate} as reference for relative dates like "tomorrow".
`.trim();
}

// Helper function to validate UUID format
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuid && typeof uuid === 'string' && uuid !== 'null' && uuidRegex.test(uuid);
}

// Consolidated session management function
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

// Process message function
async function processMessage(userId, sessionId, currentMessage) {
  try {
    // Get chat history and similar messages
    const chatHistory = await getChatHistory(userId);
    const similarMessages = await getSimilarMessages(currentMessage, 3, userId);
    
    // Build system prompt and get AI response
    const systemPrompt = buildSystemPrompt(chatHistory, similarMessages, currentMessage);
    const result = await openai.invoke([
      { role: "system", content: systemPrompt },
    ]);
    
    // Parse AI response
    const cleanOutput = result.content.replace(/```json|```/g, "").trim();
    const parsedResponse = JSON.parse(cleanOutput);
    
    // Store messages in Redis
    const userMsg = await storeMessage(userId, "user", currentMessage);
    const aiMsg = await storeMessage(userId, "assistant", parsedResponse.reply);
    
    console.log("💾 Storing messages in database for session:", sessionId);
    
    // Store in database with proper sessionId
    await upsertUserChat(userId, sessionId, [userMsg, aiMsg]);
    
    // Handle important messages
    if (parsedResponse.is_important === "yes") {
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
    }
    
    return parsedResponse;
  } catch (error) {
    console.error("❌ Error in processMessage:", error);
    throw error;
  }
}

// 🟢 CHAT ENTRY POINT
router.post("/chat", authenticate, async (req, res) => {
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
    
    if (!sessionId) {
      return res.json({ userId, history: [] });
    }
    
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