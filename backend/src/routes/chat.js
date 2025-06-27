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
  loadAllUserMessages,
} from "../services/supabase_utils.js";

import { getSimilarMessages,upsertIfNotSimilar } from "../services/pineconeService.js";
import { ChatOpenAI } from "@langchain/openai";
import { v4 as uuidv4 } from "uuid";
import { format } from "date-fns";
import { buildSystemPrompt } from "../services/prompt_utils.js";

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

//Define expected response structure
const baseParser = StructuredOutputParser.fromZodSchema(
  z.object({
    is_important: z.enum(["yes", "no"]),
    is_event: z.enum(["yes", "no"]),
    event_date: z.string().nullable(),
    event_summary: z.string().nullable(),
    reply: z.string(),
  })
);
const parser = StructuredOutputParser.fromNamesAndDescriptions({
  is_important: "yes | no",
  is_event: "yes | no",
  event_date: "ISO date string or null",
  event_summary: "Brief summary of the event or null",
  reply: "Supportive response to the user",
});

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


router.post("/chat", async (req, res) => {
  const { message: currentMessage, userId } = req.body;
  if (!currentMessage || !userId)
    return res.status(400).send({ error: "Missing message or userId" });

  try {
    const isSessionActive = await getSessionStatus(userId);

    if (!isSessionActive) {
      const pastMessages = await loadAllUserMessages(userId);
      console.log("🔍 Past messages from DB:", pastMessages); // DEBUG
      console.log("🔍 Past messages type:", typeof pastMessages); // DEBUG
      console.log("🔍 Past messages is array:", Array.isArray(pastMessages)); // DEBUG
      
      await preloadChatHistory(userId, pastMessages);
      await setSessionStatus(userId);
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
    const rawOutput = result.content;
    const cleanOutput = rawOutput.replace(/```json|```/g, "").trim();
    const parsedResponse = JSON.parse(cleanOutput);

    await storeMessage(userId, "user", currentMessage);
    await storeMessage(userId, "assistant", parsedResponse.reply);

    // Only upsert if important
    if (parsedResponse.is_important === "yes") {
      const { upserted, similarMessages: pineconeMatches } = await upsertIfNotSimilar(
        userId,
        currentMessage,
        0.8
      );
      if (!upserted && pineconeMatches.length > 0) {
        // Return similar messages if found
        return res.json({
          ...parsedResponse,
          similarMessages: pineconeMatches.map(m => ({
            text: m.metadata?.chunk_text,
            score: m.score,
          })),
          info: "Similar message found, not upserted.",
        });
      }
    }
console.log(similarMessages)
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
