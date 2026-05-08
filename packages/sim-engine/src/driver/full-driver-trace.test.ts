/**
 * Tests pour le verbose mode du full driver (Lot 3.B.3).
 *
 * Couvre :
 *  - extractFullDriverTrace : reconstruit une vue tour-par-tour à
 *    partir d'un SimResult (events + summary), sans re-rouler le sim.
 *  - runFullDriverWithTrace : wrapper qui appelle runFullDriver puis
 *    extrait la trace.
 *
 * La trace sert au debug interactif (admin replay) et aux tests
 * d'integration : "le full driver pour le seed=42 doit produire
 * exactement N tours en half 1".
 */

import { describe, expect, it } from "vitest";

import { extractFullDriverTrace } from "./full-driver-trace";
import type { SimResult } from "../types";

function makeResult(events: SimResult["events"]): SimResult {
  return {
    result: "draw",
    engineVer: "0.16.0",
    events,
    casualties: [],
    summary: {
      result: "draw",
      score: { home: 0, away: 0 },
      outcome: "draw",
      durationMs: 0,
      touchdownCount: 0,
      turnoverCount: 0,
      nuffleCount: 0,
      underdogBoostCount: 0,
      momentum: [],
    } as unknown as SimResult["summary"],
  };
}

describe("extractFullDriverTrace — Lot 3.B.3", () => {
  it("retourne une trace vide quand aucun TURN_START n'est présent", () => {
    const trace = extractFullDriverTrace(
      makeResult([
        {
          type: "KICKOFF",
          displayAtMs: 0,
          engineVer: "0.16.0",
          meta: {},
        },
        {
          type: "END",
          displayAtMs: 1000,
          engineVer: "0.16.0",
          meta: { outcome: "draw" },
        },
      ] as unknown as SimResult["events"]),
    );
    expect(trace.turns).toEqual([]);
    expect(trace.summary.totalTurns).toBe(0);
    expect(trace.summary.endedNormally).toBe(true);
  });

  it("regroupe les events par tour (TURN_START -> next TURN_START ou END)", () => {
    const events = [
      { type: "KICKOFF", displayAtMs: 0, engineVer: "0.16.0", meta: {} },
      {
        type: "TURN_START",
        displayAtMs: 0,
        engineVer: "0.16.0",
        meta: { half: 1, turn: 1, drivingTeam: "away" },
      },
      {
        type: "BLOCK",
        displayAtMs: 1000,
        engineVer: "0.16.0",
        meta: { side: "away" },
      },
      {
        type: "BLOCK",
        displayAtMs: 2000,
        engineVer: "0.16.0",
        meta: { side: "away" },
      },
      {
        type: "TURN_START",
        displayAtMs: 3000,
        engineVer: "0.16.0",
        meta: { half: 1, turn: 2, drivingTeam: "home" },
      },
      {
        type: "BLOCK",
        displayAtMs: 4000,
        engineVer: "0.16.0",
        meta: { side: "home" },
      },
      {
        type: "TURNOVER",
        displayAtMs: 5000,
        engineVer: "0.16.0",
        meta: {},
      },
      {
        type: "END",
        displayAtMs: 6000,
        engineVer: "0.16.0",
        meta: { outcome: "draw" },
      },
    ] as unknown as SimResult["events"];

    const trace = extractFullDriverTrace(makeResult(events));

    expect(trace.turns).toHaveLength(2);
    expect(trace.turns[0]).toMatchObject({
      half: 1,
      turn: 1,
      drivingTeam: "away",
      eventCount: 2,
      hasTurnover: false,
    });
    expect(trace.turns[1]).toMatchObject({
      half: 1,
      turn: 2,
      drivingTeam: "home",
      eventCount: 2,
      hasTurnover: true,
    });
  });

  it("compte les touchdowns / casualties / KO par tour", () => {
    const events = [
      {
        type: "TURN_START",
        displayAtMs: 0,
        engineVer: "0.16.0",
        meta: { half: 1, turn: 1, drivingTeam: "home" },
      },
      {
        type: "TD",
        displayAtMs: 1000,
        engineVer: "0.16.0",
        meta: {},
      },
      {
        type: "CASUALTY",
        displayAtMs: 2000,
        engineVer: "0.16.0",
        meta: {},
      },
      {
        type: "KO",
        displayAtMs: 3000,
        engineVer: "0.16.0",
        meta: {},
      },
      { type: "END", displayAtMs: 4000, engineVer: "0.16.0", meta: {} },
    ] as unknown as SimResult["events"];

    const trace = extractFullDriverTrace(makeResult(events));
    expect(trace.turns[0]).toMatchObject({
      touchdownCount: 1,
      casualtyCount: 1,
      koCount: 1,
    });
    expect(trace.summary).toMatchObject({
      totalTurns: 1,
      totalTouchdowns: 1,
      totalCasualties: 1,
      totalKos: 1,
    });
  });

  it("flag endedNormally=false si pas d'event END (timeout / break)", () => {
    const trace = extractFullDriverTrace(
      makeResult([
        {
          type: "TURN_START",
          displayAtMs: 0,
          engineVer: "0.16.0",
          meta: { half: 1, turn: 1, drivingTeam: "home" },
        },
      ] as unknown as SimResult["events"]),
    );
    expect(trace.summary.endedNormally).toBe(false);
  });

  it("HALFTIME crée une frontière naturelle entre tours half=1 et half=2", () => {
    const events = [
      {
        type: "TURN_START",
        displayAtMs: 0,
        engineVer: "0.16.0",
        meta: { half: 1, turn: 8, drivingTeam: "home" },
      },
      {
        type: "HALFTIME",
        displayAtMs: 1000,
        engineVer: "0.16.0",
        meta: {},
      },
      {
        type: "TURN_START",
        displayAtMs: 2000,
        engineVer: "0.16.0",
        meta: { half: 2, turn: 1, drivingTeam: "away" },
      },
      { type: "END", displayAtMs: 3000, engineVer: "0.16.0", meta: {} },
    ] as unknown as SimResult["events"];

    const trace = extractFullDriverTrace(makeResult(events));
    expect(trace.turns).toHaveLength(2);
    expect(trace.turns[0].half).toBe(1);
    expect(trace.turns[1].half).toBe(2);
  });
});
