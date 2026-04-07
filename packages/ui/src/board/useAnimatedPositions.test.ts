import { describe, it, expect } from "vitest";
import { diffPositions } from "./animation";
import type { AnimPosition } from "./animation";

describe("diffPositions", () => {
  it("returns empty array when no positions change", () => {
    const prev: Record<string, AnimPosition> = { A1: { x: 0, y: 0 } };
    const next: Record<string, AnimPosition> = { A1: { x: 0, y: 0 } };
    expect(diffPositions(prev, next)).toEqual([]);
  });

  it("detects a moved player", () => {
    const prev: Record<string, AnimPosition> = { A1: { x: 0, y: 0 } };
    const next: Record<string, AnimPosition> = { A1: { x: 1, y: 2 } };
    const diffs = diffPositions(prev, next);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toEqual({
      id: "A1",
      from: { x: 0, y: 0 },
      to: { x: 1, y: 2 },
    });
  });

  it("ignores new players (no from position)", () => {
    const prev: Record<string, AnimPosition> = {};
    const next: Record<string, AnimPosition> = { A1: { x: 1, y: 2 } };
    expect(diffPositions(prev, next)).toEqual([]);
  });

  it("ignores removed players", () => {
    const prev: Record<string, AnimPosition> = { A1: { x: 0, y: 0 } };
    const next: Record<string, AnimPosition> = {};
    expect(diffPositions(prev, next)).toEqual([]);
  });

  it("detects multiple moved players", () => {
    const prev: Record<string, AnimPosition> = {
      A1: { x: 0, y: 0 },
      A2: { x: 5, y: 5 },
      A3: { x: 3, y: 3 },
    };
    const next: Record<string, AnimPosition> = {
      A1: { x: 1, y: 0 },
      A2: { x: 5, y: 5 }, // not moved
      A3: { x: 4, y: 3 },
    };
    const diffs = diffPositions(prev, next);
    expect(diffs).toHaveLength(2);
    expect(diffs.map((d) => d.id).sort()).toEqual(["A1", "A3"]);
  });

  it("detects ball movement with special ball id", () => {
    const prev: Record<string, AnimPosition> = { __ball__: { x: 5, y: 5 } };
    const next: Record<string, AnimPosition> = { __ball__: { x: 6, y: 6 } };
    const diffs = diffPositions(prev, next);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]!.id).toBe("__ball__");
  });
});
