import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Text, TouchableOpacity } from "react-native";

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

export type Entry = {
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

export const EventCard = ({ item }: { item: Entry }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      className="mb-4 border-2 border-fuchsia-50"
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
