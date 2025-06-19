import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// 🆕 UPSERT full chat history for a user
export async function upsertUserChat(userId, sessionId, chatHistory) {
  const { error } = await supabase.from("chat_sessions").upsert(
    [
      {
        user_id: userId,
        session_id: sessionId,
        messages: chatHistory,
      },
    ],
    { onConflict: "user_id" } // ensure only one row per user
  );

  if (error) {
    console.error("❌ Error upserting to Supabase:", error);
  } else {
    console.log("✅ Chat history upserted to Supabase");
  }
}

// Load user's messages (if any)
export async function loadAllUserMessages(userId) {
  const { data, error } = await supabase
    .from("chat_sessions")
    .select("messages")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("❌ Error loading user chat:", error);
    return [];
  }

  return data?.messages || [];
}
