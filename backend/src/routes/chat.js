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
      // start new session
      sessionId = await createSession(userId);
      const pastMessages = await loadAllUserMessages(userId, sessionId);
      await preloadChatHistory(userId, pastMessages);
      await setSessionStatus(userId, sessionId);
    } else {
      sessionId = await getSessionStatus(userId);
    }

    const chatHistory = await getChatHistory(userId);
    const similarMessages = await getSimilarMessages(currentMessage, 3, userId);

    const systemPrompt = buildSystemPrompt(
      chatHistory,
      similarMessages,
      currentMessage
    );
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
    return res
      .status(500)
      .json({ error: "Server error", details: err.message });
  }
});

// 🟡 Get Redis or fallback Supabase history
router.get("/chat/history", authenticate, async (req, res) => {
  const userId = req.userId;

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
