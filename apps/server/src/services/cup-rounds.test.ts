/**
 * Rondes suisses de coupe — service : autorisation, préconditions
 * (coupe en cours, ≥ 2 inscrits, ronde précédente terminée), génération
 * (classement -> moteur pur -> ronde + rencontres + exempt), exempts au
 * classement, cycle d'une rencontre (rattachement / clôture / libération).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    cup: { findUnique: vi.fn() },
    cupRound: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    cupPairing: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    localMatch: { findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("./in-app-notifications", () => ({
  createInAppNotification: vi.fn(async () => ({ id: "n" })),
}));

import { prisma } from "../prisma";
import { createInAppNotification } from "./in-app-notifications";
import {
  attachLocalMatchToCupPairing,
  cancelCupPairing,
  cupByesByTeamId,
  deleteLastCupRound,
  detachLocalMatchFromCupPairing,
  generateSwissCupRound,
  resolveCupPairingForMatch,
  scheduleCupPairing,
  settleCupPairingForLocalMatch,
  CupRoundError,
} from "./cup-rounds";

type MockFn = ReturnType<typeof vi.fn>;
const m = {
  cupFind: prisma.cup.findUnique as unknown as MockFn,
  roundFindUnique: prisma.cupRound.findUnique as unknown as MockFn,
  roundFindFirst: prisma.cupRound.findFirst as unknown as MockFn,
  roundCreate: prisma.cupRound.create as unknown as MockFn,
  roundUpdate: prisma.cupRound.update as unknown as MockFn,
  roundUpdateMany: prisma.cupRound.updateMany as unknown as MockFn,
  roundDelete: prisma.cupRound.delete as unknown as MockFn,
  pairingFindUnique: prisma.cupPairing.findUnique as unknown as MockFn,
  pairingFindFirst: prisma.cupPairing.findFirst as unknown as MockFn,
  pairingCreateMany: prisma.cupPairing.createMany as unknown as MockFn,
  pairingUpdate: prisma.cupPairing.update as unknown as MockFn,
  pairingUpdateMany: prisma.cupPairing.updateMany as unknown as MockFn,
  pairingCount: prisma.cupPairing.count as unknown as MockFn,
  matchFind: prisma.localMatch.findUnique as unknown as MockFn,
  matchUpdate: prisma.localMatch.update as unknown as MockFn,
  tx: prisma.$transaction as unknown as MockFn,
  notify: createInAppNotification as unknown as MockFn,
};

const COMMISH = { userId: "commish", isAdmin: false };
const ADMIN = { userId: "admin", isAdmin: true };
const STRANGER = { userId: "someone", isAdmin: false };

const team = (id: string, ownerId = `owner-${id}`) => ({
  id,
  name: `Team ${id}`,
  roster: "orc",
  logoUrl: null,
  ownerId,
  owner: { coachName: `Coach ${id}` },
});

function cupHeader(overrides: Record<string, unknown> = {}) {
  return {
    id: "cup-1",
    name: "Swiss Cup",
    creatorId: "commish",
    status: "en_cours",
    validated: true,
    ...overrides,
  };
}

function cupFull(teamIds: string[], rounds: unknown[] = [], localMatches: unknown[] = []) {
  return {
    id: "cup-1",
    name: "Swiss Cup",
    winPoints: 1000,
    drawPoints: 400,
    lossPoints: 0,
    forfeitPoints: -100,
    touchdownPoints: 5,
    blockCasualtyPoints: 3,
    foulCasualtyPoints: 2,
    passPoints: 2,
    // `poolId: null` = coupe sans poules : l'appariement porte sur toute la
    // coupe, comportement historique.
    participants: teamIds.map((id) => ({
      poolId: null,
      team: { id, name: `Team ${id}`, roster: "orc", logoUrl: null },
    })),
    pools: [],
    localMatches,
    rounds,
  };
}

function roundRow(id: string, roundNumber: number, pairings: unknown[]) {
  return {
    id,
    roundNumber,
    name: `Ronde ${roundNumber}`,
    system: "swiss",
    status: "completed",
    scheduledAt: null,
    createdAt: new Date("2026-09-01T10:00:00Z"),
    pairings,
  };
}

function pairingRow(
  id: string,
  home: string,
  away: string | null,
  status: string,
  tableNumber = 1,
) {
  return {
    id,
    tableNumber,
    status,
    scheduledAt: null,
    homeTeam: team(home),
    awayTeam: away ? team(away) : null,
    localMatch: null,
  };
}

describe("cupByesByTeamId (pur)", () => {
  it("compte les exempts par équipe", () => {
    const out = cupByesByTeamId([
      { pairings: [{ status: "bye", homeTeam: { id: "c" }, awayTeam: null }] },
      { pairings: [{ status: "bye", homeTeam: { id: "c" }, awayTeam: null }, { status: "played", homeTeam: { id: "a" }, awayTeam: { id: "b" } }] },
    ]);
    expect(out).toEqual({ c: 2 });
  });
});

describe("generateSwissCupRound", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.tx.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma));
    m.roundCreate.mockResolvedValue({ id: "round-new" });
    m.pairingCreateMany.mockResolvedValue({ count: 0 });
    m.notify.mockResolvedValue({ id: "n" });
  });

  it("404 si la coupe n'existe pas, 403 pour un tiers", async () => {
    m.cupFind.mockResolvedValueOnce(null);
    await expect(generateSwissCupRound({ cupId: "x", actor: COMMISH })).rejects.toMatchObject({ code: "cup_not_found" });
    m.cupFind.mockResolvedValueOnce(cupHeader());
    await expect(generateSwissCupRound({ cupId: "cup-1", actor: STRANGER })).rejects.toMatchObject({ code: "forbidden" });
  });

  it("refuse une coupe ouverte aux inscriptions ou terminée", async () => {
    m.cupFind.mockResolvedValueOnce(cupHeader({ status: "ouverte", validated: false }));
    await expect(generateSwissCupRound({ cupId: "cup-1", actor: COMMISH })).rejects.toMatchObject({ code: "cup_not_started" });
    m.cupFind.mockResolvedValueOnce(cupHeader({ status: "terminee" }));
    await expect(generateSwissCupRound({ cupId: "cup-1", actor: COMMISH })).rejects.toMatchObject({ code: "cup_closed" });
  });

  it("refuse moins de deux inscrits", async () => {
    m.cupFind.mockResolvedValueOnce(cupHeader()).mockResolvedValueOnce(cupFull(["a"]));
    await expect(generateSwissCupRound({ cupId: "cup-1", actor: COMMISH })).rejects.toMatchObject({ code: "not_enough_participants" });
  });

  it("refuse tant que la ronde précédente a une rencontre ouverte", async () => {
    m.cupFind
      .mockResolvedValueOnce(cupHeader())
      .mockResolvedValueOnce(
        cupFull(["a", "b", "c", "d"], [roundRow("r1", 1, [pairingRow("p1", "a", "b", "played"), pairingRow("p2", "c", "d", "in_progress", 2)])]),
      );
    await expect(generateSwissCupRound({ cupId: "cup-1", actor: COMMISH })).rejects.toMatchObject({ code: "round_in_progress" });
    expect(m.roundCreate).not.toHaveBeenCalled();
  });

  it("première ronde : 5 inscrits -> 2 rencontres + 1 exempt, coachs notifiés", async () => {
    m.cupFind
      .mockResolvedValueOnce(cupHeader())
      .mockResolvedValueOnce(cupFull(["a", "b", "c", "d", "e"]));
    m.roundFindUnique.mockResolvedValue(
      roundRow("round-new", 1, [
        pairingRow("np1", "a", "b", "scheduled", 1),
        pairingRow("np2", "c", "d", "scheduled", 2),
        pairingRow("np3", "e", null, "bye", 3),
      ]),
    );

    const view = await generateSwissCupRound({ cupId: "cup-1", actor: ADMIN });

    expect(m.roundCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ cupId: "cup-1", roundNumber: 1, system: "swiss", status: "pending" }),
      }),
    );
    const rows = m.pairingCreateMany.mock.calls[0][0].data as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(3);
    // Sans résultat, l'ordre d'inscription fait foi (départage par nom) :
    // a-b, c-d, et le dernier est exempt.
    expect(rows.filter((r) => r.status === "scheduled").map((r) => [r.homeTeamId, r.awayTeamId])).toEqual([["a", "b"], ["c", "d"]]);
    expect(rows.find((r) => r.status === "bye")).toMatchObject({ homeTeamId: "e", awayTeamId: null, tableNumber: 3 });
    expect(view.roundNumber).toBe(1);
    expect(view.pairings).toHaveLength(3);
    // 2 coachs par rencontre + 1 exempt.
    expect(m.notify).toHaveBeenCalledTimes(5);
    expect(m.notify.mock.calls.every((c) => c[0].kind === "cup.round_pairing")).toBe(true);
  });

  it("ronde suivante : classement d'abord, pas de rematch, l'exempt tourne", async () => {
    const r1 = roundRow("r1", 1, [
      pairingRow("p1", "a", "b", "played", 1),
      pairingRow("p2", "c", "d", "played", 2),
      pairingRow("p3", "e", null, "bye", 3),
    ]);
    const matches = [
      { id: "m1", status: "completed", teamA: { id: "a", name: "A", roster: "orc" }, teamB: { id: "b", name: "B", roster: "orc" }, scoreTeamA: 2, scoreTeamB: 0, actions: [] },
      { id: "m2", status: "completed", teamA: { id: "c", name: "C", roster: "orc" }, teamB: { id: "d", name: "D", roster: "orc" }, scoreTeamA: 1, scoreTeamB: 0, actions: [] },
    ];
    m.cupFind.mockResolvedValueOnce(cupHeader()).mockResolvedValueOnce(cupFull(["a", "b", "c", "d", "e"], [r1], matches));
    m.roundFindUnique.mockResolvedValue(roundRow("round-new", 2, []));

    await generateSwissCupRound({ cupId: "cup-1", actor: COMMISH });

    const rows = m.pairingCreateMany.mock.calls[0][0].data as Array<Record<string, unknown>>;
    // Classement : a (1010) > e (exempt 1000) > c (1005)? Non : c = 1000 + 5 = 1005,
    // a = 1000 + 10 = 1010, e = 1000 (exempt, sans TD), b et d = 0.
    // Vainqueurs entre eux (a-c), e contre le suivant, l'exempt va au
    // dernier non encore exempté.
    const played = rows.filter((r) => r.status === "scheduled").map((r) => `${r.homeTeamId}-${r.awayTeamId}`);
    expect(played).toContain("a-c");
    expect(played.some((p) => p === "a-b" || p === "b-a" || p === "c-d" || p === "d-c")).toBe(false);
    const bye = rows.find((r) => r.status === "bye");
    expect(bye).toBeTruthy();
    expect(bye!.homeTeamId).not.toBe("e");
    expect(m.roundCreate.mock.calls[0][0].data.roundNumber).toBe(2);
  });
});

describe("deleteLastCupRound", () => {
  beforeEach(() => vi.clearAllMocks());

  it("supprime la dernière ronde sans match", async () => {
    m.cupFind.mockResolvedValue(cupHeader());
    m.roundFindFirst.mockResolvedValue({ id: "r2", roundNumber: 2, pairings: [{ status: "scheduled", localMatch: null }] });
    const out = await deleteLastCupRound({ cupId: "cup-1", actor: COMMISH });
    expect(out).toEqual({ deleted: true, roundNumber: 2 });
    expect(m.roundDelete).toHaveBeenCalledWith({ where: { id: "r2" } });
  });

  it("refuse si un match a été créé ou joué", async () => {
    m.cupFind.mockResolvedValue(cupHeader());
    m.roundFindFirst.mockResolvedValue({ id: "r2", roundNumber: 2, pairings: [{ status: "in_progress", localMatch: { id: "lm" } }] });
    await expect(deleteLastCupRound({ cupId: "cup-1", actor: COMMISH })).rejects.toMatchObject({ code: "round_has_matches" });
    m.roundFindFirst.mockResolvedValue(null);
    await expect(deleteLastCupRound({ cupId: "cup-1", actor: COMMISH })).rejects.toMatchObject({ code: "round_not_found" });
  });
});

function pairingForActor(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    status: "scheduled",
    localMatch: null,
    homeTeamId: "a",
    awayTeamId: "b",
    homeTeam: { ownerId: "owner-a" },
    awayTeam: { ownerId: "owner-b" },
    round: { id: "r1", cupId: "cup-1", cup: { creatorId: "commish" } },
    ...overrides,
  };
}

describe("scheduleCupPairing / cancelCupPairing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("un coach impliqué pose la date, un tiers est refusé", async () => {
    m.pairingFindUnique.mockResolvedValue(pairingForActor());
    const date = new Date("2026-09-20T18:00:00Z");
    await scheduleCupPairing({ pairingId: "p1", actor: { userId: "owner-b", isAdmin: false }, scheduledAt: date });
    expect(m.pairingUpdate).toHaveBeenCalledWith({ where: { id: "p1" }, data: { scheduledAt: date }, select: { id: true } });
    await expect(
      scheduleCupPairing({ pairingId: "p1", actor: STRANGER, scheduledAt: date }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("refuse la date sur un exempt ou une rencontre terminée", async () => {
    m.pairingFindUnique.mockResolvedValue(pairingForActor({ status: "bye", awayTeamId: null, awayTeam: null }));
    await expect(scheduleCupPairing({ pairingId: "p1", actor: COMMISH, scheduledAt: null })).rejects.toMatchObject({ code: "pairing_bye" });
    m.pairingFindUnique.mockResolvedValue(pairingForActor({ status: "played" }));
    await expect(scheduleCupPairing({ pairingId: "p1", actor: COMMISH, scheduledAt: null })).rejects.toMatchObject({ code: "pairing_closed" });
  });

  it("le commissaire annule une rencontre, la ronde se complète si c'était la dernière", async () => {
    m.pairingFindUnique.mockResolvedValue(pairingForActor());
    m.pairingCount.mockResolvedValue(0);
    const out = await cancelCupPairing({ pairingId: "p1", actor: COMMISH });
    expect(out).toEqual({ pairingId: "p1", status: "cancelled", roundCompleted: true });
    expect(m.roundUpdate).toHaveBeenCalledWith({ where: { id: "r1" }, data: { status: "completed" }, select: { id: true } });
  });

  it("l'annulation est réservée au commissaire et refusée avec un match existant", async () => {
    m.pairingFindUnique.mockResolvedValue(pairingForActor());
    await expect(cancelCupPairing({ pairingId: "p1", actor: { userId: "owner-a", isAdmin: false } })).rejects.toBeInstanceOf(CupRoundError);
    m.pairingFindUnique.mockResolvedValue(pairingForActor({ status: "in_progress", localMatch: { id: "lm" } }));
    await expect(cancelCupPairing({ pairingId: "p1", actor: COMMISH })).rejects.toMatchObject({ code: "pairing_has_match" });
  });
});

describe("cycle d'une rencontre (match local)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("résout la coupe et exige les deux équipes de la rencontre", async () => {
    m.pairingFindUnique.mockResolvedValue(pairingForActor());
    await expect(resolveCupPairingForMatch({ pairingId: "p1", teamAId: "b", teamBId: "a" })).resolves.toEqual({ cupId: "cup-1", pairingId: "p1" });
    await expect(resolveCupPairingForMatch({ pairingId: "p1", teamAId: "a", teamBId: "z" })).rejects.toMatchObject({ code: "team_mismatch" });
    await expect(resolveCupPairingForMatch({ pairingId: "p1", teamAId: "a", teamBId: "b", cupId: "other" })).rejects.toMatchObject({ code: "team_mismatch" });
    m.pairingFindUnique.mockResolvedValue(pairingForActor({ status: "in_progress", localMatch: { id: "lm" } }));
    await expect(resolveCupPairingForMatch({ pairingId: "p1", teamAId: "a", teamBId: "b" })).rejects.toMatchObject({ code: "pairing_has_match" });
  });

  it("passe la rencontre « match en cours » conditionnellement et ouvre la ronde", async () => {
    m.pairingUpdateMany.mockResolvedValueOnce({ count: 1 });
    m.pairingFindUnique.mockResolvedValue({ roundId: "r1" });
    expect(await attachLocalMatchToCupPairing({ pairingId: "p1" })).toBe(true);
    expect(m.pairingUpdateMany).toHaveBeenCalledWith({
      where: { id: "p1", status: "scheduled" },
      data: { status: "in_progress" },
    });
    expect(m.roundUpdateMany).toHaveBeenCalledWith({ where: { id: "r1", status: "pending" }, data: { status: "in_progress" } });
    // La rencontre n'etait plus a jouer (annulee entre-temps).
    m.pairingUpdateMany.mockResolvedValueOnce({ count: 0 });
    expect(await attachLocalMatchToCupPairing({ pairingId: "p1" })).toBe(false);
  });

  it("clôt la rencontre à la fin du match et libère la rencontre à l'annulation", async () => {
    m.matchFind.mockResolvedValue({ cupPairingId: "p1" });
    m.pairingFindUnique.mockResolvedValue({ id: "p1", roundId: "r1", status: "in_progress" });
    m.pairingCount.mockResolvedValue(0);
    expect(await settleCupPairingForLocalMatch("lm")).toEqual({ settled: true, roundCompleted: true });
    expect(m.pairingUpdate).toHaveBeenCalledWith({ where: { id: "p1" }, data: { status: "played" }, select: { id: true } });

    expect(await detachLocalMatchFromCupPairing("lm")).toBe(true);
    expect(m.matchUpdate).toHaveBeenCalledWith({ where: { id: "lm" }, data: { cupPairingId: null }, select: { id: true } });
    expect(m.pairingUpdate).toHaveBeenLastCalledWith({ where: { id: "p1" }, data: { status: "scheduled" }, select: { id: true } });
    expect(m.roundUpdateMany).toHaveBeenLastCalledWith({ where: { id: "r1", status: "completed" }, data: { status: "in_progress" } });

    // Match sans rencontre : rien a faire.
    m.matchFind.mockResolvedValue({ cupPairingId: null });
    expect(await settleCupPairingForLocalMatch("orphan")).toEqual({ settled: false, roundCompleted: false });
  });
});
