import ScreenContainer from "@/components/common/ScreenContainer";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import React, { useState } from "react";
import {
  GestureResponderEvent,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function Chat() {
  const [messageInputText, onMessageInputTextChange] = useState<string>("");

  const handlePress = (event: GestureResponderEvent) => {};
  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS == "ios" ? "padding" : "height"}
        keyboardVerticalOffset={50}
        style={{ flex: 1 }}
      >
        <View>
          <View className={`rounded-lg bg-primary/90 p-5`}>
            <Text className={`text-white text-xl`}>Hello</Text>
          </View>
        </View>
        <View className="absolute bottom-0 left-0 flex flex-row gap-4 items-center bg-background w-full">
          <TextInput
            value={messageInputText}
            onChangeText={onMessageInputTextChange}
            className="flex-grow bg-purple-100/80 rounded-xl p-5 text-lg placeholder:text-slate-600/80"
            placeholder="Type Message..."
          />
          <TouchableOpacity
            className="flex-none p-4 bg-primary/90 rounded-full"
            onPress={handlePress}
          >
            <FontAwesome name="send" size={22} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
