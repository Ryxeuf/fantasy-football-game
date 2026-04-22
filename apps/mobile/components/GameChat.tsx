import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  type ListRenderItemInfo,
} from "react-native";
import type { ChatAck, ChatMessage } from "../lib/game-chat";
import { MAX_MESSAGE_LENGTH } from "../lib/game-chat";
import { gameChatStyles as styles } from "./GameChat.styles";

export interface GameChatProps {
  messages: ChatMessage[];
  sendMessage: (text: string) => Promise<ChatAck>;
  currentUserId?: string;
}

/**
 * Collapsible in-game chat for mobile.
 * Toggle button fixed bottom-left; panel opens in a modal with keyboard avoidance.
 */
export default function GameChat({
  messages,
  sendMessage,
  currentUserId,
}: GameChatProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const listRef = useRef<FlatList<ChatMessage> | null>(null);
  const prevCountRef = useRef(messages.length);

  useEffect(() => {
    if (!open && messages.length > prevCountRef.current) {
      setUnreadCount((c) => c + (messages.length - prevCountRef.current));
    }
    prevCountRef.current = messages.length;
  }, [messages.length, open]);

  useEffect(() => {
    if (open) {
      setUnreadCount(0);
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [open, messages.length]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setError(null);

    const result = await sendMessage(trimmed);

    setSending(false);
    if (result.ok) {
      setInput("");
    } else {
      setError(result.error ?? "Failed to send");
    }
  }, [input, sending, sendMessage]);

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<ChatMessage>) => {
      const isMe = Boolean(currentUserId) && item.userId === currentUserId;
      return (
        <View
          style={[
            styles.messageRow,
            isMe ? styles.messageRowMe : styles.messageRowOther,
          ]}
          testID={`chat-message-${index}`}
        >
          <View
            style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}
          >
            <Text
              style={[
                styles.bubbleText,
                isMe ? styles.bubbleTextMe : styles.bubbleTextOther,
              ]}
            >
              {item.message}
            </Text>
          </View>
          <Text style={styles.timestamp}>
            {new Date(item.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
      );
    },
    [currentUserId],
  );

  const keyExtractor = useCallback(
    (item: ChatMessage, index: number) => `${item.timestamp}-${index}`,
    [],
  );

  const inputDisabled = sending || input.trim().length === 0;

  return (
    <>
      <Pressable
        testID="chat-toggle"
        accessibilityLabel="Ouvrir le chat"
        onPress={() => setOpen(true)}
        style={styles.toggle}
      >
        <Text style={styles.toggleIcon}>💬</Text>
        {unreadCount > 0 && (
          <View style={styles.badge} testID="chat-unread-badge">
            <Text style={styles.badgeText}>
              {unreadCount > 9 ? "9+" : String(unreadCount)}
            </Text>
          </View>
        )}
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.backdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.panel}
          >
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Chat</Text>
              <Pressable
                testID="chat-close"
                accessibilityLabel="Fermer le chat"
                onPress={() => setOpen(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeText}>Fermer</Text>
              </Pressable>
            </View>

            {messages.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  Aucun message. Dites bonjour !
                </Text>
              </View>
            ) : (
              <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                style={styles.list}
                contentContainerStyle={styles.listContent}
                onContentSizeChange={() =>
                  listRef.current?.scrollToEnd({ animated: false })
                }
                testID="chat-messages"
              />
            )}

            {error && (
              <View style={styles.errorBar}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.inputRow}>
              <TextInput
                testID="chat-input"
                value={input}
                onChangeText={setInput}
                placeholder="Message..."
                placeholderTextColor="#9CA3AF"
                maxLength={MAX_MESSAGE_LENGTH}
                editable={!sending}
                style={styles.input}
                returnKeyType="send"
                onSubmitEditing={handleSend}
                blurOnSubmit={false}
              />
              <Pressable
                testID="chat-send"
                onPress={handleSend}
                disabled={inputDisabled}
                style={[
                  styles.sendButton,
                  inputDisabled && styles.sendButtonDisabled,
                ]}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.sendText}>Envoyer</Text>
                )}
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}
