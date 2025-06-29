import React from "react";
import { Text, TouchableOpacity } from "react-native";

// Define button types
type ButtonType = "primary" | "secondary";

interface ButtonProps {
  type?: ButtonType;
  children: React.ReactNode;
}

const Button = ({ type = "primary", children }: ButtonProps) => {
  const baseStyle = "px-4 py-2 rounded-lg";

  const styles = {
    primary: "bg-primary",
    secondary: "bg-[#A58AFF]",
  };

  // Native shadow style
  const shadowStyle = {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4, // Android
  };

  return (
    <TouchableOpacity
      style={type === "primary" ? shadowStyle : undefined}
      className={`${baseStyle} ${styles[type]} text-white`}
    >
      <Text
        className={`${type === "primary" ? "text-white" : "text-white"} text-xl`}
      >
        {children}
      </Text>
    </TouchableOpacity>
  );
};

export default Button;
