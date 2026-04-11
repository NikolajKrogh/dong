import React from "react";
import { View } from "react-native";

interface PlatformGestureRootProps {
  children: React.ReactNode;
  style?: any;
  testID?: string;
}

export const PlatformGestureRoot: React.FC<PlatformGestureRootProps> = ({
  children,
  style,
  testID,
}) => {
  return (
    <View style={style} testID={testID}>
      {children}
    </View>
  );
};

export default PlatformGestureRoot;
