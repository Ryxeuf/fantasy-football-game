import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    cup: { findUnique: vi.fn(), update: vi.fn() },
    cupRound: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    cupPairing: {
      count: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    cupParticipant: { findMany: vi.fn() },
    cupPool: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

// Le classement est déjà couvert par ses propres suites : on ne re-teste pas
// ses règles ici, on vérifie que le bracket consomme le bon ordre.
vi.mock("../cupScoring", () => ({ computeCupStandings: vi.fn() }));
vi.mock("./cup-rounds", () => ({
  listCupRounds: vi.fn(async () => []),
  cupByesByTeamId: vi.fn(() => ({})),
}));

import { prisma } from "../prisma";
import { computeCupStandings } from "../cupScoring";
import {
  advanceCupPlayoffs,
  bracketSlotLabel,
  CupPlayoffError,
  getCupBracket,
  isCupBracketVisible,
  visibleCupRounds,
  overrideCupPlayoffSeeds,
  setCupPlayoffsPublished,
  startCupPlayoffs,
} from "./cup-playoffs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;
const COMMISH = { userId: "u-com", isAdmin: false };
const STRANGER = { userId: "u-x", isAdmin: false };

const CUP = {
  id: "cup-1",
  creatorId: "u-com",
  status: "en_cours",
  playoffSize: 4,
  playoffsPublished: null,
};

function standings(teamIds: string[]) {
  return { teamStats: teamIds.map((teamId) => ({ teamId })) };
}

async function expectRefusal(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toMatchObject({ code });
}

beforeEach(() => {
  vi.resetAllMocks();
  // `loadCup` lit l'en-tete (select), `resolveSeeds` la coupe complete
  // (include) : le mock par defaut sert la forme demandee.
  mockPrisma.cup.findUnique.mockImplementation(
    async (args: { include?: unknown }) =>
      args?.include
        ? { ...CUP, participants: [], pools: [], localMatches: [] }
        : CUP,
  );
  mockPrisma.cupRound.count.mockResolvedValue(0);
  mockPrisma.cupPairing.findMany.mockResolvedValue([]);
  mockPrisma.cupRound.aggregate.mockResolvedValue({
    _max: { roundNumber: 5 },
  });
  mockPrisma.cupRound.create.mockResolvedValue({ id: "r-new" });
  mockPrisma.cup.update.mockResolvedValue({});
  vi.mocked(computeCupStandings).mockReturnValue(
    standings(["t1", "t2", "t3", "t4", "t5"]) as never,
  );
});

describe("visibleCupRounds", () => {
  const ROUNDS = [
    { id: "r1", kind: "regular" },
    { id: "r2", kind: "playoff" },
    { id: "r3" }, // ronde antérieure à la colonne : `kind` absent
  ];

  it("masque le bracket non publié au coach — sinon les têtes fuitent", () => {
    expect(
      visibleCupRounds(ROUNDS, {
        isCommissioner: false,
        playoffsPublished: false,
      }).map((r) => r.id),
    ).toEqual(["r1", "r3"]);
  });

  it("le montre au commissaire, publié ou non", () => {
    expect(
      visibleCupRounds(ROUNDS, {
        isCommissioner: true,
        playoffsPublished: false,
      }),
    ).toHaveLength(3);
  });

  it("le montre à tous une fois publié", () => {
    expect(
      visibleCupRounds(ROUNDS, {
        isCommissioner: false,
        playoffsPublished: true,
      }),
    ).toHaveLength(3);
  });

  it("`null` (coupe antérieure à la colonne) reste VISIBLE — aucun backfill possible", () => {
    expect(
      visibleCupRounds(ROUNDS, {
        isCommissioner: false,
        playoffsPublished: null,
      }),
    ).toHaveLength(3);
  });

  it("ne mute pas la liste reçue", () => {
    const out = visibleCupRounds(ROUNDS, {
      isCommissioner: true,
      playoffsPublished: null,
    });
    expect(out).not.toBe(ROUNDS);
    expect(ROUNDS).toHaveLength(3);
  });
});

describe("bracketSlotLabel", () => {
  it("nomme chaque tour en clair", () => {
    expect(bracketSlotLabel("final")).toBe("Finale");
    expect(bracketSlotLabel("sf2")).toBe("Demi-finale 2");
    expect(bracketSlotLabel("qf3")).toBe("Quart de finale 3");
    expect(bracketSlotLabel("inconnu")).toBe("inconnu");
  });
});

describe("startCupPlayoffs", () => {
  it("crée une ronde PAR SLOT, numérotées à la suite du classement", async () => {
    const out = await startCupPlayoffs({ cupId: "cup-1", actor: COMMISH });

    expect(out).toEqual({ created: true, roundsCreated: 2, pairingsCreated: 2 });
    const created = mockPrisma.cupRound.create.mock.calls.map(
      (c: unknown[]) => (c[0] as { data: Record<string, unknown> }).data,
    );
    expect(created.map((d) => d.bracketSlot)).toEqual(["sf1", "sf2"]);
    expect(created.map((d) => d.roundNumber)).toEqual([6, 7]);
    expect(created.every((d) => d.kind === "playoff")).toBe(true);
  });

  it("croise les têtes de série (1v4, 2v3)", async () => {
    await startCupPlayoffs({ cupId: "cup-1", actor: COMMISH });
    const pairings = mockPrisma.cupPairing.create.mock.calls.map(
      (c: unknown[]) => (c[0] as { data: Record<string, unknown> }).data,
    );
    expect(pairings.map((p) => [p.homeTeamId, p.awayTeamId])).toEqual([
      ["t1", "t4"],
      ["t2", "t3"],
    ]);
  });

  it("génère SANS publier : le commissaire corrige les seeds d'abord", async () => {
    await startCupPlayoffs({ cupId: "cup-1", actor: COMMISH });
    expect(mockPrisma.cup.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { playoffsPublished: false } }),
    );
  });

  it("refuse tant qu'une rencontre de classement est ouverte", async () => {
    mockPrisma.cupPairing.findMany.mockResolvedValue([{ id: "p1" }]);
    await expectRefusal(
      () => startCupPlayoffs({ cupId: "cup-1", actor: COMMISH }),
      "regular_rounds_open",
    );
    expect(mockPrisma.cupRound.create).not.toHaveBeenCalled();
  });

  it("`force` annule les rencontres restantes — et seulement APRÈS un seeding réussi", async () => {
    mockPrisma.cupPairing.findMany.mockResolvedValue([{ id: "p1" }]);
    await startCupPlayoffs({ cupId: "cup-1", actor: COMMISH, force: true });
    expect(mockPrisma.cupPairing.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["p1"] } },
      data: { status: "cancelled" },
    });
  });

  it("n'annule rien quand le seeding échoue", async () => {
    mockPrisma.cupPairing.findMany.mockResolvedValue([{ id: "p1" }]);
    vi.mocked(computeCupStandings).mockReturnValue(standings(["t1"]) as never);
    await expectRefusal(
      () => startCupPlayoffs({ cupId: "cup-1", actor: COMMISH, force: true }),
      "insufficient_participants",
    );
    expect(mockPrisma.cupPairing.updateMany).not.toHaveBeenCalled();
  });

  it("refuse une seconde génération", async () => {
    mockPrisma.cupRound.count.mockResolvedValue(2);
    await expectRefusal(
      () => startCupPlayoffs({ cupId: "cup-1", actor: COMMISH }),
      "playoffs_already_started",
    );
  });

  it("refuse sans taille de bracket", async () => {
    mockPrisma.cup.findUnique.mockResolvedValue({ ...CUP, playoffSize: 0 });
    await expectRefusal(
      () => startCupPlayoffs({ cupId: "cup-1", actor: COMMISH }),
      "playoffs_disabled",
    );
  });

  it("réserve la génération au commissaire", async () => {
    await expectRefusal(
      () => startCupPlayoffs({ cupId: "cup-1", actor: STRANGER }),
      "forbidden",
    );
  });

  it("seede depuis les QUOTAS DE POULE quand la coupe en déclare", async () => {
    mockPrisma.cup.findUnique.mockImplementation((args: { include?: unknown }) =>
      args.include
        ? {
            ...CUP,
            participants: [
              { poolId: "A", team: { id: "t1" } },
              { poolId: "A", team: { id: "t3" } },
              { poolId: "B", team: { id: "t2" } },
              { poolId: "B", team: { id: "t4" } },
            ],
            pools: [
              { id: "A", name: "A", order: 0, qualifiesForPlayoffs: 2 },
              { id: "B", name: "B", order: 1, qualifiesForPlayoffs: 2 },
            ],
            localMatches: [],
          }
        : CUP,
    );
    await startCupPlayoffs({ cupId: "cup-1", actor: COMMISH });
    const pairings = mockPrisma.cupPairing.create.mock.calls.map(
      (c: unknown[]) => (c[0] as { data: Record<string, unknown> }).data,
    );
    // Ordre serpentin : 1ers de poule, puis 2es — donc t1, t2, t3, t4, et le
    // croisement 1v4 / 2v3 évite un duel intra-poule au premier tour.
    expect(pairings.map((p) => [p.homeTeamId, p.awayTeamId])).toEqual([
      ["t1", "t4"],
      ["t2", "t3"],
    ]);
  });

  it("refuse des quotas de poule incohérents avec la taille du bracket", async () => {
    mockPrisma.cup.findUnique.mockImplementation((args: { include?: unknown }) =>
      args.include
        ? {
            ...CUP,
            participants: [{ poolId: "A", team: { id: "t1" } }],
            pools: [{ id: "A", name: "A", order: 0, qualifiesForPlayoffs: 1 }],
            localMatches: [],
          }
        : CUP,
    );
    await expectRefusal(
      () => startCupPlayoffs({ cupId: "cup-1", actor: COMMISH }),
      "pool_qualification_mismatch",
    );
  });
});

describe("advanceCupPlayoffs", () => {
  const PAIRING = {
    id: "p-sf1",
    round: { id: "r1", cupId: "cup-1", kind: "playoff", bracketSlot: "sf1" },
  };

  it("remplit le slot suivant quand le tour aval existe déjà", async () => {
    mockPrisma.cupPairing.findUnique.mockResolvedValue(PAIRING);
    mockPrisma.cupRound.findFirst.mockResolvedValue({
      id: "r-final",
      pairings: [{ id: "p-final" }],
    });

    await expect(
      advanceCupPlayoffs({ pairingId: "p-sf1", winnerTeamId: "t1" }),
    ).resolves.toEqual({ advanced: true, nextSlot: "final" });
    expect(mockPrisma.cupPairing.update).toHaveBeenCalledWith({
      where: { id: "p-final" },
      data: { homeTeamId: "t1" },
    });
    expect(mockPrisma.cupRound.create).not.toHaveBeenCalled();
  });

  it("crée le tour aval avec un placeholder quand il n'existe pas", async () => {
    mockPrisma.cupPairing.findUnique.mockResolvedValue(PAIRING);
    mockPrisma.cupRound.findFirst.mockResolvedValue(null);

    await advanceCupPlayoffs({ pairingId: "p-sf1", winnerTeamId: "t1" });

    const pairing = mockPrisma.cupPairing.create.mock.calls[0][0].data;
    // `home === away` encode « à déterminer » : la FK exige un vrai teamId.
    expect(pairing.homeTeamId).toBe("t1");
    expect(pairing.awayTeamId).toBe("t1");
    // Le numéro s'alloue sur le MAX de la coupe, jamais `round + 1` : viser le
    // numéro du tour frère ferait échouer la création en silence.
    expect(mockPrisma.cupRound.create.mock.calls[0][0].data.roundNumber).toBe(6);
  });

  it("place le vainqueur du bon côté", async () => {
    mockPrisma.cupPairing.findUnique.mockResolvedValue({
      ...PAIRING,
      round: { ...PAIRING.round, bracketSlot: "sf2" },
    });
    mockPrisma.cupRound.findFirst.mockResolvedValue({
      id: "r-final",
      pairings: [{ id: "p-final" }],
    });
    await advanceCupPlayoffs({ pairingId: "p-sf2", winnerTeamId: "t2" });
    expect(mockPrisma.cupPairing.update.mock.calls[0][0].data).toEqual({
      awayTeamId: "t2",
    });
  });

  it("ne fait rien après la finale, ni hors bracket, ni sur une rencontre inconnue", async () => {
    mockPrisma.cupPairing.findUnique.mockResolvedValue({
      ...PAIRING,
      round: { ...PAIRING.round, bracketSlot: "final" },
    });
    await expect(
      advanceCupPlayoffs({ pairingId: "p", winnerTeamId: "t1" }),
    ).resolves.toEqual({ advanced: false, reason: "no-next-round" });

    mockPrisma.cupPairing.findUnique.mockResolvedValue({
      ...PAIRING,
      round: { ...PAIRING.round, kind: "regular", bracketSlot: null },
    });
    await expect(
      advanceCupPlayoffs({ pairingId: "p", winnerTeamId: "t1" }),
    ).resolves.toEqual({ advanced: false, reason: "not-a-playoff-pairing" });

    mockPrisma.cupPairing.findUnique.mockResolvedValue(null);
    await expect(
      advanceCupPlayoffs({ pairingId: "p", winnerTeamId: "t1" }),
    ).resolves.toEqual({ advanced: false, reason: "pairing-missing" });
  });
});

describe("publication du bracket", () => {
  it("un bracket non publié est invisible ; `null` reste visible", () => {
    expect(isCupBracketVisible(false)).toBe(false);
    expect(isCupBracketVisible(true)).toBe(true);
    // Coupe antérieure à la colonne : ne pas la faire disparaître d'un coup.
    expect(isCupBracketVisible(null)).toBe(true);
    expect(isCupBracketVisible(undefined)).toBe(true);
  });

  it("publie et dépublie", async () => {
    mockPrisma.cupRound.count.mockResolvedValue(2);
    await expect(
      setCupPlayoffsPublished({
        cupId: "cup-1",
        actor: COMMISH,
        published: true,
      }),
    ).resolves.toEqual({ playoffsPublished: true });

    await expect(
      setCupPlayoffsPublished({
        cupId: "cup-1",
        actor: COMMISH,
        published: false,
      }),
    ).resolves.toEqual({ playoffsPublished: false });
  });

  it("refuse de publier un bracket inexistant", async () => {
    mockPrisma.cupRound.count.mockResolvedValue(0);
    await expectRefusal(
      () =>
        setCupPlayoffsPublished({
          cupId: "cup-1",
          actor: COMMISH,
          published: true,
        }),
      "playoffs_not_started",
    );
  });
});

describe("getCupBracket", () => {
  const ROUNDS = [
    {
      id: "r1",
      roundNumber: 6,
      bracketSlot: "sf1",
      name: "Demi-finale 1",
      status: "pending",
      pairings: [
        {
          id: "p1",
          status: "played",
          homeTeamId: "t1",
          awayTeamId: "t4",
          homeTeam: { id: "t1", name: "Alpha", roster: "orc", logoUrl: null },
          awayTeam: { id: "t4", name: "Delta", roster: "skaven", logoUrl: null },
          localMatch: {
            id: "m1",
            status: "completed",
            teamAId: "t4",
            scoreTeamA: 1,
            scoreTeamB: 3,
          },
        },
      ],
    },
  ];

  beforeEach(() => {
    mockPrisma.cupPairing.count.mockResolvedValue(0);
    mockPrisma.cupPool.findMany.mockResolvedValue([]);
    mockPrisma.cupRound.findMany.mockResolvedValue(ROUNDS);
  });

  it("oriente le score sur le DOMICILE de la rencontre", async () => {
    mockPrisma.cup.findUnique.mockResolvedValue({
      ...CUP,
      playoffsPublished: true,
    });
    const out = await getCupBracket({ cupId: "cup-1", viewerId: "u-any" });
    // Le match local a t4 en équipe A : 1-3 devient 3 – 1 côté domicile (t1).
    expect(out.rounds[0].scoreLabel).toBe("3 – 1");
    expect(out.rounds[0].homeTeam?.name).toBe("Alpha");
  });

  it("cache un bracket non publié aux coachs, sans même charger les rondes", async () => {
    mockPrisma.cup.findUnique.mockResolvedValue({
      ...CUP,
      playoffsPublished: false,
    });
    const out = await getCupBracket({ cupId: "cup-1", viewerId: "u-any" });
    expect(out.rounds).toEqual([]);
    expect(mockPrisma.cupRound.findMany).not.toHaveBeenCalled();
  });

  it("le sert au commissaire même non publié", async () => {
    mockPrisma.cup.findUnique.mockResolvedValue({
      ...CUP,
      playoffsPublished: false,
    });
    const out = await getCupBracket({ cupId: "cup-1", viewerId: "u-com" });
    expect(out.rounds).toHaveLength(1);
  });

  it("marque le placeholder et masque son adversaire", async () => {
    mockPrisma.cup.findUnique.mockResolvedValue({
      ...CUP,
      playoffsPublished: true,
    });
    mockPrisma.cupRound.findMany.mockResolvedValue([
      {
        ...ROUNDS[0],
        pairings: [
          {
            id: "p2",
            status: "scheduled",
            homeTeamId: "t1",
            awayTeamId: "t1",
            homeTeam: { id: "t1", name: "Alpha", roster: "orc", logoUrl: null },
            awayTeam: { id: "t1", name: "Alpha", roster: "orc", logoUrl: null },
            localMatch: null,
          },
        ],
      },
    ]);
    const out = await getCupBracket({ cupId: "cup-1", viewerId: "u-any" });
    expect(out.rounds[0].placeholder).toBe(true);
    expect(out.rounds[0].awayTeam).toBeNull();
  });

  it("signale des quotas de poule incohérents", async () => {
    mockPrisma.cup.findUnique.mockResolvedValue({
      ...CUP,
      playoffsPublished: true,
    });
    mockPrisma.cupPool.findMany.mockResolvedValue([
      { qualifiesForPlayoffs: 3 },
      { qualifiesForPlayoffs: 3 },
    ]);
    const out = await getCupBracket({ cupId: "cup-1", viewerId: "u-com" });
    expect(out.poolQualification).toEqual({
      totalQualified: 6,
      playoffSize: 4,
      consistent: false,
    });
  });
});

describe("overrideCupPlayoffSeeds", () => {
  beforeEach(() => {
    mockPrisma.cupParticipant.findMany.mockResolvedValue([
      { teamId: "t1" },
      { teamId: "t2" },
      { teamId: "t3" },
      { teamId: "t4" },
    ]);
    mockPrisma.cupRound.findMany.mockResolvedValue([
      { id: "r1", roundNumber: 6, bracketSlot: "sf1", pairings: [{ id: "p1", status: "scheduled", localMatch: null }] },
      { id: "r2", roundNumber: 7, bracketSlot: "sf2", pairings: [{ id: "p2", status: "scheduled", localMatch: null }] },
    ]);
    mockPrisma.$transaction.mockResolvedValue([]);
  });

  it("réécrit le bracket depuis les têtes de série fournies", async () => {
    const out = await overrideCupPlayoffSeeds({
      cupId: "cup-1",
      actor: COMMISH,
      teamIds: ["t4", "t3", "t2", "t1"],
    });
    expect(out).toEqual({ rebuilt: 2, slots: ["sf1", "sf2"] });
    const pairings = mockPrisma.cupPairing.create.mock.calls.map(
      (c: unknown[]) => (c[0] as { data: Record<string, unknown> }).data,
    );
    expect(pairings.map((p) => [p.homeTeamId, p.awayTeamId])).toEqual([
      ["t4", "t1"],
      ["t3", "t2"],
    ]);
    // Le bracket est reconstruit à partir du MÊME numéro de ronde qu'avant.
    expect(mockPrisma.cupRound.create.mock.calls[0][0].data.roundNumber).toBe(6);
  });

  it("refuse dès qu'une rencontre du bracket a commencé", async () => {
    mockPrisma.cupRound.findMany.mockResolvedValue([
      { id: "r1", roundNumber: 6, bracketSlot: "sf1", pairings: [{ id: "p1", status: "played", localMatch: null }] },
    ]);
    await expectRefusal(
      () =>
        overrideCupPlayoffSeeds({
          cupId: "cup-1",
          actor: COMMISH,
          teamIds: ["t1", "t2", "t3", "t4"],
        }),
      "playoffs_in_progress",
    );
  });

  it("refuse un nombre de têtes de série qui ne colle pas au bracket", async () => {
    await expectRefusal(
      () =>
        overrideCupPlayoffSeeds({
          cupId: "cup-1",
          actor: COMMISH,
          teamIds: ["t1", "t2"],
        }),
      "size_mismatch",
    );
  });

  it("refuse un doublon et une équipe non inscrite", async () => {
    await expectRefusal(
      () =>
        overrideCupPlayoffSeeds({
          cupId: "cup-1",
          actor: COMMISH,
          teamIds: ["t1", "t1", "t3", "t4"],
        }),
      "duplicate_team",
    );
    mockPrisma.cupParticipant.findMany.mockResolvedValue([{ teamId: "t1" }]);
    await expectRefusal(
      () =>
        overrideCupPlayoffSeeds({
          cupId: "cup-1",
          actor: COMMISH,
          teamIds: ["t1", "t2", "t3", "t4"],
        }),
      "team_not_in_cup",
    );
  });

  it("refuse avant toute génération", async () => {
    mockPrisma.cupRound.findMany.mockResolvedValue([]);
    await expectRefusal(
      () =>
        overrideCupPlayoffSeeds({
          cupId: "cup-1",
          actor: COMMISH,
          teamIds: ["t1", "t2", "t3", "t4"],
        }),
      "playoffs_not_started",
    );
  });
});

describe("CupPlayoffError", () => {
  it("porte son code", () => {
    const e = new CupPlayoffError("playoffs_disabled", "msg");
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe("playoffs_disabled");
  });
});
