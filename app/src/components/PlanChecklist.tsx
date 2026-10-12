import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Colors, fonts, radius, spacing } from "../lib/theme";
import { useColors } from "../lib/themeContext";
import { Icon } from "./Icon";

// Next month's plan as a checklist: each step is a card with a number,
// which the user can tick off as they do it (ticks are just on this screen).
export function PlanChecklist({ steps }: { steps: string[] }) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const [done, setDone] = useState<Set<number>>(new Set());

  function toggle(i: number) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <View style={{ gap: spacing.sm }}>
      {steps.map((step, i) => {
        const isDone = done.has(i);
        return (
          <Pressable key={i} style={[styles.step, isDone && styles.stepDone]} onPress={() => toggle(i)}>
            <View style={[styles.circle, isDone && { backgroundColor: colors.success, borderColor: colors.success }]}>
              {isDone ? (
                <Icon name="check" size={14} color="#FFFFFF" />
              ) : (
                <Text style={styles.num}>{i + 1}</Text>
              )}
            </View>
            <Text style={[styles.text, isDone && styles.textDone]}>{step}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    step: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    stepDone: { opacity: 0.6 },
    circle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    num: { color: colors.primary, fontSize: 13, fontFamily: fonts.bodySemiBold },
    text: { color: colors.text, fontSize: 14, lineHeight: 20, flex: 1 },
    textDone: { textDecorationLine: "line-through" },
  });
}
