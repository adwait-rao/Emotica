import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";

// Sample data with event names
export const entries = [
  {
    id: "7xg1w9fLqk2",
    event_name: "Therapy Session",
    event_date: "2025-04-15T09:30:00",
    event_summary: "Morning therapy session with Dr. Sarah",
  },
  {
    id: "aB8sKpQ3mRn",
    event_name: "Mindfulness Workshop",
    event_date: "2025-04-16T18:00:00",
    event_summary: "Attended mindfulness workshop at community center",
  },
  {
    id: "vZ5hT9wXqLm",
    event_name: "Lunch with Friend",
    event_date: "2025-04-17T12:15:00",
    event_summary: "Had lunch with old friend, felt connected again",
  },
];

type Entry = {
  id: string;
  event_name: string;
  event_date: string;
  event_summary: string;
};

const formatEventDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const EventCard = ({ item }: { item: Entry }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      className="mb-4"
      style={{ borderRadius: 16 }}
    >
      <LinearGradient
        colors={["#f3e7ff", "#e9d6ff"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 16,
          padding: 16,
        }}
      >
        <Text className="text-xs text-primary font-semibold mb-1">
          {formatEventDate(item.event_date)}
        </Text>
        <Text className="text-lg text-secondary font-bold mb-1">
          {item.event_name}
        </Text>
        <Text className="text-base text-gray-900/75 font-semibold">
          {item.event_summary}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const EventList = () => {
  return (
    <View className="flex-1 bg-background">
      <Text className="text-2xl font-bold mb-4 text-primary">Your Events</Text>
      <MaskedView
        maskElement={
          <LinearGradient
            colors={["transparent", "black", "black", "transparent"]}
            locations={[0, 0.01, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ flex: 1 }}
          />
        }
      >
        <FlatList
          data={entries}
          renderItem={({ item }) => <EventCard item={item} />}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Text className="text-center text-gray-500 py-4">
              No events yet.
            </Text>
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: 12,
          }}
        />
      </MaskedView>
    </View>
  );
};

export default EventList;
