import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient"; // or 'react-native-linear-gradient'
import { ReactNode } from "react";
import { ColorValue, StyleProp, Text, TextStyle } from "react-native";

type Props = {
  readonly colors: [ColorValue, ColorValue, ...ColorValue[]];
  start: { x: number; y: number };
  end: { x: number; y: number };
  style: StyleProp<TextStyle>;
  children: ReactNode;
};

export const GradientText = ({
  colors,
  start,
  end,
  style,
  children,
}: Props) => {
  return (
    <MaskedView maskElement={<Text style={style}>{children}</Text>}>
      <LinearGradient colors={colors} start={start} end={end}>
        {/* The Text component inside LinearGradient needs to have opacity: 0
                so the gradient can "show through" the mask. */}
        <Text style={[style, { opacity: 0 }]}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  );
};
