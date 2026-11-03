import { useRef, useState, useCallback, useEffect } from 'react';
import { RTCPeerConnection } from 'react-native-webrtc';

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'me' | 'peer';
  timestamp: number;
}

interface UseDataChannelReturn {
  messages: ChatMessage[];
  sendMessage: (text: string) => void;
  isChannelOpen: boolean;
}

/**
 * Manages a WebRTC DataChannel for in-session text chat.
 *
 * - On the OFFERING side (Broadcaster): call `createChannel()` after creating the peer connection.
 * - On the ANSWERING side (Helper): the channel is received via `ondatachannel`.
 *
 * Usage:
 *   const { messages, sendMessage, isChannelOpen } = useDataChannel();
 *   // After creating peer connection:
 *   setupDataChannel(peerConnection, 'broadcaster' | 'helper');
 */
export function useDataChannel(): UseDataChannelReturn & {
  setupDataChannel: (pc: RTCPeerConnection, role: 'broadcaster' | 'helper') => void;
} {
  const channelRef = useRef<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isChannelOpen, setIsChannelOpen] = useState(false);

  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.data);
      const msg: ChatMessage = {
        id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        text: data.text,
        sender: 'peer',
        timestamp: data.timestamp || Date.now(),
      };
      setMessages((prev) => [...prev, msg]);
    } catch (e) {
      console.error('[DataChannel] Failed to parse message:', e);
    }
  }, []);

  const attachListeners = useCallback(
    (channel: any) => {
      channelRef.current = channel;

      channel.onopen = () => {
        console.log('[DataChannel] Channel opened');
        setIsChannelOpen(true);
      };

      channel.onclose = () => {
        console.log('[DataChannel] Channel closed');
        setIsChannelOpen(false);
      };

      channel.onmessage = handleMessage;
    },
    [handleMessage],
  );

  const setupDataChannel = useCallback(
    (pc: RTCPeerConnection, role: 'broadcaster' | 'helper') => {
      if (role === 'broadcaster') {
        // Broadcaster creates the data channel
        const channel = (pc as any).createDataChannel('chat', {
          ordered: true,
        });
        attachListeners(channel);
      } else {
        // Helper receives the data channel
        (pc as any).ondatachannel = (event: any) => {
          const channel = event.channel;
          attachListeners(channel);
        };
      }
    },
    [attachListeners],
  );

  const sendMessage = useCallback(
    (text: string) => {
      if (!channelRef.current || !isChannelOpen) return;

      const payload = {
        text,
        timestamp: Date.now(),
      };

      try {
        channelRef.current.send(JSON.stringify(payload));

        const msg: ChatMessage = {
          id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
          text,
          sender: 'me',
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, msg]);
      } catch (e) {
        console.error('[DataChannel] Failed to send message:', e);
      }
    },
    [isChannelOpen],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        try {
          channelRef.current.close();
        } catch {}
      }
    };
  }, []);

  return { messages, sendMessage, isChannelOpen, setupDataChannel };
}
