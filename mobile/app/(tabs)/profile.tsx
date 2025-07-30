import styles, { Colors, Spacing } from "@/assets/styles";
import ScreenContainer from "@/components/common/ScreenContainer";
import { useAuth } from "@/context/AuthContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Link } from "expo-router";
import React from "react";
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const Profile = () => {
  const { user, signOut } = useAuth();

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        onPress: signOut,
        style: "destructive",
      },
    ]);
  };

  return (
    <ScreenContainer>
      <View style={localStyles.header}>
        <Image
          source={{ uri: `https://i.pravatar.cc/150?u=${user?.email}` }}
          className="w-24 h-24 rounded-full bg-slate-200 mb-4"
        />
        <Text className="text-2xl font-bold text-slate-800">
          {user?.email || "User"}
        </Text>
        {user?.created_at && (
          <Text className="text-base text-slate-500 mt-1">
            Joined on {new Date(user.created_at).toLocaleDateString()}
          </Text>
        )}
      </View>

      <View className="mt-8">
        <Link href="/edit-profile" asChild>
          <TouchableOpacity style={localStyles.menuItem}>
            <Ionicons
              name="person-outline"
              size={22}
              color={Colors.neutral[600]}
            />
            <Text style={localStyles.menuItemText}>Edit Profile</Text>
            <Ionicons
              name="chevron-forward"
              size={22}
              color={Colors.neutral[400]}
            />
          </TouchableOpacity>
        </Link>
        <TouchableOpacity
          style={[localStyles.menuItem, { marginTop: Spacing.xl }]}
          onPress={handleSignOut}
        >
          <Ionicons
            name="log-out-outline"
            size={22}
            color={Colors.semantic.error}
          />
          <Text style={[localStyles.menuItemText, localStyles.signOutText]}>
            Sign Out
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
};

const localStyles = StyleSheet.create({
  header: {
    alignItems: "center",
    paddingTop: Spacing.xl,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    backgroundColor: Colors.neutral.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  menuItemText: {
    ...styles.body,
    flex: 1,
    marginLeft: Spacing.md,
    color: Colors.neutral[700],
    fontWeight: "600",
  },
  signOutText: {
    color: Colors.semantic.error,
  },
});

export default Profile;
