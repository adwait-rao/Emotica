import { createClient } from "redis";

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
  const message = JSON.stringify({
    role,
    content,
    timestamp: new Date().toISOString(),
  });
  await redisClient.rPush(key, message);
}

// Retrieve entire user chat from Redis
export async function getChatHistory(userId) {
  const key = getChatKey(userId);
  const messages = await redisClient.lRange(key, 0, -1);
  return messages.map(JSON.parse);
}

// Load all past Supabase messages into Redis
export async function preloadChatHistory(userId, allMessages) {
  const key = getChatKey(userId);
  if (allMessages.length) {
    const pipeline = redisClient.multi();
    allMessages.forEach((msg) => {
      pipeline.rPush(key, JSON.stringify(msg));
    });
    await pipeline.exec();
  }
}

// Optional: Clear user's Redis cache
export async function clearChat(userId) {
  await redisClient.del(getChatKey(userId));
}
