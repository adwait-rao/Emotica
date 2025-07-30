import ScreenContainer from "@/components/common/ScreenContainer";
import { useAuth } from "@/context/AuthContext";
import { Link } from "expo-router";
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

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSignInPress = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }
    setLoading(true);
    try {
      await signIn(email, password);
      // The useProtectedRoute hook in AuthContext will handle redirection.
    } catch (error: any) {
      Alert.alert("Sign In Error", error.message);
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
          <Text style={styles.heading}>Welcome Back</Text>
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
            Sign in to continue your journey.
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
              placeholder="Enter password"
              secureTextEntry={true}
              onChangeText={(password) => setPassword(password)}
              style={localStyles.textInput}
              placeholderTextColor={Colors.neutral[400]}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              localStyles.signInButton,
              loading && localStyles.buttonDisabled,
            ]}
            onPress={onSignInPress}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.neutral.white} />
            ) : (
              <Text style={styles.primaryButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={localStyles.signUpContainer}>
            <Text style={styles.caption}>Don't have an account?</Text>
            <Link href="/sign-up" asChild>
              <TouchableOpacity>
                <Text style={localStyles.signUpText}>Sign up</Text>
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
  signInButton: {
    width: "100%",
    marginTop: Spacing.lg,
  },
  buttonDisabled: {
    backgroundColor: Colors.neutral[400],
  },
  signUpContainer: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginTop: Spacing.xl,
  },
  signUpText: {
    ...styles.caption,
    color: Colors.primary.main,
    fontWeight: "700",
  },
});
