import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { ChatMessage } from '../hooks/useDataChannel';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  unreadCount: number;
  isChannelOpen: boolean;
}

/**
 * Floating chat overlay that sits on top of the stream view.
 * Shows a minimized FAB with unread count, expands to a bottom-sheet chat.
 */
export default function ChatOverlay({
  messages,
  onSend,
  isOpen,
  onToggle,
  unreadCount,
  isChannelOpen,
}: Props) {
  const [inputText, setInputText] = useState('');
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isOpen ? 0 : SCREEN_HEIGHT,
      friction: 8,
      tension: 65,
      useNativeDriver: true,
    }).start();
  }, [isOpen, slideAnim]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, isOpen]);

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInputText('');
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <View
      style={[
        styles.messageBubble,
        item.sender === 'me' ? styles.myMessage : styles.peerMessage,
      ]}
    >
      <Text style={[styles.messageText, item.sender === 'me' && styles.myMessageText]}>
        {item.text}
      </Text>
      <Text style={[styles.timeText, item.sender === 'me' && styles.myTimeText]}>
        {formatTime(item.timestamp)}
      </Text>
    </View>
  );

  return (
    <>
      {/* FAB Toggle Button */}
      {!isOpen && (
        <TouchableOpacity
          style={styles.fab}
          onPress={onToggle}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Open chat${unreadCount > 0 ? `, ${unreadCount} unread messages` : ''}`}
        >
          <Icon name="chat" size={24} color="#FFF" />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Chat Overlay */}
      <Animated.View
        style={[styles.overlay, { transform: [{ translateY: slideAnim }] }]}
        pointerEvents={isOpen ? 'auto' : 'none'}
      >
        <KeyboardAvoidingView
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Icon name="chat" size={20} color="#FFF" />
              <Text style={styles.headerTitle}>Session Chat</Text>
              {!isChannelOpen && (
                <View style={styles.offlineDot} />
              )}
            </View>
            <TouchableOpacity
              onPress={onToggle}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close chat"
            >
              <Icon name="chevron-down" size={28} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            style={styles.messageList}
            contentContainerStyle={styles.messageListContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Icon name="chat-outline" size={48} color="rgba(255,255,255,0.3)" />
                <Text style={styles.emptyText}>
                  {isChannelOpen
                    ? 'Send a message to start chatting'
                    : 'Waiting for connection...'}
                </Text>
              </View>
            }
          />

          {/* Input */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={isChannelOpen ? 'Type a message...' : 'Connecting...'}
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              editable={isChannelOpen}
              accessibilityLabel="Chat message input"
            />
            <TouchableOpacity
              style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!inputText.trim() || !isChannelOpen}
              accessibilityRole="button"
              accessibilityLabel="Send message"
            >
              <Icon name="send" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 110,
    left: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 60,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.55,
    zIndex: 70,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  offlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF9500',
    marginLeft: 8,
  },
  closeButton: {
    padding: 4,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    marginBottom: 8,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  peerMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#FFF',
  },
  timeText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  myTimeText: {
    color: 'rgba(255,255,255,0.7)',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    marginTop: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: '#FFF',
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    marginRight: 10,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});
