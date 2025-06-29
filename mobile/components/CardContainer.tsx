import React from "react";
import { View } from "react-native";

export default function CardContainer({ children }: React.PropsWithChildren) {
  return (
    <View className="rounded-xl border border-slate-500/50 px-6 py-3">
      {children}
    </View>
  );
}
