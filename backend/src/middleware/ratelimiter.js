import rateLimit from "express-rate-limit";

// 💡 1 request per 3 seconds per user (adjust as needed)
export const chatRateLimiter = rateLimit({
  windowMs: 8 * 1000,
  max: 1,
  keyGenerator: (req) => req.ip, // Rate limit by user ID if available
  message: {
    error: "You're sending messages too quickly. Please slow down.",
  },
});