"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@bb/ui";

interface UseTurnNotificationOptions {
  isMyTurn: boolean;
  isActiveMatch: boolean;
}

/**
 * Plays a short notification chime using the Web Audio API.
 * Two ascending tones to signal "it's your turn".
 */
function playTurnSound(): void {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // First tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Second tone
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(659.25, now + 0.15); // E5
    osc2.frequency.exponentialRampToValueAtTime(783.99, now + 0.3); // G5
    gain2.gain.setValueAtTime(0.3, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.45);
  } catch {
    // AudioContext may not be available in all environments
  }
}

/**
 * Hook that notifies the player when it becomes their turn.
 *
 * Combines three notification channels:
 * 1. In-app toast (via existing ToastProvider)
 * 2. Browser Notification API (if permission granted)
 * 3. Audio chime (Web Audio API)
 *
 * Also manages the browser tab title to reflect turn status.
 */
export function useTurnNotification({
  isMyTurn,
  isActiveMatch,
}: UseTurnNotificationOptions): void {
  const prevIsMyTurn = useRef(false);

  // Request browser notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const { addToast } = useToast();

  useEffect(() => {
    if (isMyTurn && !prevIsMyTurn.current && isActiveMatch) {
      // Update tab title
      document.title = "Votre tour ! — Nuffle Arena";

      // In-app toast notification
      addToast({
        type: "info",
        title: "C'est votre tour !",
        message: "A vous de jouer. Choisissez votre action.",
        duration: 5000,
      });

      // Browser notification
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Nuffle Arena", {
          body: "C'est votre tour de jouer !",
          icon: "/favicon.ico",
        });
      }

      // Audio chime
      playTurnSound();
    } else if (!isMyTurn && isActiveMatch) {
      document.title = "En attente... — Nuffle Arena";
    } else if (!isActiveMatch) {
      document.title = "Nuffle Arena";
    }

    prevIsMyTurn.current = isMyTurn;
  }, [isMyTurn, isActiveMatch, addToast]);
}
