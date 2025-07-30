import ScreenContainer from "@/components/common/ScreenContainer";
import InsightList from "@/components/insights/InsightList";
import React from "react";
import { Text, View } from "react-native";

export default function Insights() {
  return (
    <ScreenContainer>
      <InsightList
        ListHeaderComponent={
          <View className="py-5">
            <Text className="text-3xl font-bold text-slate-800">
              Your Insights
            </Text>
            <Text className="text-slate-500 mt-2 text-lg">
              Discover patterns and trends in your well-being.
            </Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}
