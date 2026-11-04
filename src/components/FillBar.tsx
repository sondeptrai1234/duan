import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { fillColor } from "../theme";

export default function FillBar({ value, height = 9 }: { value: number; height?: number }) {
  const progress = useSharedValue(0);
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  useEffect(() => { progress.value = withTiming(safe, { duration: 550 }); }, [safe, progress]);
  const animated = useAnimatedStyle(() => ({ width: `${progress.value}%` }));
  return (
    <View style={{ height, backgroundColor: "#E7EEE8", borderRadius: height, overflow: "hidden" }}>
      <Animated.View style={[{ height, borderRadius: height, backgroundColor: fillColor(safe) }, animated]} />
    </View>
  );
}
