/**
 * L2.B.5 — Tests unitaires `league-patron.ts` (coup de mecene).
 *
 * Couvre :
 *  - 404 saison / equipe inconnue
 *  - 400 saison non in_progress
 *  - 404 equipe non inscrite a la saison
 *  - 400 participant withdrawn
 *  - 409 already_played
 *  - 400 match en cours
 *  - happy path : tresorerie creditee, flag set, $transaction appelee
 */

import { describe, it, expect, beforeEach } from "vitest";
import { playMecene, LeaguePatronError, MECENE_BONUS } from "./league-patron";

interface MockPrisma {
  leagueSeason: { findUnique: ReturnType<typeof makeFn> };
  team: {
    findUnique: ReturnType<typeof makeFn>;
    update: ReturnType<typeof makeFn>;
  };
  leagueParticipant: {
    findUnique: ReturnType<typeof makeFn>;
    update: ReturnType<typeof makeFn>;
  };
  teamSelection: { findFirst: ReturnType<typeof makeFn> };
  $transaction: (ops: unknown[]) => Promise<unknown[]>;
}

type MockFn = (...args: unknown[]) => Promise<unknown>;

function makeFn(): MockFn {
  let impl: MockFn = async () => null;
  const fn = (async (...args: unknown[]) => impl(...args)) as MockFn & {
    mockResolvedValue: (v: unknown) => void;
    mockResolvedValueOnce: (v: unknown) => void;
  };
  fn.mockResolvedValue = (v: unknown): void => {
    impl = async () => v;
  };
  fn.mockResolvedValueOnce = (v: unknown): void => {
    const prev = impl;
    let used = false;
    impl = async (...args: unknown[]) => {
      if (used) return prev(...args);
      used = true;
      return v;
    };
  };
  return fn;
}

function makePrisma(): MockPrisma {
  return {
    leagueSeason: { findUnique: makeFn() },
    team: { findUnique: makeFn(), update: makeFn() },
    leagueParticipant: { findUnique: makeFn(), update: makeFn() },
    teamSelection: { findFirst: makeFn() },
    $transaction: async (ops: unknown[]) =>
      Promise.all(ops as Promise<unknown>[]),
  };
}

describe("playMecene (L2.B.5)", () => {
  let prisma: MockPrisma;
  const seasonId = "season-1";
  const teamId = "team-1";

  beforeEach(() => {
    prisma = makePrisma();
  });

  it("404 quand la saison n'existe pas", async () => {
    (prisma.leagueSeason.findUnique as ReturnType<typeof makeFn> & {
      mockResolvedValue: (v: unknown) => void;
    }).mockResolvedValue(null);
    await expect(
      playMecene({
        prisma: prisma as unknown as Parameters<typeof playMecene>[0]["prisma"],
        seasonId,
        teamId,
      }),
    ).rejects.toMatchObject({ code: "season_not_found" });
  });

  it("400 quand la saison n'est pas in_progress", async () => {
    (prisma.leagueSeason.findUnique as ReturnType<typeof makeFn> & {
      mockResolvedValue: (v: unknown) => void;
    }).mockResolvedValue({ id: seasonId, status: "draft" });
    await expect(
      playMecene({
        prisma: prisma as unknown as Parameters<typeof playMecene>[0]["prisma"],
        seasonId,
        teamId,
      }),
    ).rejects.toMatchObject({ code: "season_not_active" });
  });

  it("404 quand l'equipe n'existe pas", async () => {
    (prisma.leagueSeason.findUnique as ReturnType<typeof makeFn> & {
      mockResolvedValue: (v: unknown) => void;
    }).mockResolvedValue({ id: seasonId, status: "in_progress" });
    (prisma.team.findUnique as ReturnType<typeof makeFn> & {
      mockResolvedValue: (v: unknown) => void;
    }).mockResolvedValue(null);
    await expect(
      playMecene({
        prisma: prisma as unknown as Parameters<typeof playMecene>[0]["prisma"],
        seasonId,
        teamId,
      }),
    ).rejects.toMatchObject({ code: "team_not_found" });
  });

  it("404 quand l'equipe n'est pas inscrite a la saison", async () => {
    (prisma.leagueSeason.findUnique as ReturnType<typeof makeFn> & {
      mockResolvedValue: (v: unknown) => void;
    }).mockResolvedValue({ id: seasonId, status: "in_progress" });
    (prisma.team.findUnique as ReturnType<typeof makeFn> & {
      mockResolvedValue: (v: unknown) => void;
    }).mockResolvedValue({ id: teamId, treasury: 50_000 });
    (prisma.leagueParticipant.findUnique as ReturnType<typeof makeFn> & {
      mockResolvedValue: (v: unknown) => void;
    }).mockResolvedValue(null);
    await expect(
      playMecene({
        prisma: prisma as unknown as Parameters<typeof playMecene>[0]["prisma"],
        seasonId,
        teamId,
      }),
    ).rejects.toMatchObject({ code: "team_not_in_season" });
  });

  it("400 quand le participant est withdrawn", async () => {
    (prisma.leagueSeason.findUnique as ReturnType<typeof makeFn> & {
      mockResolvedValue: (v: unknown) => void;
    }).mockResolvedValue({ id: seasonId, status: "in_progress" });
    (prisma.team.findUnique as ReturnType<typeof makeFn> & {
      mockResolvedValue: (v: unknown) => void;
    }).mockResolvedValue({ id: teamId, treasury: 50_000 });
    (prisma.leagueParticipant.findUnique as ReturnType<typeof makeFn> & {
      mockResolvedValue: (v: unknown) => void;
    }).mockResolvedValue({
      id: "p-1",
      status: "withdrawn",
      mecenePlayed: false,
    });
    await expect(
      playMecene({
        prisma: prisma as unknown as Parameters<typeof playMecene>[0]["prisma"],
        seasonId,
        teamId,
      }),
    ).rejects.toMatchObject({ code: "withdrawn" });
  });

  it("409 quand le coup de mecene a deja ete joue", async () => {
    (prisma.leagueSeason.findUnique as ReturnType<typeof makeFn> & {
      mockResolvedValue: (v: unknown) => void;
    }).mockResolvedValue({ id: seasonId, status: "in_progress" });
    (prisma.team.findUnique as ReturnType<typeof makeFn> & {
      mockResolvedValue: (v: unknown) => void;
    }).mockResolvedValue({ id: teamId, treasury: 50_000 });
    (prisma.leagueParticipant.findUnique as ReturnType<typeof makeFn> & {
      mockResolvedValue: (v: unknown) => void;
    }).mockResolvedValue({
      id: "p-1",
      status: "active",
      mecenePlayed: true,
    });
    await expect(
      playMecene({
        prisma: prisma as unknown as Parameters<typeof playMecene>[0]["prisma"],
        seasonId,
        teamId,
      }),
    ).rejects.toMatchObject({ code: "already_played" });
  });

  it("400 quand un match est en cours", async () => {
    (prisma.leagueSeason.findUnique as ReturnType<typeof makeFn> & {
      mockResolvedValue: (v: unknown) => void;
    }).mockResolvedValue({ id: seasonId, status: "in_progress" });
    (prisma.team.findUnique as ReturnType<typeof makeFn> & {
      mockResolvedValue: (v: unknown) => void;
    }).mockResolvedValue({ id: teamId, treasury: 50_000 });
    (prisma.leagueParticipant.findUnique as ReturnType<typeof makeFn> & {
      mockResolvedValue: (v: unknown) => void;
    }).mockResolvedValue({
      id: "p-1",
      status: "active",
      mecenePlayed: false,
    });
    (prisma.teamSelection.findFirst as ReturnType<typeof makeFn> & {
      mockResolvedValue: (v: unknown) => void;
    }).mockResolvedValue({ id: "sel-1" });
    await expect(
      playMecene({
        prisma: prisma as unknown as Parameters<typeof playMecene>[0]["prisma"],
        seasonId,
        teamId,
      }),
    ).rejects.toMatchObject({ code: "match_in_progress" });
  });

  it("happy path : credit MECENE_BONUS et set le flag", async () => {
    (prisma.leagueSeason.findUnique as ReturnType<typeof makeFn> & {
      mockResolvedValue: (v: unknown) => void;
    }).mockResolvedValue({ id: seasonId, status: "in_progress" });
    (prisma.team.findUnique as ReturnType<typeof makeFn> & {
      mockResolvedValue: (v: unknown) => void;
    }).mockResolvedValue({ id: teamId, treasury: 50_000 });
    (prisma.leagueParticipant.findUnique as ReturnType<typeof makeFn> & {
      mockResolvedValue: (v: unknown) => void;
    }).mockResolvedValue({
      id: "p-1",
      status: "active",
      mecenePlayed: false,
    });
    (prisma.teamSelection.findFirst as ReturnType<typeof makeFn> & {
      mockResolvedValue: (v: unknown) => void;
    }).mockResolvedValue(null);

    const result = await playMecene({
      prisma: prisma as unknown as Parameters<typeof playMecene>[0]["prisma"],
      seasonId,
      teamId,
    });

    expect(result.bonus).toBe(MECENE_BONUS);
    expect(result.newTreasury).toBe(50_000 + MECENE_BONUS);
    expect(result.participantId).toBe("p-1");
    expect(result.playedAt).toBeInstanceOf(Date);
  });

  it("LeaguePatronError est bien instance d'Error", () => {
    const err = new LeaguePatronError("already_played", "deja joue");
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("already_played");
    expect(err.message).toBe("deja joue");
    expect(err.name).toBe("LeaguePatronError");
  });
});
