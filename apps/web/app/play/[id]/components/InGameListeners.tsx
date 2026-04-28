"use client";

/**
 * Composants d'ecoute / controles "in-game" sans logique metier (UI helpers).
 *
 * - `TurnNotificationListener` : declenche la notification "c'est ton tour"
 *   via `useTurnNotification` (hook). Ne rend rien.
 * - `SoundEffectsListener` : joue les SFX sur changement de gameLog via
 *   `useSoundEffects` (hook). Ne rend rien.
 * - `SoundToggleButton` : bouton flottant mute/unmute, UI pure cliente du
 *   `sound-manager`.
 *
 * Extraits de `play/[id]/page.tsx` dans le cadre du refactor S26.0b.
 */

import { useState, useCallback } from "react";
import { type ExtendedGameState } from "@bb/game-engine";
import { useTurnNotification } from "../hooks/useTurnNotification";
import { useSoundEffects } from "../hooks/useSoundEffects";
import { getSoundManager } from "../hooks/sound-manager";

interface TurnNotificationListenerProps {
  isMyTurn: boolean;
  isActiveMatch: boolean;
}

export function TurnNotificationListener({
  isMyTurn,
  isActiveMatch,
}: TurnNotificationListenerProps) {
  useTurnNotification({ isMyTurn, isActiveMatch });
  return null;
}

interface SoundEffectsListenerProps {
  state: ExtendedGameState | null;
}

export function SoundEffectsListener({ state }: SoundEffectsListenerProps) {
  useSoundEffects({ state });
  return null;
}

export function SoundToggleButton() {
  const [muted, setMuted] = useState(() => getSoundManager().isMuted());
  const handleToggle = useCallback(() => {
    const newMuted = getSoundManager().toggleMuted();
    setMuted(newMuted);
  }, []);
  return (
    <button
      onClick={handleToggle}
      className="fixed bottom-4 right-4 z-50 bg-gray-800 hover:bg-gray-700 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg transition-colors"
      title={muted ? "Activer le son" : "Couper le son"}
      aria-label={muted ? "Activer le son" : "Couper le son"}
    >
      {muted ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      )}
    </button>
  );
}
