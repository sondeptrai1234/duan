import React from "react";
import { View } from "react-native";
import { fillColor } from "../theme";

export default function FillBar({ value, height = 10 }: { value: number; height?: number }) {
  return (
    <View style={{ height, backgroundColor: "#E5E7EB", borderRadius: height, overflow: "hidden" }}>
      <View
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          height,
          backgroundColor: fillColor(value),
        }}
      />
    </View>
  );
}