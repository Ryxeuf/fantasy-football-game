import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import React from "react";

// --- Mock useToast ---
const mockAddToast = vi.fn();
vi.mock("@bb/ui", () => ({
  useToast: () => ({
    addToast: mockAddToast,
    toasts: [],
    removeToast: vi.fn(),
    clearAllToasts: vi.fn(),
  }),
}));

import { useTurnNotification } from "./useTurnNotification";

describe("useTurnNotification", () => {
  let originalNotification: typeof globalThis.Notification;
  let originalAudioContext: typeof globalThis.AudioContext;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock document.title
    Object.defineProperty(document, "title", {
      writable: true,
      value: "Nuffle Arena",
    });

    // Mock Notification API
    originalNotification = globalThis.Notification;
    const MockNotification = vi.fn() as unknown as typeof Notification;
    Object.defineProperty(MockNotification, "permission", {
      get: () => "granted",
      configurable: true,
    });
    MockNotification.requestPermission = vi.fn().mockResolvedValue("granted");
    globalThis.Notification = MockNotification;

    // Mock AudioContext for sound
    originalAudioContext = globalThis.AudioContext;
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
    globalThis.AudioContext = vi.fn().mockImplementation(() => ({
      createOscillator: vi.fn(() => mockOscillator),
      createGain: vi.fn(() => mockGain),
      destination: {},
      currentTime: 0,
    })) as unknown as typeof AudioContext;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    globalThis.Notification = originalNotification;
    globalThis.AudioContext = originalAudioContext;
  });

  it("does nothing on initial render when isMyTurn is false", () => {
    renderHook(() =>
      useTurnNotification({ isMyTurn: false, isActiveMatch: true }),
    );

    expect(mockAddToast).not.toHaveBeenCalled();
    expect(document.title).toBe("En attente... — Nuffle Arena");
  });

  it("does nothing when match is not active", () => {
    renderHook(() =>
      useTurnNotification({ isMyTurn: true, isActiveMatch: false }),
    );

    expect(mockAddToast).not.toHaveBeenCalled();
    expect(document.title).toBe("Nuffle Arena");
  });

  it("shows toast and browser notification when turn changes to my turn", () => {
    const { rerender } = renderHook(
      ({ isMyTurn, isActiveMatch }) =>
        useTurnNotification({ isMyTurn, isActiveMatch }),
      { initialProps: { isMyTurn: false, isActiveMatch: true } },
    );

    // Turn changes to my turn
    rerender({ isMyTurn: true, isActiveMatch: true });

    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "info",
        title: "C'est votre tour !",
        message: "A vous de jouer. Choisissez votre action.",
      }),
    );
    expect(document.title).toBe("Votre tour ! — Nuffle Arena");
    expect(globalThis.Notification).toHaveBeenCalledWith("Nuffle Arena", {
      body: "C'est votre tour de jouer !",
      icon: "/favicon.ico",
    });
  });

  it("plays notification sound when turn changes to my turn", () => {
    const { rerender } = renderHook(
      ({ isMyTurn, isActiveMatch }) =>
        useTurnNotification({ isMyTurn, isActiveMatch }),
      { initialProps: { isMyTurn: false, isActiveMatch: true } },
    );

    rerender({ isMyTurn: true, isActiveMatch: true });

    expect(globalThis.AudioContext).toHaveBeenCalled();
  });

  it("sets title to waiting when it is not my turn", () => {
    renderHook(() =>
      useTurnNotification({ isMyTurn: false, isActiveMatch: true }),
    );

    expect(document.title).toBe("En attente... — Nuffle Arena");
  });

  it("does not show duplicate toast if isMyTurn stays true across rerenders", () => {
    const { rerender } = renderHook(
      ({ isMyTurn, isActiveMatch }) =>
        useTurnNotification({ isMyTurn, isActiveMatch }),
      { initialProps: { isMyTurn: true, isActiveMatch: true } },
    );

    // Initial render with isMyTurn=true doesn't trigger (no transition)
    // since prevIsMyTurn starts as false, the first render DOES trigger
    mockAddToast.mockClear();

    // Re-render with same values — should NOT trigger again
    rerender({ isMyTurn: true, isActiveMatch: true });

    expect(mockAddToast).not.toHaveBeenCalled();
  });

  it("requests notification permission on mount", () => {
    // Set permission to default
    Object.defineProperty(globalThis.Notification, "permission", {
      get: () => "default",
      configurable: true,
    });

    renderHook(() =>
      useTurnNotification({ isMyTurn: false, isActiveMatch: true }),
    );

    expect(Notification.requestPermission).toHaveBeenCalled();
  });

  it("resets title to default when match is not active", () => {
    renderHook(() =>
      useTurnNotification({ isMyTurn: false, isActiveMatch: false }),
    );

    expect(document.title).toBe("Nuffle Arena");
  });
});
