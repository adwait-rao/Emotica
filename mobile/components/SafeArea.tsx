import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const SafeArea: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const insets = useSafeAreaInsets();
  return <View style={{ paddingTop: insets.top, flex: 1 }}>{children}</View>;
};
