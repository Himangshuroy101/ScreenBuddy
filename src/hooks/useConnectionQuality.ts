import { useEffect, useRef, useState, useCallback } from 'react';
import { RTCPeerConnection } from 'react-native-webrtc';

export type QualityLevel = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';

export interface ConnectionStats {
  bitrate: number;       // kbps
  packetLoss: number;    // percentage
  roundTripTime: number; // ms
  jitter: number;        // ms
  qualityLevel: QualityLevel;
}

const DEFAULT_STATS: ConnectionStats = {
  bitrate: 0,
  packetLoss: 0,
  roundTripTime: 0,
  jitter: 0,
  qualityLevel: 'unknown',
};

function calculateQuality(stats: ConnectionStats): QualityLevel {
  if (stats.bitrate === 0) return 'unknown';
  if (stats.bitrate > 1000 && stats.packetLoss < 1 && stats.roundTripTime < 100) return 'excellent';
  if (stats.bitrate > 500 && stats.packetLoss < 3 && stats.roundTripTime < 200) return 'good';
  if (stats.bitrate > 200 && stats.packetLoss < 8 && stats.roundTripTime < 400) return 'fair';
  return 'poor';
}

/**
 * Polls RTCPeerConnection.getStats() every 2 seconds and extracts
 * bitrate, packet loss, RTT, and jitter info.
 */
export function useConnectionQuality(
  peerConnection: RTCPeerConnection | null,
  isActive: boolean,
): ConnectionStats {
  const [stats, setStats] = useState<ConnectionStats>(DEFAULT_STATS);
  const prevBytesRef = useRef<number>(0);
  const prevTimestampRef = useRef<number>(0);

  useEffect(() => {
    if (!peerConnection || !isActive) {
      setStats(DEFAULT_STATS);
      prevBytesRef.current = 0;
      prevTimestampRef.current = 0;
      return;
    }

    const interval = setInterval(async () => {
      try {
        const report = await (peerConnection as any).getStats();
        let totalBytesSent = 0;
        let packetLoss = 0;
        let rtt = 0;
        let jitter = 0;
        let hasVideoStats = false;

        report.forEach((entry: any) => {
          // Video outbound (Broadcaster) or inbound (Helper)
          if (entry.type === 'outbound-rtp' && entry.kind === 'video') {
            totalBytesSent = entry.bytesSent || 0;
            hasVideoStats = true;
          }
          if (entry.type === 'inbound-rtp' && entry.kind === 'video') {
            totalBytesSent = entry.bytesReceived || 0;
            jitter = (entry.jitter || 0) * 1000; // Convert to ms
            hasVideoStats = true;
            if (entry.packetsLost && entry.packetsReceived) {
              const total = entry.packetsLost + entry.packetsReceived;
              packetLoss = total > 0 ? (entry.packetsLost / total) * 100 : 0;
            }
          }
          if (entry.type === 'candidate-pair' && entry.state === 'succeeded') {
            rtt = (entry.currentRoundTripTime || 0) * 1000; // Convert to ms
          }
          // Fallback for remote-inbound-rtp
          if (entry.type === 'remote-inbound-rtp' && entry.kind === 'video') {
            if (entry.roundTripTime) {
              rtt = entry.roundTripTime * 1000;
            }
            if (entry.fractionLost) {
              packetLoss = entry.fractionLost * 100;
            }
          }
        });

        // Calculate bitrate
        let bitrate = 0;
        const now = Date.now();
        if (prevBytesRef.current > 0 && prevTimestampRef.current > 0) {
          const byteDiff = totalBytesSent - prevBytesRef.current;
          const timeDiff = (now - prevTimestampRef.current) / 1000; // seconds
          if (timeDiff > 0) {
            bitrate = (byteDiff * 8) / timeDiff / 1000; // kbps
          }
        }
        prevBytesRef.current = totalBytesSent;
        prevTimestampRef.current = now;

        const newStats: ConnectionStats = {
          bitrate: Math.round(bitrate),
          packetLoss: Math.round(packetLoss * 10) / 10,
          roundTripTime: Math.round(rtt),
          jitter: Math.round(jitter),
          qualityLevel: 'unknown',
        };
        newStats.qualityLevel = calculateQuality(newStats);

        setStats(newStats);
      } catch (e) {
        // getStats() can fail if connection is closing
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [peerConnection, isActive]);

  return stats;
}
