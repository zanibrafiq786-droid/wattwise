import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Colors, fonts, spacing } from "../lib/theme";
import { useColors } from "../lib/themeContext";
import { Card } from "./Card";
import { Icon, IconName } from "./Icon";

// A card that stays collapsed (just its title row) until tapped, so long
// sections like the AI explanation and the forecast don't crowd the page.
export function Expandable({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: IconName;
  children: React.ReactNode;
}) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const [open, setOpen] = useState(false);
  return (
    <Card style={styles.card}>
      <Pressable style={styles.header} onPress={() => setOpen((o) => !o)} hitSlop={6}>
        <View style={styles.iconWrap}>
          <Icon name={icon} size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }}>
          <Icon name="chev" size={18} color={colors.textMuted} />
        </View>
      </Pressable>
      {open && <View style={styles.body}>{children}</View>}
    </Card>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    card: { gap: 0 },
    header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    iconWrap: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { color: colors.text, fontSize: 16, fontFamily: fonts.headingMedium },
    subtitle: { color: colors.textMuted, fontSize: 12 },
    body: { gap: spacing.sm, marginTop: spacing.md },
  });
}
