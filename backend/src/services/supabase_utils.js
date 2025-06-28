import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);
export async function ensureSessionExists(userId, sessionId) {
  const { data, error } = await supabase
    .from("sessions")
    .select("id")
    .eq("id", sessionId)
    .single();

  if (error && error.code === "PGRST116") {
    // Session does not exist — create it
    const { error: insertErr } = await supabase.from("sessions").insert({
      id: sessionId,
      user_id: userId,
      created_at: new Date().toISOString(),
    });

    if (insertErr) {
      console.error("❌ Failed to ensure session exists:", insertErr);
      throw new Error("Failed to create missing session");
    }
  }
}
//UPSERT full chat history for a user

export async function upsertUserChat(userId, sessionId, messages) {
  if (!messages || messages.length === 0) {
    console.log("⚠️ No messages to upsert");
    return;
  }

  const messagesToInsert = messages.map((msg) => ({
    id: msg.id,
    session_id: sessionId,
    user_id: userId,
    role: msg.role,
    content: msg.content,
    created_at: msg.created_at,
  }));

  const { data, error } = await supabase.from("mess").upsert(messagesToInsert, {
    onConflict: "id",
    ignoreDuplicates: false,
  });

  if (error) {
    console.error("❌ Error upserting messages into 'mess':", error);
    throw error;
  }

  console.log(`✅ Upserted ${messagesToInsert.length} messages to 'mess'`);
  return data;
}

// End session
// ✅ Mark session as ended (no archiving)
export async function endSession(sessionId) {
  if (!sessionId) return;

  const { error } = await supabase
    .from("sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (error) {
    console.error("❌ Error updating session end time:", error);
    throw error;
  }

  console.log(`✅ Session ${sessionId} marked as ended`);
}
//To create a new session for user
export async function createSession(userId) {
  const { data, error } = await supabase
    .from("sessions")
    .insert([{ user_id: userId }])
    .select("id")
    .single(); // Get the inserted session's ID

  if (error) {
    console.error("❌ Supabase session creation failed:", error);
    throw new Error("Failed to create session");
  }

  return data.id; // Auto-generated session ID
}
//gets latest session
export async function getLatestOpenSession(userId) {
  const { data, error } = await supabase
    .from("sessions")
    .select("id, ended_at")
    .eq("user_id", userId)
    .is("ended_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data.id;
}

// Load user's messages (if any)

export async function loadAllUserMessages(userId, sessionId = null) {
  try {
    let query = supabase
      .from("mess")
      .select("id, role, content, created_at, session_id")
      .eq("user_id", userId);

    if (sessionId) {
      query = query.eq("session_id", sessionId);
    }

    const { data, error } = await query.order("created_at", {
      ascending: true,
    });

    if (error) {
      console.error("❌ Error loading messages from 'mess':", error);
      return [];
    }

    if (!Array.isArray(data)) {
      console.log("⚠️ No valid messages returned from Supabase");
      return [];
    }

    const normalizedMessages = data.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      created_at: msg.created_at,
      session_id: msg.session_id,
    }));

    console.log(`📥 Loaded ${normalizedMessages.length} messages from 'mess'`);
    return normalizedMessages;
  } catch (error) {
    console.error("❌ Exception in loadAllUserMessages:", error);
    return [];
  }
}
