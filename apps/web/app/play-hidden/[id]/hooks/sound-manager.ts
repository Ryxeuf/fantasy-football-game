"use client";

/**
 * SoundManager — Web Audio API synthesizer for Blood Bowl game events.
 * Produces short procedural sounds without any audio file dependencies.
 */

export type SoundEffect =
  | "dice-roll"
  | "block-pow"
  | "block-push"
  | "block-both-down"
  | "block-stumble"
  | "injury-stun"
  | "injury-ko"
  | "injury-casualty"
  | "touchdown"
  | "turnover"
  | "kickoff"
  | "dodge-success"
  | "catch-success"
  | "pass"
  | "crowd-roar";

const STORAGE_KEY = "nuffle-arena-sound-muted";

function getStoredMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function setStoredMuted(muted: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(muted));
  } catch {
    // localStorage may not be available
  }
}

export interface SoundManagerInstance {
  play(effect: SoundEffect): void;
  isMuted(): boolean;
  setMuted(muted: boolean): void;
  toggleMuted(): boolean;
}

export function createSoundManager(): SoundManagerInstance {
  let muted = getStoredMuted();
  let ctx: AudioContext | null = null;

  function getContext(): AudioContext | null {
    try {
      if (!ctx || ctx.state === "closed") {
        ctx = new AudioContext();
      }
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      return ctx;
    } catch {
      return null;
    }
  }

  function playTone(
    frequency: number,
    duration: number,
    type: OscillatorType = "sine",
    volume: number = 0.2,
    delay: number = 0,
  ): void {
    const audioCtx = getContext();
    if (!audioCtx) return;
    const now = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  function playRamp(
    startFreq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType = "sine",
    volume: number = 0.2,
    delay: number = 0,
  ): void {
    const audioCtx = getContext();
    if (!audioCtx) return;
    const now = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  function playNoise(duration: number, volume: number = 0.1, delay: number = 0): void {
    const audioCtx = getContext();
    if (!audioCtx) return;
    const now = audioCtx.currentTime + delay;
    const bufferSize = Math.ceil(audioCtx.sampleRate * duration);
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * volume;
    }
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(gain);
    gain.connect(audioCtx.destination);
    source.start(now);
    source.stop(now + duration);
  }

  const effects: Record<SoundEffect, () => void> = {
    "dice-roll": () => {
      // Rapid clicking tones to simulate dice
      for (let i = 0; i < 4; i++) {
        playTone(800 + Math.random() * 600, 0.05, "square", 0.08, i * 0.06);
      }
    },
    "block-pow": () => {
      // Heavy impact
      playTone(120, 0.2, "sawtooth", 0.25);
      playNoise(0.15, 0.15);
    },
    "block-push": () => {
      // Medium push sound
      playRamp(300, 150, 0.15, "triangle", 0.15);
    },
    "block-both-down": () => {
      // Two falling tones
      playRamp(400, 100, 0.2, "sawtooth", 0.15);
      playRamp(350, 80, 0.2, "sawtooth", 0.12, 0.05);
    },
    "block-stumble": () => {
      // Stumble wobble
      playRamp(500, 200, 0.2, "triangle", 0.12);
    },
    "injury-stun": () => {
      // Short thud
      playTone(180, 0.15, "triangle", 0.15);
    },
    "injury-ko": () => {
      // Descending tone
      playRamp(400, 100, 0.3, "sawtooth", 0.2);
      playNoise(0.1, 0.08, 0.1);
    },
    "injury-casualty": () => {
      // Dramatic low crash
      playRamp(300, 60, 0.5, "sawtooth", 0.25);
      playNoise(0.3, 0.15);
    },
    "touchdown": () => {
      // Triumphant ascending fanfare
      playTone(523.25, 0.15, "square", 0.15);       // C5
      playTone(659.25, 0.15, "square", 0.15, 0.15);  // E5
      playTone(783.99, 0.15, "square", 0.15, 0.3);   // G5
      playTone(1046.5, 0.3, "square", 0.2, 0.45);    // C6
    },
    turnover: () => {
      // Descending whistle
      playRamp(800, 300, 0.3, "sine", 0.2);
    },
    kickoff: () => {
      // Whistle sound
      playTone(880, 0.1, "sine", 0.15);
      playTone(1100, 0.3, "sine", 0.2, 0.12);
    },
    "dodge-success": () => {
      // Quick ascending pip
      playRamp(400, 800, 0.1, "sine", 0.1);
    },
    "catch-success": () => {
      // Soft catch pop
      playTone(600, 0.08, "sine", 0.1);
      playTone(900, 0.1, "sine", 0.12, 0.08);
    },
    pass: () => {
      // Swoosh
      playRamp(300, 900, 0.2, "sine", 0.08);
    },
    "crowd-roar": () => {
      // Short noise burst
      playNoise(0.4, 0.12);
    },
  };

  return {
    play(effect: SoundEffect): void {
      if (muted) return;
      const fn = effects[effect];
      if (fn) {
        try {
          fn();
        } catch {
          // Gracefully ignore audio errors
        }
      }
    },
    isMuted(): boolean {
      return muted;
    },
    setMuted(value: boolean): void {
      muted = value;
      setStoredMuted(value);
    },
    toggleMuted(): boolean {
      muted = !muted;
      setStoredMuted(muted);
      return muted;
    },
  };
}

// Singleton for client-side usage
let instance: SoundManagerInstance | null = null;

export function getSoundManager(): SoundManagerInstance {
  if (!instance) {
    instance = createSoundManager();
  }
  return instance;
}
