import React from "react";
import { Image, Pressable, StyleSheet, Text } from "react-native";
import { useProfilePhoto } from "../lib/firebase";
import { Colors, fonts } from "../lib/theme";
import { useColors } from "../lib/themeContext";

function initialsFor(name: string | null, email: string | null | undefined): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return "?";
}

// WattWise spec: 46px espresso circle in the top bar, 88px on the Account
// page. Shows the user's profile photo if they've added one (Profile page),
// otherwise their initials.
export function Avatar({
  name,
  email,
  size = 46,
  onPress,
}: {
  name: string | null;
  email: string | null | undefined;
  size?: number;
  onPress?: () => void;
}) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const photo = useProfilePhoto();
  return (
    <Pressable
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}
      onPress={onPress}
      disabled={!onPress}
    >
      {photo ? (
        <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <Text style={[styles.initials, { fontSize: size * 0.34 }]}>{initialsFor(name, email)}</Text>
      )}
    </Pressable>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    circle: {
      backgroundColor: colors.text,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    initials: {
      color: colors.bg,
      fontFamily: fonts.bodySemiBold,
    },
  });
}
