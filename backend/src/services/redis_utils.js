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

// Single Redis key per user for all messages
const getChatKey = (userId) => `chat:${userId}`;

// Store new message into Redis
export async function storeMessage(userId, role, content) {
  const key = getChatKey(userId);
  const message = {
    id: uuidv4(),
    role,
    content,
    created_at: new Date().toISOString(), // ✅ Use created_at consistently
  };
  
  await redisClient.rPush(key, JSON.stringify(message));
  return message; 
}

// Retrieve entire user chat from Redis
export async function getChatHistory(userId) {
   try {
    const key = getChatKey(userId);
    const messages = await redisClient.lRange(key, 0, -1);
    console.log("🔍 Raw messages from Redis:", messages); // DEBUG

    if (!messages || messages.length === 0) {
      console.log("🔍 No messages in Redis for user:", userId);
      return []; // ✅ Always return empty array, not null
    }
    
    const parsedMessages = messages
      .map(msg => {
        try {
          return JSON.parse(msg);
        } catch (parseError) {
          console.error("❌ Failed to parse message:", msg, parseError);
          return null;
        }
      })
      .filter(msg => msg !== null) // Remove failed parses
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    console.log("🔍 Parsed and sorted messages:", parsedMessages);
    return parsedMessages;
      
  } catch (error) {
    console.error("Error in getChatHistory:", error);
    return []; // ✅ Always return array on error
  }
}

// Load all past Supabase messages into Redis
export async function preloadChatHistory(userId, allMessages) {
 try {
    const key = getChatKey(userId);
    
    // ✅ Ensure allMessages is an array
    if (!Array.isArray(allMessages)) {
      console.log("⚠️ allMessages is not an array:", typeof allMessages);
      return;
    }
    
    if (allMessages.length === 0) {
      console.log("🔍 No messages to preload for user:", userId);
      return;
    }
    
    console.log(`🔍 Preloading ${allMessages.length} messages to Redis`);
    
    const pipeline = redisClient.multi();
    
    allMessages.forEach((msg, index) => {
      try {
        // ✅ Ensure every message has the complete schema
        const normalizedMessage = {
          id: msg.id || uuidv4(),
          role: msg.role,
          content: msg.content,
          created_at: msg.created_at || new Date().toISOString(),
        };
        
        pipeline.rPush(key, JSON.stringify(normalizedMessage));
      } catch (msgError) {
        console.error(`❌ Error processing message ${index}:`, msgError);
      }
    });
    
    await pipeline.exec();
    console.log(`✅ Successfully preloaded ${allMessages.length} messages`);
    
  } catch (error) {
    console.error("❌ Error in preloadChatHistory:", error);
  }
}

// Optional: Clear user's Redis cache
export async function clearChat(userId) {
  await redisClient.del(getChatKey(userId));
}

export async function getSessionStatus(userId) {
  return await redisClient.get(`session_active:${userId}`);
}

export async function setSessionStatus(userId) {
  // Optional: Set expiry to auto-clear stale sessions
  return await redisClient.set(`session_active:${userId}`, "true", {
    EX: 3600, // 1 hour
  });
}

export async function clearUserSession(userId) {
  await clearChat(userId); // clears Redis chat messages
  await redisClient.del(`session_active:${userId}`); // clears session flag
}
