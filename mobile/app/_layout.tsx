import { SafeArea } from "@/components/SafeArea";
import "@/global.css";
import { Stack } from "expo-router";
export default function RootLayout() {
  return (
    <SafeArea>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeArea>
  );
}
