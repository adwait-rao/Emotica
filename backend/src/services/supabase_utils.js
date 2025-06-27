import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

//UPSERT full chat history for a user
export async function insertMessagesToSupabase(sessionId, messages) {
  if (!messages?.length) return;

  const formatted = messages.map((msg) => ({
    id: uuidv4(),
    session_id: sessionId,
    sender: msg.role,
    content: msg.content,
    created_at: msg.timestamp || new Date().toISOString(),
  }));

  const { error } = await supabase.from("messages").insert(formatted);

  if (error) {
    console.error("❌ Supabase message insert failed:", error);
  } else {
    console.log("✅ Messages inserted to Supabase");
  }
}

export async function createSession(userId) {
  const sessionId = uuidv4();
  await supabase.from("sessions").insert({
    id: sessionId,
    user_id: userId,
  });
  return sessionId;
}

// Load user's messages (if any)
export async function loadAllUserMessages(userId, sessionId = null) {
  const query = supabase.from("messages").select("*").eq("user_id", userId);

  if (sessionId) query.eq("session_id", sessionId);

  const { data, error } = await query.order("created_at", { ascending: true });
  if (error) {
    console.error("Load error:", error);
    return [];
  }

  return data.map(({ sender, content }) => ({
    role: sender,
    content,
  }));
}
