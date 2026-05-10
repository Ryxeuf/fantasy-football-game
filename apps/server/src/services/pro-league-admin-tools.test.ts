/**
 * Tests pour le service admin tools (Lot 4.F).
 *
 * Couvre :
 *   - `runVersionComparison` : valide les 2 baselines + delegue a
 *     `compareBaselines`. Erreur typee si JSON invalide.
 *   - `runReplayDiff` : lit 2 replays de la DB, decompresse, delegue
 *     a `diffReplayEvents`. Erreurs : MATCH_NOT_FOUND, REPLAY_NOT_FOUND.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proLeagueMatch: { findUnique: vi.fn() },
    replay: { findUnique: vi.fn() },
  },
}));

vi.mock("@bb/sim-engine", async () => {
  const actual = await vi.importActual<typeof import("@bb/sim-engine")>(
    "@bb/sim-engine",
  );
  return {
    ...actual,
    decompressEvents: vi.fn(),
  };
});

import { prisma } from "../prisma";
import { decompressEvents } from "@bb/sim-engine";
import {
  AdminToolsError,
  runReplayDiff,
  runVersionComparison,
} from "./pro-league-admin-tools";

interface MockedPrisma {
  proLeagueMatch: { findUnique: ReturnType<typeof vi.fn> };
  replay: { findUnique: ReturnType<typeof vi.fn> };
}
const mocked = prisma as unknown as MockedPrisma;
const mockedDecompress = vi.mocked(decompressEvents);

beforeEach(() => {
  vi.clearAllMocks();
});

const VALID_BASELINE = {
  engineVer: "0.16.0",
  snapshotAt: "2026-05-07",
  tolerance: 0.05,
  pairings: [
    {
      homeId: "pit-smashers",
      awayId: "kc-soaring-hawks",
      runs: 1000,
      seedOffset: 0,
      expected: {
        tdMean: 2.4,
        tdStd: 1.2,
        casualtyMean: 1.5,
        turnoverMean: 4,
        homeWinRate: 0.5,
        awayWinRate: 0.4,
        drawRate: 0.1,
      },
    },
  ],
};

describe("runVersionComparison — Lot 4.F", () => {
  it("retourne un VersionComparisonResult sur 2 baselines valides", () => {
    const out = runVersionComparison({
      baseRaw: VALID_BASELINE,
      headRaw: VALID_BASELINE,
    });
    expect(out.summary.matchedPairings).toBe(1);
    expect(out.summary.warnCount).toBe(0);
    expect(out.summary.criticalCount).toBe(0);
  });

  it("INVALID_BASELINE si base raw n'est pas conforme au schema", () => {
    expect(() =>
      runVersionComparison({
        baseRaw: { foo: "bar" },
        headRaw: VALID_BASELINE,
      }),
    ).toThrow(AdminToolsError);
    expect(() =>
      runVersionComparison({
        baseRaw: { foo: "bar" },
        headRaw: VALID_BASELINE,
      }),
    ).toThrow(/INVALID_BASELINE.*base/i);
  });

  it("INVALID_BASELINE si head raw n'est pas conforme", () => {
    expect(() =>
      runVersionComparison({
        baseRaw: VALID_BASELINE,
        headRaw: null,
      }),
    ).toThrow(/INVALID_BASELINE.*head/i);
  });

  it("propage warnThreshold et criticalThreshold", () => {
    const headWithDrift = {
      ...VALID_BASELINE,
      pairings: [
        {
          ...VALID_BASELINE.pairings[0],
          expected: {
            ...VALID_BASELINE.pairings[0].expected,
            tdMean: 2.7, // +12.5% vs 2.4
          },
        },
      ],
    };
    const out = runVersionComparison({
      baseRaw: VALID_BASELINE,
      headRaw: headWithDrift,
      warnThreshold: 0.1,
      criticalThreshold: 0.2,
    });
    expect(out.summary.warnCount).toBe(1);
  });
});

describe("runReplayDiff — Lot 4.F", () => {
  it("MATCH_NOT_FOUND si l'id A n'existe pas", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValueOnce(null);
    await expect(
      runReplayDiff({ matchIdA: "missing", matchIdB: "ok" }),
    ).rejects.toMatchObject({ code: "MATCH_NOT_FOUND" });
  });

  it("REPLAY_NOT_FOUND si l'un des matchs n'a pas de replay", async () => {
    mocked.proLeagueMatch.findUnique
      .mockResolvedValueOnce({ id: "a", engineVer: "0.16.0" })
      .mockResolvedValueOnce({ id: "b", engineVer: "0.16.0" });
    mocked.replay.findUnique
      .mockResolvedValueOnce({ payload: Buffer.from([]) })
      .mockResolvedValueOnce(null);
    await expect(
      runReplayDiff({ matchIdA: "a", matchIdB: "b" }),
    ).rejects.toMatchObject({ code: "REPLAY_NOT_FOUND" });
  });

  it("retourne un ReplayDiffResult quand les deux replays existent", async () => {
    mocked.proLeagueMatch.findUnique
      .mockResolvedValueOnce({ id: "a", engineVer: "0.15.0" })
      .mockResolvedValueOnce({ id: "b", engineVer: "0.16.0" });
    mocked.replay.findUnique
      .mockResolvedValueOnce({ payload: Buffer.from([1]) })
      .mockResolvedValueOnce({ payload: Buffer.from([2]) });
    const eventsA = [
      {
        type: "KICKOFF",
        displayAtMs: 0,
        engineVer: "0.15.0",
        meta: {},
      },
      { type: "TD", displayAtMs: 1000, engineVer: "0.15.0", meta: {} },
    ];
    const eventsB = [
      {
        type: "KICKOFF",
        displayAtMs: 0,
        engineVer: "0.16.0",
        meta: {},
      },
      { type: "TURNOVER", displayAtMs: 1000, engineVer: "0.16.0", meta: {} },
    ];
    mockedDecompress
      .mockResolvedValueOnce(eventsA as never)
      .mockResolvedValueOnce(eventsB as never);

    const out = await runReplayDiff({ matchIdA: "a", matchIdB: "b" });
    expect(out.diff.summary.totalA).toBe(2);
    expect(out.diff.summary.totalB).toBe(2);
    expect(out.diff.summary.divergenceCount).toBeGreaterThan(0);
    expect(out.matchA).toMatchObject({ id: "a", engineVer: "0.15.0" });
    expect(out.matchB).toMatchObject({ id: "b", engineVer: "0.16.0" });
  });

  it("rejette si matchIdA === matchIdB", async () => {
    await expect(
      runReplayDiff({ matchIdA: "x", matchIdB: "x" }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
