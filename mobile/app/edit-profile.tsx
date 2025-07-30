import styles, {
  BorderRadius,
  Colors,
  FontSizes,
  Spacing,
} from "@/assets/styles";
import ScreenContainer from "@/components/common/ScreenContainer";
import { Stack } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from "react-native";

export default function EditProfile() {
  const [username, setUsername] = useState("adwaitrao");
  const [name, setName] = useState("Adwait Rao");
  const [age, setAge] = useState("25");
  const [birthdate, setBirthdate] = useState("1999-01-01");
  const [email, setEmail] = useState("adwait@example.com");
  const [password, setPassword] = useState("");

  interface FormFieldProps extends TextInputProps {
    label: string;
  }

  // A reusable FormField component for this screen
  const FormField = ({ label, ...props }: FormFieldProps) => (
    <View style={localStyles.formFieldContainer}>
      <Text style={localStyles.label}>{label}</Text>
      <TextInput
        style={localStyles.textInput}
        placeholderTextColor={Colors.neutral[400]}
        {...props}
      />
    </View>
  );

  return (
    <ScreenContainer>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Edit Profile",
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={localStyles.container}
          contentContainerStyle={localStyles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <FormField
            label="Username"
            value={username}
            onChangeText={setUsername}
            placeholder="Enter your username"
          />
          <FormField
            label="Full Name"
            value={name}
            onChangeText={setName}
            placeholder="Enter your full name"
          />
          <FormField
            label="Age"
            value={age}
            onChangeText={setAge}
            placeholder="Enter your age"
            keyboardType="numeric"
          />
          <FormField
            label="Birthdate"
            value={birthdate}
            onChangeText={setBirthdate}
            placeholder="YYYY-MM-DD"
          />
          <View style={localStyles.formFieldContainer}>
            <Text style={localStyles.label}>Email</Text>
            <View style={localStyles.emailRow}>
              <TextInput
                style={[localStyles.textInput, { flex: 1 }]}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                keyboardType="email-address"
                placeholderTextColor={Colors.neutral[400]}
              />
              <TouchableOpacity style={localStyles.otpButton}>
                <Text style={localStyles.otpButtonText}>Send OTP</Text>
              </TouchableOpacity>
            </View>
          </View>
          <FormField
            label="New Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Enter new password (optional)"
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.primaryButton, localStyles.saveButton]}
          >
            <Text style={styles.primaryButtonText}>Save Changes</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.lg,
  },
  formFieldContainer: {
    marginBottom: Spacing.lg,
  },
  label: {
    ...styles.caption,
    color: Colors.neutral[700],
    fontFamily: "Inter-SemiBold",
    marginBottom: Spacing.sm,
  },
  textInput: {
    backgroundColor: Colors.neutral[100],
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    fontSize: FontSizes.base,
    fontFamily: "Inter-Regular",
    color: Colors.neutral[800],
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  otpButton: {
    backgroundColor: Colors.primary[100],
    paddingHorizontal: Spacing.md,
    paddingVertical: 14, // To roughly match input height
    borderRadius: BorderRadius.lg,
  },
  otpButtonText: {
    color: Colors.primary.dark,
    fontFamily: "Inter-SemiBold",
    fontSize: FontSizes.sm,
  },
  saveButton: {
    marginTop: Spacing.md,
  },
});
