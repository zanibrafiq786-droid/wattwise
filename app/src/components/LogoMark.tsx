import React from "react";
import { Image } from "react-native";

// The WattWise logo (Redesign/logo): an orange disc split by a lightning
// bolt. Its orange is used here and nowhere else in the interface.
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <Image
      source={require("../../assets/logo-256.png")}
      style={{ width: size, height: size }}
      accessibilityRole="image"
      accessibilityLabel="WattWise"
    />
  );
}
