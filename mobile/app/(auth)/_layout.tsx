import { Stack } from "expo-router";
import React from "react";

export default function AuthLayout() {
  // This layout component will ensure that the auth screens are rendered in a stack.
  return <Stack screenOptions={{ headerShown: false }} />;
}
