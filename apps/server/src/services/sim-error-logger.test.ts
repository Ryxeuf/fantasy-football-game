/**
 * Tests pour le sim error logger structuré (Lot 4.A.1 + 4.A.2).
 *
 * Couvre :
 *   - `buildSimErrorLog` : produit un payload pino-friendly avec les
 *     bons labels (event, errType, engineVer, driver, race, etc.).
 *   - `buildSlowSimLog` : seuil franchi -> log warn structuré, sinon
 *     `null`.
 *   - Truncation du stack trace (defense-in-depth contre log bloat).
 */

import { describe, expect, it } from "vitest";

import {
  buildSimErrorLog,
  buildSlowSimLog,
  DEFAULT_SLOW_SIM_THRESHOLD_SEC,
  truncateStack,
} from "./sim-error-logger";

describe("buildSimErrorLog — Lot 4.A.1", () => {
  it("retourne un payload structuré avec les labels canoniques", () => {
    const err = new Error("Sim crashed: tactic invalid");
    err.stack = "Error: Sim crashed\n    at runFullDriver (full-driver.ts:42)";
    const payload = buildSimErrorLog(err, {
      matchId: "m_42",
      engineVer: "0.16.0",
      driver: "full",
      seasonId: "s_2026",
      homeTeamId: "ph",
      awayTeamId: "pa",
      homeRace: "Wood Elf",
      awayRace: "Orc",
    });
    expect(payload).toMatchObject({
      event: "sim_error",
      errType: "Error",
      errMessage: "Sim crashed: tactic invalid",
      matchId: "m_42",
      engineVer: "0.16.0",
      driver: "full",
      seasonId: "s_2026",
      homeRace: "Wood Elf",
      awayRace: "Orc",
    });
    // stack present + tronqué.
    expect(typeof payload.stackTrace).toBe("string");
  });

  it("supporte les non-Error throws (string / unknown)", () => {
    const payload = buildSimErrorLog("plain string error", {
      matchId: "m_1",
      engineVer: "0.16.0",
      driver: "hybrid",
      seasonId: "s_2026",
      homeTeamId: "h",
      awayTeamId: "a",
    });
    expect(payload.errType).toBe("Unknown");
    expect(payload.errMessage).toBe("plain string error");
    expect(payload.stackTrace).toBeUndefined();
  });

  it("normalise les classes d'erreur custom (preserve err.name)", () => {
    class EngineVersionMismatchError extends Error {
      constructor(message: string) {
        super(message);
        this.name = "EngineVersionMismatchError";
      }
    }
    const err = new EngineVersionMismatchError("0.15.0 != 0.16.0");
    const payload = buildSimErrorLog(err, {
      matchId: "m",
      engineVer: "0.16.0",
      driver: "full",
      seasonId: "s",
      homeTeamId: "h",
      awayTeamId: "a",
    });
    expect(payload.errType).toBe("EngineVersionMismatchError");
  });
});

describe("truncateStack — Lot 4.A.1", () => {
  it("preserve les stacks courtes", () => {
    const short = "Error: x\n    at foo";
    expect(truncateStack(short, 1000)).toBe(short);
  });

  it("coupe a la limite et ajoute un suffixe", () => {
    const long = "x".repeat(5000);
    const out = truncateStack(long, 100);
    expect(out.length).toBeLessThanOrEqual(100 + 30);
    expect(out).toMatch(/\[truncated/);
  });

  it("retourne undefined sur stack vide / null", () => {
    expect(truncateStack(undefined, 1000)).toBeUndefined();
    expect(truncateStack("", 1000)).toBeUndefined();
  });
});

describe("buildSlowSimLog — Lot 4.A.2", () => {
  it("retourne null sous le seuil (sim rapide)", () => {
    const out = buildSlowSimLog({
      matchId: "m1",
      durationSec: 1.0,
      thresholdSec: DEFAULT_SLOW_SIM_THRESHOLD_SEC,
      engineVer: "0.16.0",
      driver: "full",
      seasonId: "s",
      homeTeamId: "h",
      awayTeamId: "a",
    });
    expect(out).toBeNull();
  });

  it("retourne un payload structuré au-dessus du seuil", () => {
    const out = buildSlowSimLog({
      matchId: "m_slow",
      durationSec: 7.5,
      thresholdSec: 5.0,
      engineVer: "0.16.0",
      driver: "full",
      seasonId: "s_2026",
      homeTeamId: "ph",
      awayTeamId: "pa",
      homeRace: "Halfling",
      awayRace: "Chaos",
    });
    expect(out).toMatchObject({
      event: "sim_slow",
      matchId: "m_slow",
      durationSec: 7.5,
      thresholdSec: 5.0,
      driver: "full",
      homeRace: "Halfling",
      awayRace: "Chaos",
    });
  });

  it("seuil exact non considere slow (strict >)", () => {
    const out = buildSlowSimLog({
      matchId: "m",
      durationSec: 5.0,
      thresholdSec: 5.0,
      engineVer: "0.16.0",
      driver: "hybrid",
      seasonId: "s",
      homeTeamId: "h",
      awayTeamId: "a",
    });
    expect(out).toBeNull();
  });
});
