import ScreenContainer from "@/components/common/ScreenContainer";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Link } from "expo-router";
import React from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";

// Mock data for demonstration.
const mockEntries = [
  {
    id: "1",
    date: "October 27, 2023",
    title: "Feeling overwhelmed at work",
    snippet:
      "My automatic thought was \"I can't handle this project, I'm going to fail.\" It made me feel anxious and stuck.",
  },
  {
    id: "2",
    date: "October 25, 2023",
    title: "Anxious about a social event",
    snippet:
      "I thought everyone would judge me and that I wouldn't have anything interesting to say. I felt very self-conscious.",
  },
  {
    id: "3",
    date: "October 24, 2023",
    title: "Frustrated with traffic",
    snippet:
      'Felt angry and thought "This always happens to me, my day is ruined now." This is an example of overgeneralization.',
  },
];

const JournalCard = ({ item }: { item: (typeof mockEntries)[0] }) => (
  <View className="p-4 mb-4 bg-white rounded-xl border border-slate-200 shadow-sm">
    <Text className="text-sm text-slate-500 mb-1">{item.date}</Text>
    <Text className="text-lg font-semibold text-slate-800 mb-2">
      {item.title}
    </Text>
    <Text className="text-base text-slate-600 leading-6" numberOfLines={2}>
      {item.snippet}
    </Text>
    <TouchableOpacity className="mt-3 flex-row items-center self-start">
      <Text className="text-primary font-semibold">Read More</Text>
      <Ionicons
        name="arrow-forward"
        size={16}
        color="#5217E5"
        style={{ marginLeft: 4 }}
      />
    </TouchableOpacity>
  </View>
);

const Journaling = () => {
  return (
    <ScreenContainer>
      <View className="py-5 flex-row justify-between items-center mb-4">
        <View>
          <Text className="text-3xl font-bold text-slate-800">
            Your Journal
          </Text>
          <Text className="text-slate-500 mt-2 text-lg">
            Reflect on your thoughts and feelings.
          </Text>
        </View>
        <Link href="/journal/new" asChild>
          <TouchableOpacity className="bg-primary p-3 rounded-full active:opacity-80 shadow-md shadow-primary/50">
            <Ionicons name="add" size={28} color="white" />
          </TouchableOpacity>
        </Link>
      </View>

      <FlatList
        data={mockEntries}
        renderItem={({ item }) => <JournalCard item={item} />}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center mt-24">
            <Text className="text-slate-500 text-lg">
              No journal entries yet.
            </Text>
            <Text className="text-slate-400 mt-2">
              Tap the '+' to add your first one!
            </Text>
          </View>
        }
      />
    </ScreenContainer>
  );
};

export default Journaling;
