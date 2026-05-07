/**
 * Sprint 1.G.4 — Tests `buildScrubMarkers`.
 */

import { describe, expect, it } from "vitest";
import type { MatchEvent } from "@bb/shared-types";

import { buildScrubMarkers } from "./replay-scrub-markers";

function ev(
  type: string,
  displayAtMs: number,
  meta: Record<string, unknown> = {},
): MatchEvent {
  return { type: type as MatchEvent["type"], displayAtMs, engineVer: "0.13.0", meta };
}

describe("buildScrubMarkers — sprint 1.G.4", () => {
  it("renvoie [] si durationMs <= 0", () => {
    expect(
      buildScrubMarkers({
        events: [ev("TD", 0)],
        durationMs: 0,
      }),
    ).toEqual([]);
    expect(
      buildScrubMarkers({
        events: [ev("TD", 0)],
        durationMs: -1,
      }),
    ).toEqual([]);
  });

  it("ignore les types non-marker (KICKOFF, BLOCK, etc.)", () => {
    const out = buildScrubMarkers({
      events: [
        ev("KICKOFF", 0),
        ev("TURN_START", 30_000),
        ev("BLOCK", 35_000),
        ev("TD", 90_000, { team: "home" }),
        ev("PASS", 100_000),
      ],
      durationMs: 600_000,
    });
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("TD");
  });

  it("calcule percent comme displayAtMs / durationMs * 100", () => {
    const out = buildScrubMarkers({
      events: [ev("TD", 60_000, { team: "home" })],
      durationMs: 600_000,
    });
    expect(out[0].percent).toBeCloseTo(10);
  });

  it("clamp percent a [0, 100]", () => {
    const out = buildScrubMarkers({
      events: [
        ev("TD", -500, { team: "home" }),
        ev("CASUALTY", 1_000_000),
      ],
      durationMs: 600_000,
    });
    expect(out[0].percent).toBe(0);
    expect(out[1].percent).toBe(100);
  });

  it("trie par displayAtMs ascending", () => {
    const out = buildScrubMarkers({
      events: [
        ev("TD", 480_000, { team: "home" }),
        ev("NUFFLE", 90_000, { id: "fog_rolls_in" }),
        ev("CASUALTY", 200_000),
      ],
      durationMs: 600_000,
    });
    expect(out.map((m) => m.type)).toEqual(["NUFFLE", "CASUALTY", "TD"]);
  });

  it("preserve eventIndex de l'array d'origine (pour scroll-to)", () => {
    const events = [
      ev("KICKOFF", 0),
      ev("TURN_START", 30_000),
      ev("TD", 90_000, { team: "home" }),
      ev("BLOCK", 100_000),
      ev("CASUALTY", 200_000),
    ];
    const out = buildScrubMarkers({ events, durationMs: 600_000 });
    expect(out.find((m) => m.type === "TD")?.eventIndex).toBe(2);
    expect(out.find((m) => m.type === "CASUALTY")?.eventIndex).toBe(4);
  });

  it("label TD inclut le team en MAJ", () => {
    const out = buildScrubMarkers({
      events: [ev("TD", 90_000, { team: "home" })],
      durationMs: 600_000,
    });
    expect(out[0].label).toBe("TOUCHDOWN HOME");
  });

  it("label TD sans team -> 'TOUCHDOWN'", () => {
    const out = buildScrubMarkers({
      events: [ev("TD", 90_000)],
      durationMs: 600_000,
    });
    expect(out[0].label).toBe("TOUCHDOWN");
  });

  it("label CASUALTY inclut causedBy si fourni", () => {
    const out = buildScrubMarkers({
      events: [ev("CASUALTY", 200_000, { causedBy: "banana_skin" })],
      durationMs: 600_000,
    });
    expect(out[0].label).toBe("Casualty (banana_skin)");
  });

  it("label NUFFLE inclut id", () => {
    const out = buildScrubMarkers({
      events: [ev("NUFFLE", 100_000, { id: "fog_rolls_in" })],
      durationMs: 600_000,
    });
    expect(out[0].label).toBe("Nuffle: fog_rolls_in");
  });

  it("renvoie [] sur events vide", () => {
    expect(buildScrubMarkers({ events: [], durationMs: 600_000 })).toEqual(
      [],
    );
  });
});
