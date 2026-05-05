/**
 * L2.C.5 — Tests des helpers PURE de tie-break (`parseTieBreakRules`,
 * `makeStandingsComparator`).
 *
 * Couvre :
 *  - parseTieBreakRules : null / JSON corrompu / array vide / slugs
 *    inconnus / dedup / sentinelle "name" auto-ajoutee.
 *  - makeStandingsComparator : tri par points / td_diff / td_for /
 *    season_elo / wins / cas_diff / cas_for / td_against / name.
 *  - Order matters : changer l'ordre des slugs change le winner.
 */

import { describe, it, expect } from "vitest";
import {
  parseTieBreakRules,
  makeStandingsComparator,
  TIE_BREAK_SLUGS,
} from "./league";
import type { StandingRow } from "./league";

function row(over: Partial<StandingRow>): StandingRow {
  return {
    participantId: "p",
    teamId: "t",
    teamName: "Team",
    roster: "skaven",
    ownerId: "u",
    coachName: "Coach",
    played: 3,
    wins: 0,
    draws: 0,
    losses: 0,
    points: 0,
    touchdownsFor: 0,
    touchdownsAgainst: 0,
    touchdownDifference: 0,
    casualtiesFor: 0,
    casualtiesAgainst: 0,
    seasonElo: 1000,
    status: "active",
    ...over,
  };
}

describe("parseTieBreakRules", () => {
  it("returns the historical default when input is null", () => {
    const out = parseTieBreakRules(null);
    expect(out).toEqual([
      "points",
      "td_diff",
      "td_for",
      "season_elo",
      "name",
    ]);
  });

  it("returns the historical default for corrupted JSON", () => {
    expect(parseTieBreakRules("{not-json")).toEqual([
      "points",
      "td_diff",
      "td_for",
      "season_elo",
      "name",
    ]);
  });

  it("returns the historical default when JSON is not an array", () => {
    expect(parseTieBreakRules('{"foo":"bar"}')).toEqual([
      "points",
      "td_diff",
      "td_for",
      "season_elo",
      "name",
    ]);
  });

  it("filters unknown slugs and keeps order of valid ones", () => {
    const out = parseTieBreakRules(
      JSON.stringify(["points", "unknown", "wins", "foo", "name"]),
    );
    expect(out).toEqual(["points", "wins", "name"]);
  });

  it("removes duplicates while preserving first occurrence order", () => {
    const out = parseTieBreakRules(
      JSON.stringify(["points", "wins", "points", "name", "wins"]),
    );
    expect(out).toEqual(["points", "wins", "name"]);
  });

  it("auto-appends 'name' as tail sentinel when absent", () => {
    const out = parseTieBreakRules(JSON.stringify(["points", "wins"]));
    expect(out[out.length - 1]).toBe("name");
  });

  it("falls back to default when filtered array is empty", () => {
    const out = parseTieBreakRules(JSON.stringify(["foo", "bar"]));
    expect(out).toEqual([
      "points",
      "td_diff",
      "td_for",
      "season_elo",
      "name",
    ]);
  });

  it("accepts every slug from TIE_BREAK_SLUGS", () => {
    const out = parseTieBreakRules(JSON.stringify([...TIE_BREAK_SLUGS]));
    expect(out).toEqual(TIE_BREAK_SLUGS);
  });
});

describe("makeStandingsComparator", () => {
  it("sorts by points DESC primarily", () => {
    const cmp = makeStandingsComparator(["points", "name"]);
    const a = row({ teamName: "A", points: 10 });
    const b = row({ teamName: "B", points: 5 });
    expect([b, a].sort(cmp).map((r) => r.teamName)).toEqual(["A", "B"]);
  });

  it("breaks ties via the secondary slug (td_diff)", () => {
    const cmp = makeStandingsComparator(["points", "td_diff", "name"]);
    const a = row({
      teamName: "A",
      points: 10,
      touchdownDifference: 1,
    });
    const b = row({
      teamName: "B",
      points: 10,
      touchdownDifference: 5,
    });
    expect([a, b].sort(cmp).map((r) => r.teamName)).toEqual(["B", "A"]);
  });

  it("changes winner when slug order changes", () => {
    const a = row({
      teamName: "A",
      wins: 5,
      touchdownsFor: 3,
    });
    const b = row({
      teamName: "B",
      wins: 3,
      touchdownsFor: 10,
    });

    const winsFirst = makeStandingsComparator(["wins", "td_for", "name"]);
    expect([a, b].sort(winsFirst).map((r) => r.teamName)).toEqual(["A", "B"]);

    const tdFirst = makeStandingsComparator(["td_for", "wins", "name"]);
    expect([a, b].sort(tdFirst).map((r) => r.teamName)).toEqual(["B", "A"]);
  });

  it("td_against : less is better (ASC)", () => {
    const cmp = makeStandingsComparator(["td_against", "name"]);
    const a = row({ teamName: "A", touchdownsAgainst: 8 });
    const b = row({ teamName: "B", touchdownsAgainst: 2 });
    expect([a, b].sort(cmp).map((r) => r.teamName)).toEqual(["B", "A"]);
  });

  it("cas_diff : casualties for - against, DESC", () => {
    const cmp = makeStandingsComparator(["cas_diff", "name"]);
    const a = row({
      teamName: "A",
      casualtiesFor: 5,
      casualtiesAgainst: 1,
    });
    const b = row({
      teamName: "B",
      casualtiesFor: 10,
      casualtiesAgainst: 2,
    });
    // diff: A = 4, B = 8 -> B first.
    expect([a, b].sort(cmp).map((r) => r.teamName)).toEqual(["B", "A"]);
  });

  it("season_elo DESC", () => {
    const cmp = makeStandingsComparator(["season_elo", "name"]);
    const a = row({ teamName: "A", seasonElo: 1100 });
    const b = row({ teamName: "B", seasonElo: 1000 });
    expect([b, a].sort(cmp).map((r) => r.teamName)).toEqual(["A", "B"]);
  });

  it("name ASC as final tiebreaker", () => {
    const cmp = makeStandingsComparator(["points", "name"]);
    const a = row({ teamName: "Beta", points: 5 });
    const b = row({ teamName: "Alpha", points: 5 });
    expect([a, b].sort(cmp).map((r) => r.teamName)).toEqual([
      "Alpha",
      "Beta",
    ]);
  });

  it("returns 0 when all slugs tie (stable order preserved)", () => {
    const cmp = makeStandingsComparator(["points"]);
    const a = row({ teamName: "A", points: 5 });
    const b = row({ teamName: "B", points: 5 });
    // No "name" in rules -> equal -> sort stable, preserves input order.
    expect(cmp(a, b)).toBe(0);
  });
});
