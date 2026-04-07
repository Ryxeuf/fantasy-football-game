/**
 * Animation engine for PixiBoard — tween math + animation queue.
 * Pure functions, no DOM/React dependencies.
 */

export interface AnimPosition {
  x: number;
  y: number;
}

export interface AnimationItem {
  type: "player" | "ball";
  id: string;
  from: AnimPosition;
  to: AnimPosition;
  duration: number; // ms
  onComplete?: () => void;
}

/** Linear interpolation, clamped to [0,1] */
export function lerp(a: number, b: number, t: number): number {
  const ct = Math.max(0, Math.min(1, t));
  return a + (b - a) * ct;
}

/** Ease-out cubic: fast start, slow end — feels natural for piece movement */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/* ── Internal types ──────────────────────────────────────────────────── */

interface ActiveAnimation {
  item: AnimationItem;
  elapsed: number;
}

/** A step in the queue: either a single animation or a group running in parallel */
type QueueStep = ActiveAnimation[];

/* ── AnimationQueue ──────────────────────────────────────────────────── */

export interface AnimationQueue {
  enqueue(item: AnimationItem): void;
  enqueueParallel(items: AnimationItem[]): void;
  tick(deltaMs: number): void;
  isAnimating(): boolean;
  getAnimatedPositions(): Record<string, AnimPosition>;
  clear(): void;
}

/* ── Position diffing ────────────────────────────────────────────────── */

export interface PositionDiff {
  id: string;
  from: AnimPosition;
  to: AnimPosition;
}

/** Compare two position maps and return entries that moved */
export function diffPositions(
  prev: Record<string, AnimPosition>,
  next: Record<string, AnimPosition>,
): PositionDiff[] {
  const diffs: PositionDiff[] = [];
  for (const id of Object.keys(next)) {
    const p = prev[id];
    const n = next[id];
    if (!p || !n) continue;
    if (p.x !== n.x || p.y !== n.y) {
      diffs.push({ id, from: p, to: n });
    }
  }
  return diffs;
}

/* ── AnimationQueue ──────────────────────────────────────────────────── */

export function createAnimationQueue(): AnimationQueue {
  const steps: QueueStep[] = [];

  function currentStep(): QueueStep | undefined {
    return steps[0];
  }

  function enqueue(item: AnimationItem): void {
    steps.push([{ item, elapsed: 0 }]);
  }

  function enqueueParallel(items: AnimationItem[]): void {
    if (items.length === 0) return;
    steps.push(items.map((item) => ({ item, elapsed: 0 })));
  }

  function tick(deltaMs: number): void {
    const step = currentStep();
    if (!step) return;

    let allDone = true;
    for (const anim of step) {
      anim.elapsed += deltaMs;
      if (anim.elapsed < anim.item.duration) {
        allDone = false;
      }
    }

    if (allDone) {
      // Fire onComplete callbacks
      for (const anim of step) {
        anim.item.onComplete?.();
      }
      steps.shift();
    }
  }

  function isAnimating(): boolean {
    return steps.length > 0;
  }

  function getAnimatedPositions(): Record<string, AnimPosition> {
    const step = currentStep();
    if (!step) return {};

    const result: Record<string, AnimPosition> = {};
    for (const anim of step) {
      const t = Math.min(anim.elapsed / anim.item.duration, 1);
      const eased = easeOutCubic(t);
      result[anim.item.id] = {
        x: lerp(anim.item.from.x, anim.item.to.x, eased),
        y: lerp(anim.item.from.y, anim.item.to.y, eased),
      };
    }
    return result;
  }

  function clear(): void {
    steps.length = 0;
  }

  return {
    enqueue,
    enqueueParallel,
    tick,
    isAnimating,
    getAnimatedPositions,
    clear,
  };
}
