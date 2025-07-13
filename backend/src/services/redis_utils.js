import { createClient } from "redis";
import { v4 as uuidv4 } from "uuid";
import { encrypt, decrypt } from "./encryption.js";

export const redisClient = createClient({
  username: "default",
  password: "h2v6MBylku0nBsGIo6lK6dUvgCqzRSE4",
  socket: {
    host: "redis-16653.c301.ap-south-1-1.ec2.redns.redis-cloud.com",
    port: 16653,
  },
});

redisClient.on("error", (err) => console.error("❌ Redis Client Error:", err));
await redisClient.connect();

// Keys
export const getChatKey = (userId) => `chat:${userId}`;
export const getSessionKey = (userId) => `session_id:${userId}`;
export const getSessionActiveKey = (userId) => `session_active:${userId}`;

// ⏱️ TTL for Redis session (in seconds)
const SESSION_TTL_SECONDS = 3600; // 1 hour

// ✅ Get sessionId
export async function getSessionIdOrFail(userId) {
  const sessionId = await redisClient.get(getSessionKey(userId));
  if (!sessionId) {
    throw new Error(`❌ No active Redis session ID found for user ${userId}`);
  }
  return sessionId;
}
// ✅ Cache sessionId in Redis
export async function cacheSessionIdInRedis(userId, sessionId) {
  await redisClient.set(getSessionKey(userId), sessionId, {
    EX: SESSION_TTL_SECONDS,
  });
  await redisClient.set(getSessionActiveKey(userId), "true", {
    EX: SESSION_TTL_SECONDS,
  });
}

// 🧠 Store a single message
export async function storeMessage(userId, role, content) {
  // Convert content to string if it's not already
  const contentString =
    typeof content === "string" ? content : JSON.stringify(content);

  if (!contentString || contentString.trim() === "") {
    console.error(`❌ Cannot store message — content is empty`);
    throw new Error("Message content cannot be empty");
  }

  const key = getChatKey(userId);
  let sessionId = await getSessionId(userId);

  if (!sessionId) {
    console.warn(`⚠️ Session ID missing in Redis for ${userId}`);
    throw new Error(
      `❌ Cannot store message — no active sessionId for user ${userId}`
    );
  }

  console.log("📝 Content before encryption:", contentString);

  const encryptedContent = encrypt(contentString);

  const message = {
    id: uuidv4(),
    session_id: sessionId,
    role,
    encryptedContent,
    content: contentString, // Keep both for compatibility
    created_at: new Date().toISOString(),
  };

  await redisClient.rPush(key, JSON.stringify(message));
  console.log("✅ Message stored in Redis:", {
    id: message.id,
    role: message.role,
  });
  return message;
}

export async function clearUserSession(userId) {
  await redisClient.del(getChatKey(userId)); // chat
  await redisClient.del(getSessionKey(userId)); // session ID
  await redisClient.del(getSessionActiveKey(userId)); // session status
}

// 📦 Get full chat history from Redis
// Fixed getChatHistory function to properly handle encrypted content
export async function getChatHistory(userId) {
  try {
    const key = getChatKey(userId);
    const messages = await redisClient.lRange(key, 0, -1);

    if (!messages || messages.length === 0) {
      return [];
    }

    return messages
      .map((msg) => {
        try {
          const parsed = JSON.parse(msg);

          // Handle both encrypted and plain content
          if (parsed.encryptedContent && !parsed.content) {
            // If we have encrypted content but no plain content, decrypt it
            parsed.content = decrypt(parsed.encryptedContent);
          } else if (!parsed.content && !parsed.encryptedContent) {
            // If we have neither, this is a malformed message
            console.error(
              "❌ Message missing both content and encryptedContent:",
              parsed.id
            );
            return null;
          }
          // If we already have decrypted content, use it as-is

          return parsed;
        } catch (err) {
          console.error("❌ Failed to parse Redis message:", err);
          return null;
        }
      })
      .filter((msg) => msg !== null)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  } catch (error) {
    console.error("Error in getChatHistory:", error);
    return [];
  }
}

// 🔄 Preload Supabase chat messages into Redis
export async function preloadChatHistory(
  userId,
  allMessages,
  currentSessionId = null
) {
  try {
    const key = getChatKey(userId);
    if (!Array.isArray(allMessages) || allMessages.length === 0) {
      // If no messages, we still need to cache the current session ID
      if (currentSessionId) {
        await redisClient.set(getSessionKey(userId), currentSessionId, {
          EX: SESSION_TTL_SECONDS,
        });
      }
      return;
    }

    // Clear existing history first to avoid duplicates
    await redisClient.del(key);

    const pipeline = redisClient.multi();

    // Use the provided currentSessionId, don't derive from messages
    if (currentSessionId) {
      await redisClient.set(getSessionKey(userId), currentSessionId, {
        EX: SESSION_TTL_SECONDS,
      });
    }

    // Store ALL messages in chronological order
    allMessages.forEach((msg) => {
      const normalized = {
        id: msg.id || uuidv4(),
        session_id: msg.session_id, // Keep original session_id from database
        role: msg.role,
        content: msg.content, // Already decrypted from loadAllUserMessages
        created_at: msg.created_at || new Date().toISOString(),
      };
      pipeline.rPush(key, JSON.stringify(normalized));
    });

    await pipeline.exec();
    console.log(
      `✅ Preloaded ${allMessages.length} messages (entire history) to Redis`
    );
  } catch (error) {
    console.error("❌ Error in preloadChatHistory:", error);
  }
}

// ✅ Session Status Helpers
export async function getSessionStatus(userId) {
  return await redisClient.get(getSessionActiveKey(userId));
}

export async function getSessionId(userId) {
  const sessionId = await redisClient.get(getSessionKey(userId));
  if (!sessionId) {
    console.warn(`⚠️ No session ID found in Redis for user ${userId}`);
  }
  return sessionId;
}

export async function setSessionStatus(userId) {
  return await redisClient.set(getSessionActiveKey(userId), "true", {
    EX: SESSION_TTL_SECONDS,
  });
}
