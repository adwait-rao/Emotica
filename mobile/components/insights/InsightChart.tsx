import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { BarChart } from "react-native-gifted-charts";

export type BarChartDataPoint = {
  label: string;
  value: number;
};

type InsightBarChartProps = {
  data: BarChartDataPoint[];
  title: string;
};

const InsightBarChart = ({ data, title }: InsightBarChartProps) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <BarChart
        data={data}
        barWidth={22}
        spacing={40}
        barBorderRadius={6}
        frontColor="#a88ced" // Bar color
        yAxisTextStyle={styles.axisLabel}
        xAxisLabelTextStyle={styles.label}
        hideYAxisText
        yAxisThickness={0}
        xAxisThickness={0}
        noOfSections={4}
        rulesType="dashed"
        rulesColor="#e2dcfc"
        isAnimated
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: "#f9f5ff", // Light purple, matching the theme
    borderRadius: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#3b0764", // Darker purple
    marginBottom: 24,
    textAlign: "center",
  },
  label: {
    fontSize: 11,
    color: "#6E6387",
    textAlign: "center",
    width: 60, // Give width to allow for wrapping if needed
  },
  axisLabel: {
    color: "#6E6387",
  },
});

export default InsightBarChart;
