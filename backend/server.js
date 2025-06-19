import express from "express";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { ChatOpenAI } from "@langchain/openai";
import { format } from "date-fns";

import {
  storeMessage,
  getChatHistory,
  preloadChatHistory,
  clearChat,
} from "./src/services/redis_utils.js";

import {
  upsertUserChat,
  loadAllUserMessages,
} from "./src/services/supabase_utils.js";

import {
  ensurePineconeIndexExists,
  getSimilarMessages,
} from "./src/services/pineconeService.js";

dotenv.config();

const app = express();
app.use(express.json());

const userId = "99538f1b-b47f-45e2-9dc3-f38d131580e5";

const openai = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-4o",
  temperature: 0.7,
});

function buildSystemPrompt(chatHistory, similarMessages, currentMessage) {
  const formattedChat = chatHistory
    .map((m) => `• (${m.role}) ${m.content}`)
    .join("\n");

  const formattedSimilar = similarMessages
    .map((m) => `• ${m.content}`)
    .join("\n");

  const currentDate = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss");

  return `
You are a compassionate and emotionally aware mental health companion AI Agent.

Context You Have
Current Chat History:
${formattedChat || "No chat history available."}

Similar Past Messages:
${formattedSimilar || "No similar messages found."}

Given the message:
"${currentMessage}"

Respond kindly, naturally and offer advice, like a mental health companion based on similar messages and Chat history (This is very important).

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

Use ${currentDate} as the reference for resolving dates like "tomorrow" or "next Monday."
`.trim();
}

app.post("/chat", async (req, res) => {
  const { message: currentMessage } = req.body;
  if (!currentMessage)
    return res.status(400).send({ error: "Missing message" });

  // Generate new session ID for each chat request
  const sessionId = uuidv4();

  try {
    console.log("💬 Starting chat session...\n");

    // Step 1: Preload previous messages into Redis
    const pastMessages = await loadAllUserMessages(userId);
    await preloadChatHistory(userId, pastMessages);
    console.log("✅ Loaded past messages into Redis");

    // Step 2: Retrieve current Redis chat history
    const chatHistory = await getChatHistory(userId);
    console.log("✅ Retrieved chat history from Redis", chatHistory);
    // Step 3: Retrieve similar messages from Pinecone
    const similarMessages = await getSimilarMessages(currentMessage, 3);
    console.log("✅ Retrieved similar messages from Pinecone", similarMessages);

    // Step 4: Create system prompt
    const systemPrompt = buildSystemPrompt(
      chatHistory,
      similarMessages,
      currentMessage
    );

    // Step 5: Send to OpenAI
    const result = await openai.invoke(
      [
        {
          role: "system",
          content: systemPrompt,
        },
      ],
      {
        response_format: { type: "json_object" },
      }
    );

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(result.content);
    } catch (parseError) {
      console.error("❌ Failed to parse OpenAI response:", result.content);
      throw new Error("Invalid JSON response from OpenAI");
    }

    console.log("🤖 Response from OpenAI:", parsedResponse);

    // Step 6: Store both messages into Redis
    await storeMessage(userId, "user", currentMessage);
    await storeMessage(userId, "assistant", parsedResponse.reply);

    // Step 7: Get updated history and upsert to Supabase
    const updatedHistory = await getChatHistory(userId);
    await upsertUserChat(userId, sessionId, updatedHistory);
    console.log("✅ Chat history saved to Supabase");

    // Step 8: Clear Redis to keep it clean for next session
    await clearChat(userId);
    console.log("🧹 Redis cleaned up");

    return res.json(parsedResponse);
  } catch (err) {
    console.error("❌ Error:", err);
    return res.status(500).json({
      error: "Server error",
      details: err.message,
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await ensurePineconeIndexExists();
    console.log("✅ Pinecone index ensured");

    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/health`);
      console.log(`💬 Chat endpoint: POST http://localhost:${PORT}/chat`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
