import { useNavigation } from "@react-navigation/native";
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
import { Icon } from "../components/Icon";
import { TextField } from "../components/TextField";
import { useAuth } from "../lib/authContext";
import { ChatMessage, clearChat, sendChatMessage, useChatMessages, usePendingTimeout } from "../lib/chat";
import { useI18n } from "../lib/i18n";
import { Colors, fonts, spacing } from "../lib/theme";
import { useColors } from "../lib/themeContext";

export function ChatScreen() {
  const { user } = useAuth();
  const { t, language } = useI18n();
  const colors = useColors();
  const styles = makeStyles(colors);
  const navigation = useNavigation();
  const uid = user?.uid ?? null;
  const { messages, pendingRequestId } = useChatMessages(uid);
  const offline = usePendingTimeout(pendingRequestId);
  const [input, setInput] = useState("");
  const listRef = useRef<FlatList>(null);

  const defaultQuestions = [t("chatSuggestion1"), t("chatSuggestion2"), t("chatSuggestion3")];
  const lastMessage = messages[messages.length - 1];
  const waitingForReply = lastMessage?.role === "user";
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  // Starter questions show before the first message; once a question is
  // sent they disappear until the reply brings its own follow-ups, instead
  // of staying on screen (and being tappable) while a reply is pending.
  const questions =
    messages.length === 0
      ? defaultQuestions
      : !waitingForReply && lastAssistant?.suggestions?.length
        ? lastAssistant.suggestions
        : [];

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

        {questions.length > 0 && (
        <View style={styles.questionsList}>
          {questions.slice(0, 3).map((q) => (
            <Pressable
              key={q}
              onPress={() => handleSend(q)}
              hitSlop={6}
              style={({ pressed }) => [styles.questionPill, pressed && styles.questionPillPressed]}
            >
              <Text style={styles.questionText} numberOfLines={2}>
                {q}
              </Text>
            </Pressable>
          ))}
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
    title: { color: colors.text, fontSize: 22, fontFamily: fonts.heading },
    clearLink: { color: colors.textMuted, fontSize: 13 },
    emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
    emptyText: { color: colors.textMuted, fontSize: 14, textAlign: "center" },
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
    // Each question is its own pill with real spacing between them, so a
    // tap can't land on the wrong one.
    questionsList: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.xs },
    questionPill: {
      alignSelf: "flex-start",
      maxWidth: "90%",
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    questionPillPressed: { backgroundColor: colors.border },
    questionText: { color: colors.text, fontSize: 14 },
    inputRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: spacing.sm,
      padding: spacing.md,
      paddingTop: 0,
    },
  });
}
