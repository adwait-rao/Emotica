import { authService } from "@/services/authService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useSegments } from "expo-router";
import React, { createContext, useContext, useEffect, useState } from "react";

// Define the shape of the context value
interface AuthContextType {
  user: any; // You might want to define a more specific User type
  token: string | null;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string) => Promise<any>;
  signOut: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Custom hook to use the AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// This hook will protect the route access based on user authentication.
function useProtectedRoute(user: any, loading: boolean) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // If the auth state is still loading, don't do anything.
    // This prevents the router from navigating before the layout is mounted.
    if (loading) {
      return;
    }
    const inAuthGroup = segments[0] === "(auth)";

    if (
      // If the user is not signed in and the initial segment is not anything in the auth group.
      !user &&
      !inAuthGroup
    ) {
      // Redirect to the sign-in page.
      router.replace("/sign-in");
    } else if (user && inAuthGroup) {
      // Redirect away from the sign-in page.
      router.replace("/");
    }
  }, [user, segments, router, loading]);
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuthState = async () => {
      try {
        const storedToken = await AsyncStorage.getItem("accessToken");
        if (storedToken) {
          // Here you might want to verify the token with your backend.
          // For now, we'll assume if a token exists, the user is logged in.
          const userData = await AsyncStorage.getItem("user");
          if (userData) {
            setUser(JSON.parse(userData));
            setToken(storedToken);
          }
        }
      } catch (error) {
        console.error("Error checking auth state:", error);
        // Handle error, maybe sign out
      } finally {
        setLoading(false);
      }
    };

    checkAuthState();
  }, []);

  useProtectedRoute(user, loading);

  const signUp = async (email: string, password: string) => {
    // The sign-up logic will be handled in the sign-up screen for now
    // to provide specific user feedback (e.g., "check your email").
    // This function can be expanded later if needed.
    return authService.signUp(email, password);
  };

  const signIn = async (email: string, password: string) => {
    try {
      const data = await authService.signIn(email, password);
      if (data.session?.access_token) {
        await AsyncStorage.setItem("user", JSON.stringify(data.user));
        await AsyncStorage.setItem("accessToken", data.session.access_token);
        setToken(data.session.access_token);
        setUser(data.user);
      }
      return data;
    } catch (error) {
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await AsyncStorage.multiRemove(["user", "accessToken"]);
      setUser(null);
      setToken(null);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const value = {
    user,
    token,
    signIn,
    signUp,
    signOut,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
