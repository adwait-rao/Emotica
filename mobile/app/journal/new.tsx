import journalQuestionsData from "@/assets/journalQuestions.json";
import { Colors } from "@/assets/styles";
import ScreenContainer from "@/components/common/ScreenContainer";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface JournalQuestion {
  id: string;
  question: string;
  input_type: "textarea" | "text" | "number";
}

const journalQuestions: JournalQuestion[] = journalQuestionsData;

type AnswerState = {
  [key: string]: string;
};

const NewJournalEntry = () => {
  const [answers, setAnswers] = useState<AnswerState>({});
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleInputChange = (id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const handleSave = () => {
    console.log("Journal Entry Saved:", answers);
    // Here you would typically save the data to a database or state management store
    Alert.alert("Entry Saved", "Your thought record has been saved.", [
      { text: "OK", onPress: () => router.back() },
    ]);
    setAnswers({}); // Clear form after saving
  };

  // Calculate the keyboard offset by adding the top inset (status bar height)
  // to a standard header height. This is more reliable than a hardcoded value.
  const headerHeight = Platform.select({ ios: 44, android: 56, default: 64 });
  const keyboardVerticalOffset = headerHeight + insets.top;

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {journalQuestions.map((item, index) => (
            <View key={item.id} className="mb-6">
              <Text className="text-lg font-semibold text-slate-700 mb-3">
                {index + 1}. {item.question}
              </Text>
              <TextInput
                value={answers[item.id] || ""}
                onChangeText={(text) => handleInputChange(item.id, text)}
                placeholder="Your thoughts..."
                placeholderTextColor={Colors.neutral[400]}
                multiline={item.input_type === "textarea"}
                numberOfLines={item.input_type === "textarea" ? 4 : 1}
                keyboardType={
                  item.input_type === "number" ? "numeric" : "default"
                }
                className="bg-slate-100 rounded-xl p-4 text-base text-slate-800 border border-slate-200"
                style={{
                  textAlignVertical:
                    item.input_type === "textarea" ? "top" : "center",
                  minHeight: item.input_type === "textarea" ? 120 : 0,
                }}
              />
            </View>
          ))}

          <TouchableOpacity
            onPress={handleSave}
            className="bg-primary py-4 rounded-xl mt-4 active:opacity-80"
          >
            <Text className="text-white text-center font-bold text-lg">
              Save Entry
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
};

export default NewJournalEntry;
