/**
 * Tests for useReplayControls hook — manages replay playback state.
 * TDD RED phase.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReplayControls } from './useReplayControls';
import type { ReplayFrame } from '@bb/game-engine';
import type { GameState } from '@bb/game-engine';

function makeGameState(turn: number): GameState {
  return {
    width: 26,
    height: 15,
    players: [],
    currentPlayer: 'A',
    turn,
    selectedPlayerId: null,
    isTurnover: false,
    apothecaryAvailable: { teamA: true, teamB: true },
    dugouts: {
      teamA: {
        teamId: 'A',
        zones: {
          reserves: { id: 'r', name: 'Reserves', color: '', icon: '', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
          stunned: { id: 's', name: 'Stunned', color: '', icon: '', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
          knockedOut: { id: 'k', name: 'KO', color: '', icon: '', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
          casualty: { id: 'c', name: 'Casualty', color: '', icon: '', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
          sentOff: { id: 'so', name: 'Sent Off', color: '', icon: '', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
        },
      },
      teamB: {
        teamId: 'B',
        zones: {
          reserves: { id: 'r', name: 'Reserves', color: '', icon: '', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
          stunned: { id: 's', name: 'Stunned', color: '', icon: '', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
          knockedOut: { id: 'k', name: 'KO', color: '', icon: '', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
          casualty: { id: 'c', name: 'Casualty', color: '', icon: '', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
          sentOff: { id: 'so', name: 'Sent Off', color: '', icon: '', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
        },
      },
    },
    playerActions: {},
    teamBlitzCount: {},
    teamFoulCount: {},
    gamePhase: 'playing',
    half: 1,
    score: { teamA: 0, teamB: 0 },
    teamNames: { teamA: 'Team A', teamB: 'Team B' },
    teamRerolls: { teamA: 3, teamB: 3 },
    rerollUsedThisTurn: false,
    matchStats: {},
    casualtyResults: {},
    lastingInjuryDetails: {},
    gameLog: [],
    usedStarPlayerRules: {},
    bribesRemaining: { teamA: 0, teamB: 0 },
    turnTimerSeconds: 0,
  } as GameState;
}

function makeFrames(count: number): ReplayFrame[] {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    gameState: makeGameState(i + 1),
    moveType: i === 0 ? undefined : 'MOVE',
    timestamp: new Date(Date.now() + i * 1000).toISOString(),
  }));
}

describe('useReplayControls', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes at frame 0 and paused', () => {
    const frames = makeFrames(5);
    const { result } = renderHook(() => useReplayControls(frames));

    expect(result.current.currentIndex).toBe(0);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentFrame).toEqual(frames[0]);
    expect(result.current.totalFrames).toBe(5);
  });

  it('stepForward advances by one frame', () => {
    const frames = makeFrames(5);
    const { result } = renderHook(() => useReplayControls(frames));

    act(() => result.current.stepForward());

    expect(result.current.currentIndex).toBe(1);
  });

  it('stepForward does not go past last frame', () => {
    const frames = makeFrames(3);
    const { result } = renderHook(() => useReplayControls(frames));

    act(() => result.current.goToFrame(2));
    act(() => result.current.stepForward());

    expect(result.current.currentIndex).toBe(2);
  });

  it('stepBackward goes back by one frame', () => {
    const frames = makeFrames(5);
    const { result } = renderHook(() => useReplayControls(frames));

    act(() => result.current.goToFrame(3));
    act(() => result.current.stepBackward());

    expect(result.current.currentIndex).toBe(2);
  });

  it('stepBackward does not go below 0', () => {
    const frames = makeFrames(3);
    const { result } = renderHook(() => useReplayControls(frames));

    act(() => result.current.stepBackward());

    expect(result.current.currentIndex).toBe(0);
  });

  it('goToFrame jumps to specific frame', () => {
    const frames = makeFrames(10);
    const { result } = renderHook(() => useReplayControls(frames));

    act(() => result.current.goToFrame(7));

    expect(result.current.currentIndex).toBe(7);
    expect(result.current.currentFrame).toEqual(frames[7]);
  });

  it('goToFrame clamps to valid range', () => {
    const frames = makeFrames(5);
    const { result } = renderHook(() => useReplayControls(frames));

    act(() => result.current.goToFrame(99));
    expect(result.current.currentIndex).toBe(4);

    act(() => result.current.goToFrame(-5));
    expect(result.current.currentIndex).toBe(0);
  });

  it('play auto-advances frames at playback speed', () => {
    const frames = makeFrames(5);
    const { result } = renderHook(() => useReplayControls(frames));

    act(() => result.current.play());
    expect(result.current.isPlaying).toBe(true);

    // Default speed is 1000ms per frame
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.currentIndex).toBe(1);

    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.currentIndex).toBe(2);
  });

  it('play stops at last frame', () => {
    const frames = makeFrames(3);
    const { result } = renderHook(() => useReplayControls(frames));

    act(() => result.current.play());

    // Advance past all frames
    act(() => { vi.advanceTimersByTime(5000); });

    expect(result.current.currentIndex).toBe(2);
    expect(result.current.isPlaying).toBe(false);
  });

  it('pause stops auto-advance', () => {
    const frames = makeFrames(10);
    const { result } = renderHook(() => useReplayControls(frames));

    act(() => result.current.play());
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.currentIndex).toBe(2);

    act(() => result.current.pause());
    expect(result.current.isPlaying).toBe(false);

    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current.currentIndex).toBe(2); // No further advance
  });

  it('setSpeed changes playback interval', () => {
    const frames = makeFrames(10);
    const { result } = renderHook(() => useReplayControls(frames));

    act(() => result.current.setSpeed(500));
    act(() => result.current.play());

    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.currentIndex).toBe(2); // 500ms per frame = 2 frames in 1s
  });

  it('returns empty frame for empty frames array', () => {
    const { result } = renderHook(() => useReplayControls([]));

    expect(result.current.currentFrame).toBeNull();
    expect(result.current.totalFrames).toBe(0);
    expect(result.current.currentIndex).toBe(0);
  });

  it('goToStart and goToEnd jump to boundaries', () => {
    const frames = makeFrames(10);
    const { result } = renderHook(() => useReplayControls(frames));

    act(() => result.current.goToFrame(5));
    act(() => result.current.goToStart());
    expect(result.current.currentIndex).toBe(0);

    act(() => result.current.goToEnd());
    expect(result.current.currentIndex).toBe(9);
  });
});
