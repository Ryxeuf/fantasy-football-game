import { useState, useCallback, useEffect, useRef } from 'react';
import type { ReplayFrame } from '@bb/game-engine';

const DEFAULT_SPEED_MS = 1000;

export interface ReplayControls {
  currentIndex: number;
  currentFrame: ReplayFrame | null;
  totalFrames: number;
  isPlaying: boolean;
  speed: number;
  play: () => void;
  pause: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  goToFrame: (index: number) => void;
  goToStart: () => void;
  goToEnd: () => void;
  setSpeed: (ms: number) => void;
}

export function useReplayControls(frames: ReplayFrame[]): ReplayControls {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeedState] = useState(DEFAULT_SPEED_MS);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const framesRef = useRef(frames);
  framesRef.current = frames;

  const indexRef = useRef(currentIndex);
  indexRef.current = currentIndex;

  const clamp = useCallback(
    (idx: number) => Math.max(0, Math.min(idx, frames.length - 1)),
    [frames.length],
  );

  const stopInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const stepForward = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = prev + 1;
      return next < framesRef.current.length ? next : prev;
    });
  }, []);

  const stepBackward = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : 0));
  }, []);

  const goToFrame = useCallback(
    (index: number) => {
      if (frames.length === 0) return;
      setCurrentIndex(clamp(index));
    },
    [clamp, frames.length],
  );

  const goToStart = useCallback(() => {
    setCurrentIndex(0);
  }, []);

  const goToEnd = useCallback(() => {
    if (frames.length === 0) return;
    setCurrentIndex(frames.length - 1);
  }, [frames.length]);

  const pause = useCallback(() => {
    setIsPlaying(false);
    stopInterval();
  }, [stopInterval]);

  const play = useCallback(() => {
    if (frames.length === 0) return;
    setIsPlaying(true);
  }, [frames.length]);

  const setSpeed = useCallback((ms: number) => {
    setSpeedState(ms);
  }, []);

  // Auto-advance effect
  useEffect(() => {
    if (!isPlaying) {
      stopInterval();
      return;
    }

    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = prev + 1;
        if (next >= framesRef.current.length) {
          // Reached the end — stop playing
          setIsPlaying(false);
          return prev;
        }
        return next;
      });
    }, speed);

    return () => {
      stopInterval();
    };
  }, [isPlaying, speed, stopInterval]);

  const currentFrame = frames.length > 0 ? frames[currentIndex] ?? null : null;

  return {
    currentIndex,
    currentFrame,
    totalFrames: frames.length,
    isPlaying,
    speed,
    play,
    pause,
    stepForward,
    stepBackward,
    goToFrame,
    goToStart,
    goToEnd,
    setSpeed,
  };
}
