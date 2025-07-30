import { Stack } from "expo-router";
import React from "react";

export default function JournalLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="new"
        options={{
          title: "New Thought Record",
          headerBackTitleVisible: false,
          headerShadowVisible: false,
        }}
      />
    </Stack>
  );
}
