import { describe, it, expect } from "vitest";
import { chronologicalTimeline } from "./timeline";

interface Ev {
  id: string;
  meta?: { half?: number; turn?: number } | null;
}

describe("chronologicalTimeline", () => {
  it("trie par mi-temps puis tour", () => {
    const events: Ev[] = [
      { id: "c", meta: { half: 2, turn: 1 } },
      { id: "a", meta: { half: 1, turn: 1 } },
      { id: "b", meta: { half: 1, turn: 3 } },
    ];
    expect(chronologicalTimeline(events).map((x) => x.ev.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("conserve l'ordre de saisie comme départage stable", () => {
    const events: Ev[] = [
      { id: "first", meta: { half: 1, turn: 2 } },
      { id: "second", meta: { half: 1, turn: 2 } },
    ];
    expect(chronologicalTimeline(events).map((x) => x.ev.id)).toEqual([
      "first",
      "second",
    ]);
  });

  it("traite un meta absent comme mi-temps 1 / tour 0 (en tête)", () => {
    const events: Ev[] = [
      { id: "tagged", meta: { half: 1, turn: 2 } },
      { id: "legacy" },
    ];
    expect(chronologicalTimeline(events).map((x) => x.ev.id)).toEqual([
      "legacy",
      "tagged",
    ]);
  });

  it("résout un meta sérialisé en string JSON", () => {
    const events = [
      { id: "x", meta: JSON.stringify({ half: 2, turn: 4 }) as unknown },
      { id: "y", meta: { half: 1, turn: 1 } },
    ] as Ev[];
    const out = chronologicalTimeline(events);
    expect(out.map((e) => e.ev.id)).toEqual(["y", "x"]);
    expect(out[1].m).toEqual({ half: 2, turn: 4 });
  });
});
