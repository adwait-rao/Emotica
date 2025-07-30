// InsightList.js (No changes needed, it's already set up correctly for ListHeaderComponent)
import insightsData from "@/insightsComponents.json";
import React from "react";
import { SectionList, Text } from "react-native";
import InsightCard, { Insight } from "./InsightCard";

// Sample chart data for demonstration purposes.
// In a real app, this would come from a user's data store or an API.
const sampleDistortionsData = [
  { label: "Catastrophizing", value: 8 },
  { label: "Mind Reading", value: 5 },
  { label: "Black & White", value: 12 },
  { label: "Overgeneralizing", value: 7 },
];

const typedInsightsData: Insight[] = insightsData;

const insightsByCategory = typedInsightsData.reduce(
  (acc, insight) => {
    const { category } = insight;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(insight);
    return acc;
  },
  {} as Record<string, Insight[]>
);

const sections = Object.keys(insightsByCategory).map((category) => ({
  title: category,
  data: insightsByCategory[category],
}));

const InsightList = ({
  ListHeaderComponent,
}: {
  ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null;
}) => {
  return (
    <SectionList
      sections={sections}
      ListHeaderComponent={ListHeaderComponent}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => {
        // Conditionally add chart data to a specific insight card for demonstration
        if (item.id === "insight_cognitive_distortions_frequency") {
          return (
            <InsightCard
              insight={item}
              chart={{
                title: "Your Common Distortions",
                data: sampleDistortionsData,
              }}
            />
          );
        }
        return <InsightCard insight={item} />;
      }}
      renderSectionHeader={({ section: { title } }) => (
        <Text className="text-2xl font-bold text-primary mb-3 bg-background px-safe py-4">
          {title}
        </Text>
      )}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 20 }}
      stickySectionHeadersEnabled={true}
    />
  );
};

export default InsightList;
