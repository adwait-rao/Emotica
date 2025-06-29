import React from "react";
import { View } from "react-native";

export default function ScreenContainer({ children }: React.PropsWithChildren) {
  return <View className="px-4 py-5 flex-1 bg-background">{children}</View>;
}
