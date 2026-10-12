import React, { useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import { useAuth } from "../lib/authContext";
import { ChatMessage, clearChat, sendChatMessage, useChatMessages, usePendingTimeout } from "../lib/chat";
import { useI18n } from "../lib/i18n";
import { Colors, fonts, radius, spacing } from "../lib/theme";
import { useColors } from "../lib/themeContext";

export function ChatScreen() {
  const { user } = useAuth();
  const { t, language } = useI18n();
  const colors = useColors();
  const styles = makeStyles(colors);
  const uid = user?.uid ?? null;
  const { messages, pendingRequestId } = useChatMessages(uid);
  const offline = usePendingTimeout(pendingRequestId);
  const [input, setInput] = useState("");
  const listRef = useRef<FlatList>(null);

  const defaultChips = [t("chatSuggestion1"), t("chatSuggestion2"), t("chatSuggestion3"), t("chatSuggestion4")];
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const chips = lastAssistant?.suggestions?.length ? lastAssistant.suggestions : defaultChips;

  function handleSend(text?: string) {
    const toSend = (text ?? input).trim();
    if (!uid || !toSend) return;
    sendChatMessage(uid, toSend, language);
    setInput("");
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.topRow}>
          <Text style={styles.title}>{t("chatTitle")}</Text>
          <Pressable onPress={() => uid && clearChat(uid)}>
            <Text style={styles.clearLink}>{t("chatClear")}</Text>
          </Pressable>
        </View>

        {messages.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>{t("chatEmpty")}</Text>
          </View>
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

        <FlatList
          data={chips}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(c) => c}
          contentContainerStyle={styles.chipsRow}
          renderItem={({ item }) => (
            <Pressable style={styles.chip} onPress={() => handleSend(item)}>
              <Text style={styles.chipText}>{item}</Text>
            </Pressable>
          )}
        />

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
    title: { color: colors.text, fontSize: 22, fontFamily: fonts.heading },
    clearLink: { color: colors.textMuted, fontSize: 13 },
    emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
    emptyText: { color: colors.textMuted, fontSize: 14, textAlign: "center" },
    list: { padding: spacing.md, gap: spacing.sm },
    bubbleRow: { flexDirection: "row" },
    bubbleRowUser: { justifyContent: "flex-end" },
    bubbleRowAssistant: { justifyContent: "flex-start" },
    bubble: { maxWidth: "80%", padding: spacing.sm, borderRadius: radius.md },
    bubbleUser: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
    bubbleAssistant: { backgroundColor: colors.surface, borderBottomLeftRadius: 4 },
    bubbleText: { color: colors.text, fontSize: 14, lineHeight: 20 },
    typingRow: { paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
    typingText: { color: colors.textMuted, fontSize: 12, fontStyle: "italic" },
    offlineRow: {
      marginHorizontal: spacing.md,
      marginBottom: spacing.xs,
      padding: spacing.sm,
      borderRadius: radius.sm,
      backgroundColor: colors.danger + "22",
    },
    offlineText: { color: colors.danger, fontSize: 12 },
    chipsRow: { paddingHorizontal: spacing.md, gap: spacing.xs, paddingBottom: spacing.sm },
    chip: {
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      marginRight: spacing.xs,
    },
    chipText: { color: colors.text, fontSize: 12 },
    inputRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: spacing.sm,
      padding: spacing.md,
      paddingTop: 0,
    },
  });
}
