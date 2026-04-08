"use client";

import { useState, useEffect } from "react";

const FORFEIT_TIMEOUT_MS = 2 * 60 * 1000;

interface ForfeitWarningProps {
  /** Whether the opponent is currently disconnected. */
  opponentDisconnected: boolean;
  /** Timestamp (ms) when the opponent disconnected, or null. */
  disconnectedAt: number | null;
}

/**
 * Shows a warning banner with countdown when the opponent is disconnected.
 * After 2 minutes, the opponent will be forfeited automatically by the server.
 */
export function ForfeitWarning({ opponentDisconnected, disconnectedAt }: ForfeitWarningProps) {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  useEffect(() => {
    if (!opponentDisconnected || !disconnectedAt) {
      setRemainingSeconds(0);
      return;
    }

    function updateRemaining() {
      const elapsed = Date.now() - disconnectedAt!;
      const remaining = Math.max(0, Math.ceil((FORFEIT_TIMEOUT_MS - elapsed) / 1000));
      setRemainingSeconds(remaining);
    }

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [opponentDisconnected, disconnectedAt]);

  if (!opponentDisconnected || remainingSeconds <= 0) {
    return null;
  }

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeDisplay = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <div className="fixed top-12 left-0 right-0 z-[60] flex justify-center pointer-events-none">
      <div className="bg-orange-600 text-white px-6 py-3 rounded-b-lg shadow-lg flex items-center gap-3 pointer-events-auto animate-pulse">
        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <span className="font-semibold text-sm">
          Adversaire deconnecte — forfait dans {timeDisplay}
        </span>
      </div>
    </div>
  );
}
