import React, { useState, useEffect } from "react";

interface TurnTimerProps {
  /** Deadline timestamp (ms since epoch) for the current turn. */
  deadline: number | undefined;
  /** Total turn timer duration in seconds (0 = disabled). */
  turnTimerSeconds: number;
}

/**
 * Displays a countdown timer for the current turn.
 * Changes color based on remaining time:
 * - Normal (> 30s): white
 * - Warning (10-30s): amber
 * - Critical (< 10s): red with pulse animation
 */
export default function TurnTimer({ deadline, turnTimerSeconds }: TurnTimerProps) {
  const [remainingMs, setRemainingMs] = useState<number>(0);

  useEffect(() => {
    if (!deadline || turnTimerSeconds <= 0) return;

    const update = () => {
      const now = Date.now();
      setRemainingMs(Math.max(0, deadline - now));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [deadline, turnTimerSeconds]);

  if (!deadline || turnTimerSeconds <= 0) {
    return null;
  }

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const display = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  const isWarning = totalSeconds <= 30 && totalSeconds > 10;
  const isCritical = totalSeconds <= 10;

  let colorClass = "text-white";
  if (isCritical) {
    colorClass = "text-red-400 animate-pulse";
  } else if (isWarning) {
    colorClass = "text-amber-400";
  }

  return (
    <div
      data-testid="turn-timer"
      className={`text-center ${colorClass}`}
    >
      <div className="text-xs uppercase tracking-wider text-gray-300 mb-1">
        Timer
      </div>
      <div className="text-2xl font-bold font-mono tabular-nums">
        {display}
      </div>
    </div>
  );
}
