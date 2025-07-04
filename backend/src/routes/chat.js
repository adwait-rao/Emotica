import express from "express";
import {
  storeMessage,
  getChatHistory,
  preloadChatHistory,
  setSessionStatus,
  getSessionStatus,
  clearUserSession,
} from "../services/redis_utils.js";
import {
  upsertUserChat,
  upsertSingleMessage,
  loadAllUserMessages,
  getOrCreateSession,
} from "../services/supabase_utils.js";
import { createEventWithMessage } from "../services/events_utils.js";
import { getSimilarMessages, upsertIfNotSimilar } from "../services/pineconeService.js";
import { ChatOpenAI } from "@langchain/openai";
import { buildSystemPrompt, buildEventCategorizationPrompt } from "../services/prompt_utils.js";
import { z } from "zod";
import {
  StructuredOutputParser,
  OutputFixingParser,
} from "langchain/output_parsers";

const router = express.Router();

const openai = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-4o",
  temperature: 0.7,
});

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

router.post("/chat", async (req, res) => {
  const { message: currentMessage, userId } = req.body;
  if (!currentMessage || !userId)
    return res.status(400).send({ error: "Missing message or userId" });

  try {
    // 1. Get or create session
    const sessionId = await getOrCreateSession(userId);

    // 2. Store user message in Redis
    const userMessageData = await storeMessage(userId, "user", currentMessage);

    // 3. Immediately sync user message to Supabase
    await upsertSingleMessage(userId, sessionId, userMessageData);

    // 4. Get chat history and similar messages
    const chatHistory = await getChatHistory(userId);
    const similarMessages = await getSimilarMessages(currentMessage, 3, userId);

    // 5. Build system prompt and get AI response
    const systemPrompt = buildSystemPrompt({
      redisChatHistory: Array.isArray(chatHistory) ? chatHistory : [],
      similarMessages: Array.isArray(similarMessages) ? similarMessages : [],
      currentMessage,
    });

    const result = await openai.invoke([
      { role: "system", content: systemPrompt },
    ]);
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

    // 8. Handle important messages - store in vector database
    if (parsedResponse.is_important === "yes") {
      try {
        const { upserted, similarMessages: pineconeMatches } = await upsertIfNotSimilar(
          userId,
          currentMessage,
          0.8
        );
        if (!upserted && pineconeMatches.length > 0) {
          return res.json({
            ...parsedResponse,
            similarMessages: pineconeMatches.map((m) => ({
              text: m.metadata?.chunk_text,
              score: m.score,
            })),
            info: "Similar message found, not upserted.",
          });
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

    return res.json(parsedResponse);
  } catch (err) {
    console.error("Chat Error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

router.get("/chat/history", async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  try {
    let history = await getChatHistory(userId);

    if (!history || history.length === 0) {
      history = await loadAllUserMessages(userId);
      if (history.length > 0) {
        await preloadChatHistory(userId, history);
        await setSessionStatus(userId);
      }
    }

    return res.json({ userId, history });
  } catch (err) {
    console.error("History Fetch Error:", err.message);
    return res.status(500).json({ error: "Failed to fetch history" });
  }
});

router.post("/end-session", async (req, res) => {
  const { userId, sessionId } = req.body;
  if (!userId || !sessionId) {
    return res.status(400).json({ error: "Missing userId or sessionId" });
  }

  try {
    const finalHistory = await getChatHistory(userId);
    await upsertUserChat(userId, sessionId, finalHistory);
    await clearUserSession(userId);
    return res.json({ message: "Session ended and history saved." });
  } catch (err) {
    console.error("End Session Error:", err);
    return res.status(500).json({ error: "Failed to end session" });
  }
});

export default router;