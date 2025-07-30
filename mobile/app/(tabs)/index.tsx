import Button from "@/components/common/Button";
import { GradientText } from "@/components/common/GradientText";
import ScreenContainer from "@/components/common/ScreenContainer";
import WeeklyDatePicker from "@/components/common/WeeklyDatePicker";
import { EventCard, entries } from "@/components/EventList";
import { LinearGradient } from "expo-linear-gradient";
import { FlatList, StyleSheet, Text, View } from "react-native";

const HomeHeader = () => (
  <View>
    <View className="my-7">
      <GradientText
        colors={["#5217E5", "#a88ced"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradientTextStyle}
      >
        Good afternoon, Adwait
      </GradientText>
      <Text className="text-xl text-slate-700 mt-4">
        Ready for today's Reflection?
      </Text>
    </View>
    <View>
      <Text className="font-bold text-2xl text-secondary">This Week</Text>
      <WeeklyDatePicker />
    </View>
    <View className="w-full px-safe py-4 rounded-xl overflow-hidden">
      <LinearGradient
        colors={["#6620E8", "#A58AFF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBox}
      >
        <View className="mb-4">
          <Text className="text-white font-bold text-2xl mb-3 ">
            Today's Reflection
          </Text>
          <Text className="text-white/90">What's on your mind Today?</Text>
        </View>
        <Button type="secondary">Start Journaling</Button>
      </LinearGradient>
    </View>
    <Text className="text-2xl font-bold my-4 text-primary">Your Events</Text>
  </View>
);

export default function Home() {
  return (
    <ScreenContainer>
      <FlatList
        data={entries}
        renderItem={({ item }) => <EventCard item={item} />}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={<HomeHeader />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  gradientTextStyle: {
    fontSize: 28,
    fontWeight: "bold",
    fontFamily: "Inter_900Black",
    textAlign: "left", // Left align the gradient text
    alignSelf: "flex-start", // Ensure the text is left-aligned in the parent
  },

  gradientBox: {
    width: "100%",
    padding: 16,
    borderRadius: 15,
    display: "flex",
    // flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
});
