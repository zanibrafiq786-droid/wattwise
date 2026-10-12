import { useNavigation } from "@react-navigation/native";
import React, { useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../components/Button";
import { Icon, IconName } from "../components/Icon";
import { Floating } from "../components/Floating";
import { GlassOrb } from "../components/GlassOrb";
import { TextField } from "../components/TextField";
import { useAuth } from "../lib/authContext";
import { ChatMessage, clearChat, sendChatMessage, useChatMessages, usePendingTimeout } from "../lib/chat";
import { TranslationKey, useI18n } from "../lib/i18n";
import { Colors, fonts, spacing } from "../lib/theme";
import { useColors } from "../lib/themeContext";

// Welcome-screen starters. Each one is answerable from the data the chat
// worker actually gives the model (bills, slab status, 7-day waste,
// forecast -- see brain/chat_context.py), so none leads to a "no data" reply.
const STARTERS: { key: TranslationKey; icon: IconName }[] = [
  { key: "chatQ1", icon: "chart" },
  { key: "chatQ2", icon: "door" },
  { key: "chatQ3", icon: "bolt" },
  { key: "chatQ4", icon: "check" },
];

export function ChatScreen() {
  const { user, displayName } = useAuth();
  const { t, language } = useI18n();
  const colors = useColors();
  const styles = makeStyles(colors);
  const navigation = useNavigation();
  const uid = user?.uid ?? null;
  const { messages, pendingRequestId } = useChatMessages(uid);
  const offline = usePendingTimeout(pendingRequestId);
  const [input, setInput] = useState("");
  const listRef = useRef<FlatList>(null);

  const firstName = displayName?.split(" ")[0] || user?.email?.split("@")[0] || "";
  // Suggested questions appear only on the welcome screen (the four starter
  // cards). Once the conversation starts there are no follow-up chips --
  // by request, the chat stays just questions and answers.

  function handleSend(text?: string) {
    const toSend = (text ?? input).trim();
    if (!uid || !toSend) return;
    sendChatMessage(uid, toSend, language);
    setInput("");
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* "padding" on Android too: with edge-to-edge screens Android no longer
          shrinks the window for the keyboard, so we push the input up ourselves. */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={styles.topRow}>
          <View style={styles.titleRow}>
            <GlassOrb size={34} id="chatTitleOrb" />
            <Text style={styles.title}>{t("chatTitle")}</Text>
          </View>
          <View style={styles.topRowRight}>
            <Pressable onPress={() => uid && clearChat(uid)}>
              <Text style={styles.clearLink}>{t("chatClear")}</Text>
            </Pressable>
            <Pressable onPress={() => navigation.goBack()} style={styles.closeButton}>
              <Icon name="x" size={22} color={colors.text} />
            </Pressable>
          </View>
        </View>

        {messages.length === 0 ? (
          <ScrollView contentContainerStyle={styles.welcome}>
            <Floating style={styles.orb}>
              <GlassOrb size={88} id="chatWelcomeOrb" />
            </Floating>
            <Text style={styles.greeting}>{t("chatGreeting", { name: firstName })}</Text>
            <Text style={styles.headline}>
              {t("chatHeadlineA")} <Text style={styles.headlineBold}>{t("chatHeadlineB")}</Text>
              {t("chatHeadlineC")}
            </Text>
            <View style={styles.starters}>
              {STARTERS.map((s) => (
                <Pressable
                  key={s.key}
                  onPress={() => handleSend(t(s.key))}
                  style={({ pressed }) => [styles.starter, pressed && styles.starterPressed]}
                >
                  <Icon name={s.icon} size={20} color={colors.primary} />
                  <Text style={styles.starterText}>{t(s.key)}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => <Bubble message={item} />}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        {pendingRequestId && !offline && (
          <View style={styles.typingRow}>
            <Text style={styles.typingText}>{t("chatThinking")}</Text>
          </View>
        )}
        {offline && (
          <View style={styles.offlineRow}>
            <Text style={styles.offlineText}>{t("chatOffline")}</Text>
          </View>
        )}

        <View style={styles.inputRow}>
          <View style={{ flex: 1 }}>
            <TextField label="" placeholder={t("chatPlaceholder")} value={input} onChangeText={setInput} />
          </View>
          <Button label={t("chatSend")} onPress={() => handleSend()} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const isUser = message.role === "user";
  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <Text style={[styles.bubbleText, isUser && { color: "#FFFFFF" }]}>{message.text}</Text>
      </View>
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    topRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: spacing.md,
      paddingBottom: spacing.sm,
    },
    topRowRight: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    closeButton: { padding: spacing.xs },
    titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexShrink: 1 },
    title: { color: colors.text, fontSize: 22, fontFamily: fonts.headingMedium },
    clearLink: { color: colors.textMuted, fontSize: 13 },
    welcome: { flexGrow: 1, justifyContent: "center", padding: spacing.md, gap: spacing.sm },
    orb: {
      alignSelf: "center",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.sm,
    },
    greeting: { color: colors.textMuted, fontSize: 13, textAlign: "center" },
    headline: {
      color: colors.text,
      fontSize: 30,
      lineHeight: 36,
      fontFamily: fonts.heading,
      textAlign: "center",
      marginBottom: spacing.md,
    },
    headlineBold: { fontFamily: fonts.headingMedium },
    starters: { gap: spacing.sm },
    starter: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: 22,
      paddingVertical: spacing.md + 2,
      paddingHorizontal: spacing.md + 2,
    },
    starterPressed: { backgroundColor: colors.surfaceAlt },
    starterText: { color: colors.text, fontSize: 15, fontFamily: fonts.bodyMedium, flex: 1 },
    list: { padding: spacing.md, gap: spacing.sm },
    bubbleRow: { flexDirection: "row" },
    bubbleRowUser: { justifyContent: "flex-end" },
    bubbleRowAssistant: { justifyContent: "flex-start" },
    bubble: { maxWidth: "80%", padding: spacing.sm, borderRadius: 14 },
    bubbleUser: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
    bubbleAssistant: { backgroundColor: colors.surface, borderBottomLeftRadius: 4 },
    bubbleText: { color: colors.text, fontSize: 14, lineHeight: 20 },
    typingRow: { paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
    typingText: { color: colors.textMuted, fontSize: 12, fontStyle: "italic" },
    offlineRow: {
      marginHorizontal: spacing.md,
      marginBottom: spacing.xs,
      padding: spacing.sm,
      borderRadius: 10,
      backgroundColor: colors.danger + "22",
    },
    offlineText: { color: colors.danger, fontSize: 12 },
    inputRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: spacing.sm,
      padding: spacing.md,
      paddingTop: 0,
    },
  });
}
