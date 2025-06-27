import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

//UPSERT full chat history for a user

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

export async function createSession(userId) {
  const sessionId = uuidv4();
  await supabase.from("sessions").insert({
    id: sessionId,
    user_id: userId,
  });
  return sessionId;
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
