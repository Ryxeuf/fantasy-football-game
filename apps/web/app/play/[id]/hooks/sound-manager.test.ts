import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createSoundManager, type SoundManagerInstance, type SoundEffect } from "./sound-manager";

function createMockAudioContext() {
  const mockOscillator = {
    type: "sine",
    frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const mockGain = {
    gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
  };
  const mockBufferSource = {
    buffer: null as AudioBuffer | null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const mockBuffer = {
    getChannelData: vi.fn(() => new Float32Array(4410)),
  };
  return {
    MockAudioContext: vi.fn().mockImplementation(() => ({
      createOscillator: vi.fn(() => ({ ...mockOscillator })),
      createGain: vi.fn(() => ({
        gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
      })),
      createBufferSource: vi.fn(() => ({ ...mockBufferSource })),
      createBuffer: vi.fn(() => mockBuffer),
      destination: {},
      currentTime: 0,
      sampleRate: 44100,
      state: "running" as AudioContextState,
      resume: vi.fn(),
    })),
    mockOscillator,
    mockGain,
  };
}

describe("SoundManager", () => {
  let originalAudioContext: typeof globalThis.AudioContext;
  let originalLocalStorage: Storage;

  beforeEach(() => {
    originalAudioContext = globalThis.AudioContext;
    originalLocalStorage = globalThis.localStorage;

    // Mock localStorage
    const store: Record<string, string> = {};
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
        removeItem: vi.fn((key: string) => { delete store[key]; }),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    globalThis.AudioContext = originalAudioContext;
    globalThis.localStorage = originalLocalStorage;
    vi.restoreAllMocks();
  });

  it("creates a SoundManager instance with expected API", () => {
    const { MockAudioContext } = createMockAudioContext();
    globalThis.AudioContext = MockAudioContext as unknown as typeof AudioContext;

    const sm = createSoundManager();
    expect(sm.isMuted()).toBe(false);
    expect(typeof sm.play).toBe("function");
    expect(typeof sm.setMuted).toBe("function");
    expect(typeof sm.toggleMuted).toBe("function");
  });

  it("plays a sound effect using AudioContext", () => {
    const { MockAudioContext } = createMockAudioContext();
    globalThis.AudioContext = MockAudioContext as unknown as typeof AudioContext;

    const sm = createSoundManager();
    sm.play("kickoff");

    expect(MockAudioContext).toHaveBeenCalled();
  });

  it("does not play when muted", () => {
    const { MockAudioContext } = createMockAudioContext();
    globalThis.AudioContext = MockAudioContext as unknown as typeof AudioContext;

    const sm = createSoundManager();
    sm.setMuted(true);
    sm.play("kickoff");

    expect(MockAudioContext).not.toHaveBeenCalled();
  });

  it("toggleMuted flips mute state and persists to localStorage", () => {
    const { MockAudioContext } = createMockAudioContext();
    globalThis.AudioContext = MockAudioContext as unknown as typeof AudioContext;

    const sm = createSoundManager();
    expect(sm.isMuted()).toBe(false);

    const result = sm.toggleMuted();
    expect(result).toBe(true);
    expect(sm.isMuted()).toBe(true);
    expect(localStorage.setItem).toHaveBeenCalledWith("nuffle-arena-sound-muted", "true");

    const result2 = sm.toggleMuted();
    expect(result2).toBe(false);
    expect(sm.isMuted()).toBe(false);
  });

  it("reads initial muted state from localStorage", () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue("true");
    const { MockAudioContext } = createMockAudioContext();
    globalThis.AudioContext = MockAudioContext as unknown as typeof AudioContext;

    const sm = createSoundManager();
    expect(sm.isMuted()).toBe(true);
  });

  it("setMuted persists to localStorage", () => {
    const { MockAudioContext } = createMockAudioContext();
    globalThis.AudioContext = MockAudioContext as unknown as typeof AudioContext;

    const sm = createSoundManager();
    sm.setMuted(true);
    expect(localStorage.setItem).toHaveBeenCalledWith("nuffle-arena-sound-muted", "true");
    sm.setMuted(false);
    expect(localStorage.setItem).toHaveBeenCalledWith("nuffle-arena-sound-muted", "false");
  });

  it("gracefully handles AudioContext not available", () => {
    // @ts-expect-error — testing missing AudioContext
    globalThis.AudioContext = undefined;

    const sm = createSoundManager();
    expect(() => sm.play("touchdown")).not.toThrow();
  });

  it("gracefully handles AudioContext constructor throwing", () => {
    globalThis.AudioContext = vi.fn(() => {
      throw new Error("Not allowed");
    }) as unknown as typeof AudioContext;

    const sm = createSoundManager();
    expect(() => sm.play("touchdown")).not.toThrow();
  });

  describe("plays all sound effect types without error", () => {
    const allEffects: SoundEffect[] = [
      "dice-roll", "block-pow", "block-push", "block-both-down", "block-stumble",
      "injury-stun", "injury-ko", "injury-casualty",
      "touchdown", "turnover", "kickoff",
      "dodge-success", "catch-success", "pass", "crowd-roar",
    ];

    for (const effect of allEffects) {
      it(`plays "${effect}" without error`, () => {
        const { MockAudioContext } = createMockAudioContext();
        globalThis.AudioContext = MockAudioContext as unknown as typeof AudioContext;

        const sm = createSoundManager();
        expect(() => sm.play(effect)).not.toThrow();
        expect(MockAudioContext).toHaveBeenCalled();
      });
    }
  });
});
