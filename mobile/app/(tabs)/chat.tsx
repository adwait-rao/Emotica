import ChatBubble, { Message } from "@/components/common/ChatBubble";
import ScreenContainer from "@/components/common/ScreenContainer";
import { useAuth } from "@/context/AuthContext";
import { chatService } from "@/services/chatService";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { nanoid } from "nanoid/non-secure";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// Helper to map API history to the local Message type
const mapApiHistoryToMessages = (history: any[]): Message[] => {
  return history
    .map((item) => ({
      id: item.id,
      text: item.content,
      isUser: item.role === "user",
      timestamp: item.created_at,
    }))
    .reverse(); // API returns oldest first. Inverted FlatList needs newest first, so we reverse.
};

export default function Chat() {
  const { user, token } = useAuth();
  const [messageInputText, setMessageInputText] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const userAvatar = user
    ? `https://i.pravatar.cc/150?u=${user.email}`
    : undefined;
  const chatsFlatList = useRef<FlatList>(null);

  // Fetch chat history once when the component mounts with a valid user and token.
  useEffect(() => {
    if (!user || !token) {
      return;
    }

    console.log("Chat session started. Loading history...");
    setLoadingHistory(true);
    chatService
      .getChatHistory(user.id, token)
      .then((history) => {
        console.log("Chat history response:", JSON.stringify(history, null, 2));
        if (history && Array.isArray(history.history)) {
          setMessages(mapApiHistoryToMessages(history.history));
        }
      })
      .catch((error) => {
        console.error("Failed to load chat history:", error);
      })
      .finally(() => {
        setLoadingHistory(false);
      });
  }, [user, token]);

  // End session on component unmount or app state change
  useEffect(() => {
    const endChatSession = () => {
      if (token) {
        chatService.endSession(token);
      }
    };

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState.match(/inactive|background/)) {
        endChatSession();
      }
    });

    // Cleanup on unmount
    return () => {
      endChatSession();
      subscription.remove();
    };
  }, [token]);

  const handleSendMessage = useCallback(
    async (text: string, retryMessageId?: string) => {
      if (isSending || !text.trim() || !token) return;

      const textToSend = text.trim();
      // Use the provided ID for retries, or generate a new one for new messages.
      const optimisticMessage: Message = {
        id: retryMessageId || nanoid(),
        text: textToSend,
        isUser: true,
        timestamp: new Date().toISOString(),
        error: false,
      };

      if (!retryMessageId) {
        setMessageInputText("");
        setMessages((prev) => [optimisticMessage, ...prev]);
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticMessage.id ? optimisticMessage : m
          )
        );
      }

      setIsSending(true);
      Keyboard.dismiss();

      try {
        const response = await chatService.sendMessage(textToSend, token);

        // This is the bot's reply.
        const botMessage: Message = {
          id: response.id || nanoid(),
          text: response.reply,
          isUser: false,
          timestamp: response.created_at || new Date().toISOString(),
        };

        // The backend might send back the confirmed user message.
        // We create a confirmed message from the optimistic one, but use the
        // ID from the backend if it's provided. This prevents crashes.
        const confirmedUserMessage: Message = {
          ...optimisticMessage,
          id: response.userMessage?.id || optimisticMessage.id,
          timestamp:
            response.userMessage?.created_at || optimisticMessage.timestamp,
        };

        setMessages((prev) => {
          // First, replace the optimistic message with the confirmed one.
          const newMessages = prev.map((m) =>
            m.id === optimisticMessage.id ? confirmedUserMessage : m
          );
          // Then, add the bot's reply at the beginning.
          return [botMessage, ...newMessages];
        });
      } catch (error) {
        console.error("Failed to send message:", error);
        // Mark the message with an error flag so the UI can show it.
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticMessage.id ? { ...m, error: true } : m
          )
        );
      } finally {
        setIsSending(false);
      }
    },
    [isSending, token]
  );

  const onSendMessagePress = () => {
    handleSendMessage(messageInputText);
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS == "ios" ? "padding" : "height"}
        keyboardVerticalOffset={35}
        style={{ flex: 1 }}
      >
        <View className="flex-1">
          {/* Header */}
          <View className="flex items-center py-5">
            <Text className="text-xl font-semibold">Emotica</Text>
          </View>

          {/* Chat messages */}
          {loadingHistory ? (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator size="large" color="#5217E5" />
            </View>
          ) : (
            <FlatList
              ref={chatsFlatList}
              data={messages}
              renderItem={({ item }) => (
                <ChatBubble
                  message={item}
                  onRetry={() => handleSendMessage(item.text, item.id)}
                  userAvatar={userAvatar}
                />
              )}
              keyExtractor={(message) => message.id}
              showsVerticalScrollIndicator={false}
              inverted={true}
              contentContainerStyle={{ paddingHorizontal: 16 }}
            />
          )}
          <View className="bg-white py-3 flex-row gap-4 items-center w-full">
            <View className="flex-1">
              <TextInput
                value={messageInputText}
                onChangeText={setMessageInputText}
                className="flex-grow bg-purple-50 rounded-xl p-5 text-lg placeholder:text-slate-600/80"
                placeholder="Type Message..."
                editable={!isSending}
                onSubmitEditing={onSendMessagePress}
                multiline
                numberOfLines={4}
                scrollEnabled={false}
                style={{
                  maxHeight: 100,
                }}
              />
            </View>
            <TouchableOpacity
              className={`flex-none p-4 bg-primary/90 rounded-full ${
                (isSending || !messageInputText.trim()) && "opacity-50"
              }`}
              onPress={onSendMessagePress}
              disabled={isSending || !messageInputText.trim()}
            >
              <FontAwesome name="send" size={22} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
