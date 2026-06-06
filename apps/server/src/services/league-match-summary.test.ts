/**
 * Lot G — Tests du summarizer pur `summarizeMatchSheet`.
 */

import { describe, it, expect } from "vitest";
import {
  summarizeMatchSheet,
  isMatchEventKind,
  MATCH_EVENT_KINDS,
  type MatchEventInput,
} from "./league-match-summary";

describe("Lot G — summarizeMatchSheet", () => {
  it("empty events -> zero summary", () => {
    const out = summarizeMatchSheet([]);
    expect(out).toEqual({
      scoreHome: 0,
      scoreAway: 0,
      casualtiesHome: 0,
      casualtiesAway: 0,
      injuries: [],
      playerStats: [],
    });
  });

  it("counts touchdowns per team and per player", () => {
    const events: MatchEventInput[] = [
      { kind: "touchdown", team: "home", actorPlayerId: "h1" },
      { kind: "touchdown", team: "home", actorPlayerId: "h1" },
      { kind: "touchdown", team: "away", actorPlayerId: "a1" },
    ];
    const out = summarizeMatchSheet(events);
    expect(out.scoreHome).toBe(2);
    expect(out.scoreAway).toBe(1);
    const h1 = out.playerStats.find((p) => p.playerId === "h1");
    expect(h1?.touchdowns).toBe(2);
    const a1 = out.playerStats.find((p) => p.playerId === "a1");
    expect(a1?.touchdowns).toBe(1);
  });

  it("counts casualties inflicted and injured player on opposite side (block)", () => {
    const events: MatchEventInput[] = [
      {
        kind: "casualty",
        team: "home",
        actorPlayerId: "h1",
        targetPlayerId: "a5",
        causeDetail: "block",
        injurySeverity: "dead",
      },
    ];
    const out = summarizeMatchSheet(events);
    expect(out.casualtiesHome).toBe(1);
    expect(out.casualtiesAway).toBe(0);
    expect(out.injuries).toHaveLength(1);
    expect(out.injuries[0]).toEqual({
      playerId: "a5",
      severity: "dead",
      side: "away", // victim is opposite of the actor's team
      cause: "block",
    });
    const h1 = out.playerStats.find((p) => p.playerId === "h1");
    expect(h1?.casualtiesInflicted).toBe(1);
  });

  it("other_elim (failed dodge) injures a player on the SAME team (self-cause)", () => {
    const events: MatchEventInput[] = [
      {
        kind: "other_elim",
        team: "home",
        targetPlayerId: "h7",
        causeDetail: "failed_dodge",
        injurySeverity: "badly_hurt",
      },
    ];
    const out = summarizeMatchSheet(events);
    // self-cause: counts as a casualty "for" home? No — it's an
    // elimination but not inflicted by the opponent. We still tally
    // it under the team that owns the event for casualty count.
    expect(out.injuries).toHaveLength(1);
    expect(out.injuries[0]).toEqual({
      playerId: "h7",
      severity: "badly_hurt",
      side: "home", // self-cause: victim is in `team`
      cause: "failed_dodge",
    });
  });

  it("aggression increments aggressions and casualty when injured", () => {
    const events: MatchEventInput[] = [
      { kind: "aggression", team: "away", actorPlayerId: "a3" },
      {
        kind: "aggression",
        team: "away",
        actorPlayerId: "a3",
        targetPlayerId: "h2",
        causeDetail: "foul",
        injurySeverity: "mng",
      },
    ];
    const out = summarizeMatchSheet(events);
    const a3 = out.playerStats.find((p) => p.playerId === "a3");
    expect(a3?.aggressions).toBe(2);
    expect(a3?.casualtiesInflicted).toBe(1);
    expect(out.casualtiesAway).toBe(1);
    expect(out.injuries[0]).toMatchObject({
      playerId: "h2",
      severity: "mng",
      side: "home",
    });
  });

  it("crowd_surge injures without crediting a player (no actor stat)", () => {
    const events: MatchEventInput[] = [
      {
        kind: "crowd_surge",
        team: "home",
        targetPlayerId: "a9",
        causeDetail: "crowd",
        injurySeverity: "stat_loss",
      },
    ];
    const out = summarizeMatchSheet(events);
    expect(out.casualtiesHome).toBe(1);
    // no actor -> no playerStats entry
    expect(out.playerStats).toHaveLength(0);
    expect(out.injuries[0]).toMatchObject({
      playerId: "a9",
      side: "away",
      severity: "stat_loss",
    });
  });

  it("counts completions and interceptions", () => {
    const events: MatchEventInput[] = [
      { kind: "pass_complete", team: "home", actorPlayerId: "h4" },
      { kind: "pass_complete", team: "home", actorPlayerId: "h4" },
      { kind: "interception", team: "away", actorPlayerId: "a8" },
    ];
    const out = summarizeMatchSheet(events);
    expect(out.playerStats.find((p) => p.playerId === "h4")?.completions).toBe(2);
    expect(
      out.playerStats.find((p) => p.playerId === "a8")?.interceptions,
    ).toBe(1);
  });

  it("ignores kickoff/expulsion/stalling for score and casualties", () => {
    const events: MatchEventInput[] = [
      { kind: "kickoff", team: "home" },
      { kind: "expulsion", team: "away", actorPlayerId: "a1" },
      { kind: "stalling", team: "home" },
    ];
    const out = summarizeMatchSheet(events);
    expect(out.scoreHome).toBe(0);
    expect(out.scoreAway).toBe(0);
    expect(out.casualtiesHome).toBe(0);
    expect(out.injuries).toHaveLength(0);
  });

  it("ignores casualty with unknown severity (no injury recorded)", () => {
    const events: MatchEventInput[] = [
      {
        kind: "casualty",
        team: "home",
        actorPlayerId: "h1",
        targetPlayerId: "a5",
        injurySeverity: "scratch", // unknown
      },
    ];
    const out = summarizeMatchSheet(events);
    expect(out.casualtiesHome).toBe(0);
    expect(out.injuries).toHaveLength(0);
  });

  it("is deterministic", () => {
    const events: MatchEventInput[] = [
      { kind: "touchdown", team: "home", actorPlayerId: "h1" },
      {
        kind: "casualty",
        team: "away",
        actorPlayerId: "a1",
        targetPlayerId: "h2",
        injurySeverity: "niggling",
        causeDetail: "block",
      },
    ];
    expect(summarizeMatchSheet(events)).toEqual(summarizeMatchSheet(events));
  });

  it("full match scenario", () => {
    const events: MatchEventInput[] = [
      { kind: "kickoff", team: "home" },
      { kind: "pass_complete", team: "home", actorPlayerId: "h_thrower" },
      { kind: "touchdown", team: "home", actorPlayerId: "h_catcher" },
      {
        kind: "casualty",
        team: "home",
        actorPlayerId: "h_blitz",
        targetPlayerId: "a_line",
        causeDetail: "block",
        injurySeverity: "dead",
      },
      { kind: "touchdown", team: "away", actorPlayerId: "a_runner" },
      { kind: "touchdown", team: "away", actorPlayerId: "a_runner" },
      {
        kind: "other_elim",
        team: "away",
        targetPlayerId: "a_gfi",
        causeDetail: "failed_gfi",
        injurySeverity: "badly_hurt",
      },
    ];
    const out = summarizeMatchSheet(events);
    expect(out.scoreHome).toBe(1);
    expect(out.scoreAway).toBe(2);
    expect(out.casualtiesHome).toBe(1); // the block kill
    expect(out.injuries).toHaveLength(2);
    const runner = out.playerStats.find((p) => p.playerId === "a_runner");
    expect(runner?.touchdowns).toBe(2);
  });
});

describe("Lot G — isMatchEventKind / MATCH_EVENT_KINDS", () => {
  it("exposes 10 kinds", () => {
    expect(MATCH_EVENT_KINDS).toHaveLength(10);
  });
  it("validates known kinds", () => {
    expect(isMatchEventKind("touchdown")).toBe(true);
    expect(isMatchEventKind("crowd_surge")).toBe(true);
    expect(isMatchEventKind("nope")).toBe(false);
    expect(isMatchEventKind(42)).toBe(false);
  });
});
