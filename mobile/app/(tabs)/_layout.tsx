import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import "@/global.css";
import Ionicons from "@expo/vector-icons/Ionicons";
import Home from ".";
import Chat from "./chat";
import Insights from "./insights";
import Profile from "./profile";

const Tab = createBottomTabNavigator();

export default function TabLayout() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;
          switch (route.name) {
            case "Home": {
              iconName = focused ? "home" : "home-outline";
              break;
            }
            case "Chat": {
              iconName = focused ? "chatbubbles" : "chatbubbles-outline";
              break;
            }
            case "Insights": {
              iconName = focused ? "journal" : "journal-outline";
              break;
            }
            case "Profile": {
              iconName = focused ? "person" : "person-outline";
              break;
            }
            default: {
              iconName = "";
              break;
            }
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#5217E5",
        tabBarInactiveTintColor: "#6E6387",
        headerTitleAlign: "center",
        animation: "shift",
        headerShown: false,
        headerShadowVisible: false,
      })}
    >
      <Tab.Screen name="Home" component={Home} />
      <Tab.Screen name="Chat" component={Chat} />
      <Tab.Screen name="Insights" component={Insights} />
      <Tab.Screen name="Profile" component={Profile} />
    </Tab.Navigator>
  );
}
