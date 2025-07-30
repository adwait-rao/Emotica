import ScreenContainer from "@/components/common/ScreenContainer";
import { useAuth } from "@/context/AuthContext";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import styles, {
  BorderRadius,
  Colors,
  FontSizes,
  Shadows,
  Spacing,
} from "../../assets/styles";

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSignUpPress = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters long.");
      return;
    }
    setLoading(true);
    try {
      const result = await signUp(email, password);
      // This assumes the backend sends a user object.
      // If email confirmation is required, the user is not logged in automatically.
      if (result.user) {
        Alert.alert(
          "Account Created",
          "Please check your email to verify your account before signing in.",
          [{ text: "OK", onPress: () => router.replace("/sign-in") }]
        );
      }
    } catch (error: any) {
      Alert.alert("Sign Up Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, justifyContent: "center" }}
      >
        <View style={localStyles.contentContainer}>
          <Text style={styles.heading}>Create Account</Text>
          <Text
            style={[
              styles.body,
              {
                color: Colors.neutral[600],
                marginTop: Spacing.sm,
                marginBottom: Spacing.xl,
                textAlign: "center",
              },
            ]}
          >
            Join us to start your journey.
          </Text>

          <View style={localStyles.inputContainer}>
            <TextInput
              autoCapitalize="none"
              value={email}
              placeholder="Enter email"
              onChangeText={setEmail}
              style={localStyles.textInput}
              placeholderTextColor={Colors.neutral[400]}
              keyboardType="email-address"
            />
            <TextInput
              value={password}
              placeholder="Enter password (min. 6 characters)"
              secureTextEntry={true}
              onChangeText={setPassword}
              style={localStyles.textInput}
              placeholderTextColor={Colors.neutral[400]}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              localStyles.signUpButton,
              loading && localStyles.buttonDisabled,
            ]}
            onPress={onSignUpPress}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.neutral.white} />
            ) : (
              <Text style={styles.primaryButtonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <View style={localStyles.signInContainer}>
            <Text style={styles.caption}>Already have an account?</Text>
            <Link href="/sign-in" asChild>
              <TouchableOpacity>
                <Text style={localStyles.signInText}>Sign in</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const localStyles = StyleSheet.create({
  contentContainer: {
    width: "100%",
    alignItems: "center",
  },
  inputContainer: {
    width: "100%",
    gap: Spacing.md,
  },
  textInput: {
    backgroundColor: Colors.neutral.white,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    fontSize: FontSizes.base,
    fontFamily: "Inter-Regular",
    color: Colors.neutral[800],
    borderWidth: 1,
    borderColor: Colors.neutral[300],
    ...Shadows.sm,
  },
  signUpButton: {
    width: "100%",
    marginTop: Spacing.lg,
  },
  buttonDisabled: {
    backgroundColor: Colors.neutral[400],
  },
  signInContainer: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginTop: Spacing.xl,
  },
  signInText: {
    ...styles.caption,
    color: Colors.primary.main,
    fontWeight: "700",
  },
});
