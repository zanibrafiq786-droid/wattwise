import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Colors, fonts } from "../lib/theme";
import { useColors } from "../lib/themeContext";
import { Icon, IconName } from "./Icon";

// Small pill-style toggle (e.g. Circle | Bars, This month | Full year).
export function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string; icon?: IconName }[];
  value: K;
  onChange: (k: K) => void;
}) {
  const colors = useColors();
  const styles = makeStyles(colors);
  return (
    <View style={styles.wrap}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={[styles.item, active && styles.itemActive]}>
            {o.icon && <Icon name={o.icon} size={13} color={active ? colors.bg : colors.textMuted} />}
            <Text style={[styles.text, active && styles.textActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    wrap: { flexDirection: "row", backgroundColor: colors.surfaceAlt, borderRadius: 999, padding: 3, alignSelf: "flex-start" },
    item: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
    itemActive: { backgroundColor: colors.text },
    text: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.bodySemiBold },
    textActive: { color: colors.bg },
  });
}
