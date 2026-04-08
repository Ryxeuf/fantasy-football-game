"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { API_BASE } from "../../auth-client";

interface UseMatchmakingSocketOptions {
  searching: boolean;
  onMatchFound: (matchId: string) => void;
  onNotify?: (title: string, message: string) => void;
}

interface MatchFoundPayload {
  matchId: string;
}

/**
 * Plays a celebratory sound when a match is found.
 * Three ascending tones (fanfare-style) to signal match found.
 */
export function playMatchFoundSound(): void {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // First tone — C5
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.2);

    // Second tone — E5
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(659.25, now + 0.15);
    gain2.gain.setValueAtTime(0.3, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.35);

    // Third tone — G5
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = "sine";
    osc3.frequency.setValueAtTime(783.99, now + 0.3);
    gain3.gain.setValueAtTime(0.35, now + 0.3);
    gain3.gain.exponentialRampToValueAtTime(0.01, now + 0.55);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.3);
    osc3.stop(now + 0.55);
  } catch {
    // AudioContext may not be available in all environments
  }
}

/**
 * Hook that connects to the /game WebSocket namespace while the user is
 * in the matchmaking queue, and listens for the `matchmaking:found` event.
 *
 * When a match is found, it:
 * 1. Calls the `onMatchFound` callback with the matchId
 * 2. Shows an in-app toast notification
 * 3. Shows a browser notification (if permission granted)
 * 4. Plays a celebratory sound
 */
export function useMatchmakingSocket({
  searching,
  onMatchFound,
  onNotify,
}: UseMatchmakingSocketOptions): void {
  const onMatchFoundRef = useRef(onMatchFound);
  onMatchFoundRef.current = onMatchFound;

  const onNotifyRef = useRef(onNotify);
  onNotifyRef.current = onNotify;

  // Request browser notification permission
  useEffect(() => {
    if (
      searching &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission();
    }
  }, [searching]);

  useEffect(() => {
    if (!searching) return;

    const authToken = localStorage.getItem("auth_token");
    if (!authToken) return;

    const socket: Socket = io(`${API_BASE}/game`, {
      auth: { token: `Bearer ${authToken}` },
      transports: ["websocket", "polling"],
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: 15,
    });

    const handleMatchFound = (data: MatchFoundPayload) => {
      const title = "Match trouve !";
      const message = "Un adversaire a ete trouve. Redirection en cours...";

      // Optional toast callback
      onNotifyRef.current?.(title, message);

      // Browser notification
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Nuffle Arena", {
          body: "Match trouve ! Un adversaire vous attend.",
          icon: "/favicon.ico",
        });
      }

      // Sound
      playMatchFoundSound();

      // Callback
      onMatchFoundRef.current(data.matchId);
    };

    socket.on("matchmaking:found", handleMatchFound);
    socket.connect();

    return () => {
      socket.off("matchmaking:found");
      socket.disconnect();
    };
  }, [searching]);
}
