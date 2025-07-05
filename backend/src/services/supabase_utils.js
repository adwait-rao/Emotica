import dotenv from "dotenv";
import { supabase } from "../config/supabaseClient.js";
dotenv.config();

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

// Consolidated session management function

// NEW: Get or create session
export async function getOrCreateSession(userId) {
  try {
    // First, try to get the most recent active session
    const { data: existingSession, error: sessionError } = await supabase
      .from('sessions')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existingSession && !sessionError) {
      console.log('✅ Using existing session:', existingSession.id);
      return existingSession.id;
    }

    // Create new session if none exists
    const { data: newSession, error: createError } = await supabase
      .from('sessions')
      .insert([{ user_id: userId }])
      .select('id')
      .single();

    if (createError) {
      console.error('❌ Error creating session:', createError);
      throw createError;
    }

    console.log('✅ Created new session:', newSession.id);
    return newSession.id;

  } catch (error) {
    console.error('❌ Exception in getOrCreateSession:', error);
    throw error;
  }
}


//UPSERT full chat history for a user

export async function upsertUserChat(userId, sessionId, messages) {
  if (!messages || messages.length === 0) {
    console.log('No messages to upsert');
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

// NEW: Upsert single message to Supabase
export async function upsertSingleMessage(userId, sessionId, message) {
  if (!message) {
    console.log('No message to upsert');
    return;
  }

  const messageToInsert = {
    id: message.id,
    session_id: sessionId,
    user_id: userId,
    role: message.role,
    content: message.content,
    created_at: message.created_at,
  };

  const { data, error } = await supabase
    .from('mess')
    .upsert([messageToInsert], {
      onConflict: 'id',
      ignoreDuplicates: false
    })
    .select();

  if (error) {
    console.error('Error upserting single message:', error);
    throw error;
  }

  console.log(`✅ Upserted single message: ${message.id}`);
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
  console.log(data);
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

// NEW: Check if message exists in Supabase
export async function messageExists(messageId) {
  try {
    const { data, error } = await supabase
      .from('mess')
      .select('id')
      .eq('id', messageId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('❌ Error checking message existence:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('❌ Exception in messageExists:', error);
    return false;
  }
}

