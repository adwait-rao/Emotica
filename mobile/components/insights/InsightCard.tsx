import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Text, View } from "react-native";
import InsightBarChart, { BarChartDataPoint } from "./InsightChart";

export type Insight = {
  id: string;
  category: string;
  name: string;
  description: string;
  derivation_source: string;
  display_type_suggestion: string;
  ai_summary_potential: string;
  actionable_tip_potential: string;
};

type ChartProps = {
  title: string;
  data: BarChartDataPoint[];
};

type InsightCardProps = {
  insight: Insight;
  chart?: ChartProps;
};

const InsightCard = ({ insight, chart }: InsightCardProps) => {
  return (
    <View className="p-4 mb-3 bg-white rounded-xl border border-slate-200 shadow-sm">
      <View className="flex-row items-start">
        <Ionicons
          name="bulb-outline"
          size={22}
          color="#5217E5"
          style={{ marginRight: 12, marginTop: 2 }}
        />
        <View className="flex-1">
          <Text className="text-lg font-semibold text-slate-800 mb-1">
            {insight.name}
          </Text>
          <Text className="text-base text-slate-600 leading-6">
            {insight.description}
          </Text>
        </View>
      </View>
      {chart && chart.data.length > 0 && (
        <InsightBarChart data={chart.data} title={chart.title} />
      )}
    </View>
  );
};

export default InsightCard;
