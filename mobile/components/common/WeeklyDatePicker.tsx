import MaskedView from "@react-native-masked-view/masked-view";
import { addDays, format, isBefore, isToday, startOfWeek } from "date-fns";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

const WeeklyDatePicker = () => {
  const scrollViewRef = useRef<ScrollView>(null);
  const today = new Date();
  const weekStartDate = startOfWeek(today, { weekStartsOn: 1 }); // Monday
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i));

  useEffect(() => {
    const index = dates.findIndex((date) => isToday(date));
    if (scrollViewRef.current && index >= 0) {
      scrollViewRef.current.scrollTo({ x: index * 92, animated: true });
    }
  }, []);

  const getShadowForDate = (date: Date) => {
    const isCurrent = isToday(date);
    const isPast = isBefore(date, today) && !isCurrent;

    if (isCurrent) {
      return {
        shadowColor: "#d946ef",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 8,
      };
    } else if (isPast) {
      return {
        shadowColor: "#d946ef",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 4,
      };
    } else {
      return {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
        elevation: 2,
      };
    }
  };

  return (
    <View className="px-4 py-5">
      <MaskedView
        style={{ height: 90, width: "100%" }}
        maskElement={
          <LinearGradient
            colors={["transparent", "black", "black", "transparent"]}
            locations={[0, 0.08, 0.92, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        }
      >
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 60,
          }}
          className="flex-row gap-3"
        >
          {dates.map((date) => {
            const dayName = format(date, "EEE");
            const dayDate = format(date, "dd MMM");
            const isCurrent = isToday(date);
            const isPast = isBefore(date, today) && !isCurrent;

            // Tailwind border and background classes
            let borderClass =
              isCurrent || isPast ? "border-[#d946ef80]" : "border-[#64748b80]";
            let borderWidthClass = isCurrent ? "border-2" : "border";
            let bgClass = "bg-white";
            let radiusClass = "rounded-2xl"; // consistent radius

            // Gradient color for the overlay
            let gradientStartColor =
              isCurrent || isPast ? "#e2cfff" : "#d9d9d9";

            // Shadows via StyleSheet
            const shadowStyle = getShadowForDate(date);

            return (
              <TouchableOpacity
                key={date.toISOString()}
                style={shadowStyle}
                className={[
                  "h-20 w-20 mx-2 p-3 justify-between items-center relative overflow-hidden",
                  borderClass,
                  borderWidthClass,
                  bgClass,
                  radiusClass,
                ].join(" ")}
              >
                <View className="absolute inset-0 rounded-lg">
                  <LinearGradient
                    colors={[gradientStartColor, "rgba(255, 255, 255, 1)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={{ flex: 1, borderRadius: 12 }}
                  />
                </View>

                <View className="relative z-10 flex items-center">
                  <Text
                    className={`font-bold text-lg ${
                      isCurrent
                        ? "text-black"
                        : isPast
                          ? "text-gray-700"
                          : "text-slate-600"
                    }`}
                  >
                    {dayName}
                  </Text>
                  <Text
                    className={`text-sm ${
                      isCurrent
                        ? "text-gray-800"
                        : isPast
                          ? "text-gray-700"
                          : "text-slate-500"
                    }`}
                  >
                    {dayDate}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </MaskedView>
    </View>
  );
};

export default WeeklyDatePicker;
