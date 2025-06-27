import express from "express";
import { authenticate } from "../middleware/auth.js";

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
  loadAllUserMessages,
  createSession,
  endSession,
} from "../services/supabase_utils.js";


import { getSimilarMessages,upsertIfNotSimilar } from "../services/pineconeService.js";
import { ChatOpenAI } from "@langchain/openai";
import { v4 as uuidv4 } from "uuid";
import { format } from "date-fns";
import { buildSystemPrompt } from "../services/prompt_utils.js";

import { z } from "zod";

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

// function buildSystemPrompt(chatHistory, similarMessages, currentMessage) {
//   const formattedChat = chatHistory.map((m) => `• (${m.role}) ${m.content}`).join("\n");
//   const formattedSimilar = similarMessages.map((m) => `• ${m.content}`).join("\n");
//   const currentDate = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss");


//   return `
// You are a compassionate, emotionally aware mental health companion AI, Reply appropriately, based strictly on the current message,Chat History and similar Past messages.


// Chat History:
// ${formattedChat || "No chat history."}

// Similar Past Messages:
// ${formattedSimilar || "None found."}

// User just sent:
// "${currentMessage}"


// + Return only the raw JSON object with no markdown, no explanation, and no code block. Do NOT wrap the output in backticks.

// ${parser.getFormatInstructions()}

// Use ${currentDate} as the reference for resolving dates like "tomorrow".
// `.trim();
// }


// 🟢 CHAT ENTRY POINT (authenticated)
router.post("/chat", authenticate, async (req, res) => {
  const { message: currentMessage } = req.body;
  const userId = req.userId;

  if (!currentMessage)
    return res.status(400).send({ error: "Missing message" });

  try {
    const isSessionActive = await getSessionStatus(userId);

    let sessionId;
    if (!isSessionActive) {

      const pastMessages = await loadAllUserMessages(userId);
      console.log("🔍 Past messages from DB:", pastMessages); // DEBUG
      console.log("🔍 Past messages type:", typeof pastMessages); // DEBUG
      console.log("🔍 Past messages is array:", Array.isArray(pastMessages)); // DEBUG
      

      await preloadChatHistory(userId, pastMessages);
      await setSessionStatus(userId, sessionId);
    } else {
      sessionId = await getSessionStatus(userId);
    }

    const chatHistory = await getChatHistory(userId);

    console.log("🔍 Chat history from Redis:", chatHistory); // DEBUG
    console.log("🔍 Chat history type:", typeof chatHistory); // DEBUG
    console.log("🔍 Chat history is array:", Array.isArray(chatHistory)); // DEBUG
    // Only fetch similar messages for prompt, not for upsert logic
    const similarMessages = await getSimilarMessages(currentMessage, 3,userId);
    console.log("🔍 Similar messages:", similarMessages); // DEBUG

    const systemPrompt = buildSystemPrompt({
      redisChatHistory: Array.isArray(chatHistory) ? chatHistory : [],
      similarMessages: Array.isArray(similarMessages) ? similarMessages : [],
      currentMessage: currentMessage,
    });


    const result = await openai.invoke([
      { role: "system", content: systemPrompt },
    ]);
    const cleanOutput = result.content.replace(/```json|```/g, "").trim();
    const parsedResponse = JSON.parse(cleanOutput);

    await storeMessage(userId, "user", currentMessage);
    await storeMessage(userId, "assistant", parsedResponse.reply);

    // Pinecone upsert
    if (parsedResponse.is_important === "yes") {
      const { upserted, similarMessages: pineconeMatches } =
        await upsertIfNotSimilar(userId, currentMessage, 0.8);
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
console.log(userId)

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

// 🔴 End session: write to Supabase, clear Redis
router.post("/end-session", authenticate, async (req, res) => {
  const userId = req.userId;

  try {
    const sessionId = await getSessionStatus(userId);
    const finalHistory = await getChatHistory(userId);

    await endSession(userId, sessionId, finalHistory);
    await clearUserSession(userId);

    return res.json({ message: "Session ended and saved." });
  } catch (err) {
    console.error("End Session Error:", err);
    return res.status(500).json({ error: "Failed to end session" });
  }
});

export default router;
