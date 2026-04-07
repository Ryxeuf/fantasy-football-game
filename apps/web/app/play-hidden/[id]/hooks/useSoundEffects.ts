"use client";

import { useEffect, useRef } from "react";
import type { ExtendedGameState } from "@bb/game-engine";
import type { GameLogEntry } from "@bb/game-engine";
import { getSoundManager, type SoundEffect } from "./sound-manager";

/**
 * Maps a game log entry to a sound effect based on its type and message content.
 * Returns null if no sound should play for this entry.
 */
export function mapLogEntryToSound(entry: GameLogEntry): SoundEffect | null {
  const msg = entry.message.toLowerCase();

  // Score events
  if (entry.type === "score") {
    return "touchdown";
  }

  // Dice events
  if (entry.type === "dice") {
    // Block dice have specific sounds handled via action type
    if (msg.includes("block")) return "dice-roll";
    if (msg.includes("dodge") || msg.includes("esquive")) return "dice-roll";
    if (msg.includes("armure") || msg.includes("armor")) return "dice-roll";
    if (msg.includes("pickup") || msg.includes("ramassage")) return "dice-roll";
    return "dice-roll";
  }

  // Action events — injury outcomes
  if (entry.type === "action") {
    if (msg.includes("mort") || msg.includes("dead")) return "injury-casualty";
    if (msg.includes("casualty") || msg.includes("grave") || msg.includes("sérieuse") || msg.includes("lasting")) {
      return "injury-casualty";
    }
    if (msg.includes("ko")) return "injury-ko";
    if (msg.includes("sonné") || msg.includes("stunned") || msg.includes("stun")) return "injury-stun";
    // Block results
    if (msg.includes("pow") || msg.includes("défenseur à terre") || msg.includes("player down")) return "block-pow";
    if (msg.includes("repoussé") || msg.includes("push")) return "block-push";
    if (msg.includes("both down") || msg.includes("les deux à terre")) return "block-both-down";
    if (msg.includes("stumble") || msg.includes("trébuch")) return "block-stumble";
    // Pass / catch
    if (msg.includes("passe réussie") || msg.includes("pass")) return "pass";
    if (msg.includes("réception réussie") || msg.includes("catch")) return "catch-success";
    if (msg.includes("esquive réussie") || msg.includes("dodge")) return "dodge-success";
  }

  // Info events — kickoff
  if (entry.type === "info") {
    if (msg.includes("kickoff") || msg.includes("coup d'envoi") || msg.includes("engagement")) {
      return "kickoff";
    }
  }

  return null;
}

interface UseSoundEffectsOptions {
  state: ExtendedGameState | null;
  enabled?: boolean;
}

/**
 * Hook that watches gameLog changes and triggers corresponding sound effects.
 * Only plays sounds for NEW log entries added since the last render.
 */
export function useSoundEffects({ state, enabled = true }: UseSoundEffectsOptions): void {
  const prevLogLength = useRef<number>(0);
  const prevIsTurnover = useRef<boolean>(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (!state || !enabled) return;

    const currentLog = state.gameLog ?? [];

    // On first mount, just record current length without playing sounds
    if (!initialized.current) {
      prevLogLength.current = currentLog.length;
      prevIsTurnover.current = !!state.isTurnover;
      initialized.current = true;
      return;
    }

    const sm = getSoundManager();

    // Process only new log entries
    const newEntries = currentLog.slice(prevLogLength.current);
    if (newEntries.length > 0) {
      // Play only the most impactful sound from the batch to avoid cacophony
      let bestSound: SoundEffect | null = null;
      const priority: Record<string, number> = {
        touchdown: 10,
        "injury-casualty": 9,
        "injury-ko": 8,
        "injury-stun": 7,
        "block-pow": 6,
        "block-both-down": 5,
        "block-push": 4,
        "block-stumble": 3,
        kickoff: 6,
        pass: 2,
        "catch-success": 2,
        "dodge-success": 1,
        "dice-roll": 0,
        turnover: 8,
        "crowd-roar": 3,
      };

      let bestPriority = -1;
      for (const entry of newEntries) {
        const sound = mapLogEntryToSound(entry);
        if (sound && (priority[sound] ?? 0) > bestPriority) {
          bestSound = sound;
          bestPriority = priority[sound] ?? 0;
        }
      }

      if (bestSound) {
        sm.play(bestSound);
      }
    }

    // Detect turnover transition
    if (state.isTurnover && !prevIsTurnover.current) {
      sm.play("turnover");
    }

    prevLogLength.current = currentLog.length;
    prevIsTurnover.current = !!state.isTurnover;
  }, [state, enabled]);
}
