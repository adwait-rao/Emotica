import "@/global.css";
import Ionicons from "@expo/vector-icons/Ionicons";
import Octicons from "@expo/vector-icons/Octicons";
import { Tabs } from "expo-router";
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TabLayout() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "white" }} edges={["top"]}>
      <Tabs
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: React.ComponentProps<typeof Ionicons>["name"];
            switch (route.name) {
              case "index": {
                iconName = focused ? "home" : "home-outline";
                break;
              }
              case "chat": {
                iconName = focused ? "chatbubbles" : "chatbubbles-outline";
                break;
              }
              case "journaling": {
                iconName = focused ? "journal" : "journal-outline";
                break;
              }
              case "insights": {
                return <Octicons name="graph" size={size} color={color} />;
              }
              case "profile": {
                iconName = focused ? "person" : "person-outline";
                break;
              }
              default: {
                iconName = "alert-circle-outline"; // Fallback icon
                break;
              }
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: "#5217E5",
          tabBarInactiveTintColor: "#6E6387",
          headerShown: false,
          tabBarStyle: { backgroundColor: "white", borderTopWidth: 0 },
        })}
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen name="chat" options={{ title: "Chat" }} />
        <Tabs.Screen name="journaling" options={{ title: "Journaling" }} />
        <Tabs.Screen name="insights" options={{ title: "Insights" }} />
        <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      </Tabs>
    </SafeAreaView>
  );
}
