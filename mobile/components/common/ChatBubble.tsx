import FontAwesome from "@expo/vector-icons/FontAwesome";
import { format } from "date-fns";
import React from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";

export type Message = {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: string;
  error?: boolean;
};

export default function ChatBubble({
  message,
  onRetry,
  userAvatar,
}: {
  message: Message;
  onRetry?: () => void;
  userAvatar?: string;
}) {
  const { text, isUser, timestamp, error } = message;
  const botAvatar =
    "https://cdn.dribbble.com/users/2423935/screenshots/15448373/media/44545796790516551b8528c8b37f8535.jpg";
  const avatarUri = isUser ? userAvatar : botAvatar;
  return (
    <View
      className={`flex w-full ${
        isUser ? "flex-row" : "flex-row-reverse"
      } justify-end items-end gap-3 mt-4`}
    >
      <View
        className={`flex ${
          isUser ? "justify-end items-end" : " "
        } max-w-[70%] rounded-t-3xl ${
          isUser
            ? "rounded-bl-3xl bg-primary/90"
            : "rounded-br-3xl bg-gray-400/20"
        } px-5 py-3 align-bottom ${error && "bg-red-500/90"}`}
      >
        <Text
          className={`${isUser ? "text-white" : "text-slate-900"} w-full text-left text-md`}
        >
          {text}
        </Text>
        <View className="flex-row items-center gap-2 self-end mt-1">
          {error && onRetry && (
            <TouchableOpacity onPress={onRetry} className="mr-1">
              <FontAwesome name="refresh" size={14} color="white" />
            </TouchableOpacity>
          )}
          <Text
            className={`${
              isUser || error ? "text-white" : "text-slate-900"
            } text-xs opacity-70`}
          >
            {error
              ? "Failed to send"
              : format(new Date(message.timestamp.replace(" ", "T")), "h:mm a")}
          </Text>
        </View>
      </View>
      <View className="h-11 w-11">
        <Image
          style={{
            flex: 1,
            borderRadius: 50,
            backgroundColor: "#0553",
          }}
          source={{
            uri: avatarUri,
          }}
        />
      </View>
    </View>
  );
}
