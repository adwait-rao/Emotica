import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// UPSERT full chat history for a user
export async function upsertUserChat(userId, sessionId, messages) {
  if (!messages || messages.length === 0) {
    console.log('No messages to upsert');
    return;
  }

  // ✅ Prepare messages for Supabase with consistent schema
  const messagesToInsert = messages.map(msg => ({
    id: msg.id, // Use existing ID
    session_id: sessionId,
    user_id: userId,
    role: msg.role,
    content: msg.content,
    created_at: msg.created_at,
  }));

  const { data, error } = await supabase
    .from('mess')
    .upsert(messagesToInsert, {
      onConflict: 'id',
      ignoreDuplicates: false
    });

  if (error) {
    console.error('Error upserting messages:', error);
    throw error;
  }

  console.log(`✅ Upserted ${messagesToInsert.length} messages`);
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

// Load user's messages (if any)
export async function loadAllUserMessages(userId) {
  try {
    const { data, error } = await supabase
      .from('mess')
      .select('id, role, content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Error loading messages from Supabase:', error);
      return []; // ✅ Always return an array
    }

    if (!data || !Array.isArray(data)) {
      console.log('🔍 No data returned from Supabase or data is not an array');
      return []; // ✅ Always return an array
    }

    // ✅ Ensure consistent schema
    const normalizedMessages = data.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      created_at: msg.created_at,
    }));

    console.log(`🔍 Loaded ${normalizedMessages.length} messages from Supabase`);
    return normalizedMessages;

  } catch (error) {
    console.error('❌ Exception in loadAllUserMessages:', error);
    return []; // ✅ Always return an array
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