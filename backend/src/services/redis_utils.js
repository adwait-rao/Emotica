import { createClient } from "redis";
import { v4 as uuidv4 } from "uuid";

const redisClient = createClient({
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
const getChatKey = (userId) => `chat:${userId}`;
const getSessionKey = (userId) => `session_id:${userId}`;
const getSessionActiveKey = (userId) => `session_active:${userId}`;

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
  const key = getChatKey(userId);
  let sessionId = await getSessionId(userId);

  if (!sessionId) {
    console.warn(
      `⚠️ Session ID missing in Redis for ${userId}, trying to recover...`
    );
    // Optionally: load from Supabase or fail more gracefully
    throw new Error(
      `❌ Cannot store message — no active sessionId for user ${userId}`
    );
  }

  const message = {
    id: uuidv4(),
    session_id: sessionId,
    role,
    content,
    created_at: new Date().toISOString(),
  };

  await redisClient.rPush(key, JSON.stringify(message));
  console.log("✅ Message stored in Redis:", message);
  return message;
}

// 📦 Get full chat history from Redis
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
          return JSON.parse(msg);
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
export async function preloadChatHistory(userId, allMessages) {
  try {
    const key = getChatKey(userId);
    if (!Array.isArray(allMessages) || allMessages.length === 0) return;

    const pipeline = redisClient.multi();
    const lastSessionId =
      allMessages[allMessages.length - 1]?.session_id || uuidv4();

    // Save session ID into Redis as the active session
    await redisClient.set(getSessionKey(userId), lastSessionId, {
      EX: SESSION_TTL_SECONDS,
    });

    allMessages.forEach((msg) => {
      const normalized = {
        id: msg.id || uuidv4(),
        session_id: msg.session_id || lastSessionId,
        role: msg.role,
        content: msg.content,
        created_at: msg.created_at || new Date().toISOString(),
      };
      pipeline.rPush(key, JSON.stringify(normalized));
    });

    await pipeline.exec();
    console.log(`✅ Preloaded ${allMessages.length} messages to Redis`);
  } catch (error) {
    console.error("❌ Error in preloadChatHistory:", error);
  }
}

// ❌ Clear user Redis data (chat + session state)
export async function clearUserSession(userId) {
  await redisClient.del(getChatKey(userId)); // chat
  await redisClient.del(getSessionKey(userId)); // session ID
  await redisClient.del(getSessionActiveKey(userId)); // session status
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
