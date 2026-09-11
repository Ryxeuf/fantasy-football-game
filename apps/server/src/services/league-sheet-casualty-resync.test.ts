/**
 * Resynchronisation des sorties d'une feuille validée : le plan (pur) et
 * son application (deltas sur participants, joueurs, bonus, snapshot).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    leagueMatchSheet: { findUnique: vi.fn() },
    match: { findFirst: vi.fn(), update: vi.fn() },
    leaguePairing: { findUnique: vi.fn(), update: vi.fn() },
    leagueParticipant: { update: vi.fn() },
    teamPlayer: { findMany: vi.fn(), update: vi.fn() },
    team: { findUnique: vi.fn() },
    teamAuditEvent: { create: vi.fn() },
    roster: { findMany: vi.fn() },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

vi.mock("./competition-match-sheet-context", () => ({
  resolveCompetitionPairing: vi.fn(),
}));

// La feuille est lourde à charger : on ne garde que ce que la resync utilise,
// en déléguant les options au module pur (le vrai chemin de la feuille).
vi.mock("./league-match-sheet", async () => {
  const opts = await vi.importActual<
    typeof import("./league-sheet-summary-options")
  >("./league-sheet-summary-options");
  return {
    loadSheetTeams: vi.fn(),
    sheetSummaryOptions: (
      teams: { home: { players: never[] } | null; away: { players: never[] } | null },
      sheet: Record<string, unknown>,
    ) =>
      opts.buildSheetSummaryOptions(
        { home: teams.home?.players ?? [], away: teams.away?.players ?? [] },
        sheet,
      ),
  };
});

import { prisma } from "../prisma";
import { resolveCompetitionPairing } from "./competition-match-sheet-context";
import { loadSheetTeams } from "./league-match-sheet";
import {
  planCasualtyResync,
  resyncValidatedSheetCasualties,
} from "./league-sheet-casualty-resync";
import type { OfflineResultSnapshot } from "./league-offline-result";
import type { MatchSummary } from "./league-match-summary";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;
const mockResolve = resolveCompatible(resolveCompetitionPairing);
const mockLoadTeams = resolveCompatible(loadSheetTeams);

function resolveCompatible<T>(fn: T): ReturnType<typeof vi.fn> {
  return fn as unknown as ReturnType<typeof vi.fn>;
}

function snapshot(
  over: Partial<OfflineResultSnapshot["input"]> = {},
): OfflineResultSnapshot {
  return {
    input: {
      scoreHome: 2,
      scoreAway: 1,
      casualtiesHome: 5,
      casualtiesAway: 0,
      playerStats: [
        { teamPlayerId: "h1", touchdowns: 2, casualties: 4, mvp: true },
        { teamPlayerId: "h5", casualties: 1 },
        { teamPlayerId: "a1", touchdowns: 1, casualties: 0 },
      ],
      winningsHome: 0,
      winningsAway: 0,
      treasuryDebitHome: 0,
      treasuryDebitAway: 0,
      dedicatedFansDeltaHome: 0,
      dedicatedFansDeltaAway: 0,
      rankingBonusHome: 0,
      rankingBonusAway: 0,
      sppBonus: [],
      injuries: [],
      purchasesHome: [],
      purchasesAway: [],
      firedPlayerIds: [],
      ...over,
    },
    dedicatedFansBefore: { home: 1, away: 1 },
    hateGranted: [],
  };
}

/** Résumé « règle courante » : 4 blocages de h1, l'agression de h5 ne compte plus. */
function summary(over: Partial<MatchSummary> = {}): MatchSummary {
  return {
    scoreHome: 2,
    scoreAway: 1,
    casualtiesHome: 4,
    casualtiesAway: 0,
    injuries: [],
    playerStats: [
      {
        playerId: "h1",
        side: "home",
        touchdowns: 2,
        casualtiesInflicted: 4,
        completions: 0,
        receptions: 0,
        interceptions: 0,
        aggressions: 0,
        ttmLandings: 0,
      },
      {
        playerId: "h5",
        side: "home",
        touchdowns: 0,
        casualtiesInflicted: 0,
        completions: 0,
        receptions: 0,
        interceptions: 0,
        aggressions: 1,
        ttmLandings: 0,
      },
      {
        playerId: "a1",
        side: "away",
        touchdowns: 1,
        casualtiesInflicted: 0,
        completions: 0,
        receptions: 0,
        interceptions: 0,
        aggressions: 0,
        ttmLandings: 0,
      },
    ],
    ...over,
  };
}

const sideOf = (id: string) =>
  id.startsWith("h") ? ("home" as const) : id.startsWith("a") ? ("away" as const) : null;

describe("planCasualtyResync (pur)", () => {
  it("4 blocages + 1 agression : la sortie de l'agresseur est reprise, avec ses 2 PSP", () => {
    const plan = planCasualtyResync({
      pairingId: "pair-1",
      matchId: "m1",
      snapshot: snapshot(),
      summary: summary(),
      sideOf,
      casualtySpp: { home: 2, away: 2 },
      bonusRules: null,
    });
    expect(plan.changed).toBe(true);
    expect(plan.casualties).toEqual({
      before: { home: 5, away: 0 },
      after: { home: 4, away: 0 },
    });
    expect(plan.players).toEqual([
      { teamPlayerId: "h5", side: "home", before: 1, after: 0, sppDelta: -2 },
    ]);
    expect(plan.bonus).toBeNull();
    // Le snapshot réécrit dit ce qui est désormais appliqué — l'invalidation
    // reprendra exactement ces valeurs.
    expect(plan.snapshot.input.casualtiesHome).toBe(4);
    expect(plan.snapshot.input.playerStats).toEqual([
      { teamPlayerId: "h1", touchdowns: 2, casualties: 4, mvp: true },
      { teamPlayerId: "h5", casualties: 0 },
      { teamPlayerId: "a1", touchdowns: 1, casualties: 0 },
    ]);
  });

  it("Bagarreurs Brutaux : la reprise vaut 3 PSP par sortie", () => {
    const plan = planCasualtyResync({
      pairingId: "pair-1",
      matchId: "m1",
      snapshot: snapshot(),
      summary: summary(),
      sideOf,
      casualtySpp: { home: 3, away: 2 },
      bonusRules: null,
    });
    expect(plan.players[0]?.sppDelta).toBe(-3);
  });

  it("feuille déjà à jour : aucun delta, rien à écrire (idempotent)", () => {
    const plan = planCasualtyResync({
      pairingId: "pair-1",
      matchId: "m1",
      snapshot: snapshot({
        casualtiesHome: 4,
        playerStats: [
          { teamPlayerId: "h1", touchdowns: 2, casualties: 4, mvp: true },
          { teamPlayerId: "h5", casualties: 0 },
        ],
      }),
      summary: summary(),
      sideOf,
      casualtySpp: { home: 2, away: 2 },
      bonusRules: [
        {
          id: "cas3",
          label: "3 sorties",
          condition: { type: "cas_inflicted_gte", value: 3 },
          points: 1,
          appliesTo: "both",
        },
      ],
    });
    expect(plan.changed).toBe(false);
    expect(plan.players).toEqual([]);
    expect(plan.bonus).toBeNull();
  });

  it("sous Frénésie d'Agression, une sortie peut aussi être AJOUTÉE (delta positif)", () => {
    const plan = planCasualtyResync({
      pairingId: "pair-1",
      matchId: "m1",
      snapshot: snapshot({ casualtiesHome: 4, playerStats: [{ teamPlayerId: "h5", casualties: 0 }] }),
      summary: summary({
        casualtiesHome: 5,
        playerStats: [
          {
            playerId: "h5",
            side: "home",
            touchdowns: 0,
            casualtiesInflicted: 1,
            completions: 0,
            receptions: 0,
            interceptions: 0,
            aggressions: 1,
            ttmLandings: 0,
          },
        ],
      }),
      sideOf,
      casualtySpp: { home: 2, away: 2 },
      bonusRules: null,
    });
    expect(plan.players).toEqual([
      { teamPlayerId: "h5", side: "home", before: 0, after: 1, sppDelta: 2 },
    ]);
    expect(plan.casualties.after.home).toBe(5);
  });

  it("re-évalue les règles de bonus « sorties infligées » quand les sorties changent", () => {
    const plan = planCasualtyResync({
      pairingId: "pair-1",
      matchId: "m1",
      snapshot: snapshot(),
      summary: summary({ casualtiesHome: 2 }),
      sideOf,
      casualtySpp: { home: 2, away: 2 },
      bonusRules: [
        {
          id: "cas3",
          label: "3 sorties",
          condition: { type: "cas_inflicted_gte", value: 3 },
          points: 1,
          appliesTo: "both",
        },
        {
          id: "win",
          label: "victoire",
          condition: { type: "shut_out_win" },
          points: 2,
          appliesTo: "winner",
        },
      ],
    });
    // 5 -> 2 sorties : le bonus « 3 sorties » tombe ; l'autre règle est
    // ré-évaluée à l'identique (2-1 n'est pas un blanchissage).
    expect(plan.bonus).toEqual({
      before: { home: 1, away: 0 },
      after: { home: 0, away: 0 },
      applied: [],
    });
  });

  it("ignore les joueurs synthétiques et ceux d'aucune des deux équipes", () => {
    const plan = planCasualtyResync({
      pairingId: "pair-1",
      matchId: "m1",
      snapshot: snapshot({ playerStats: [{ teamPlayerId: "zz-stranger", casualties: 1 }] }),
      summary: summary({
        playerStats: [
          {
            playerId: "journeyman-home-1",
            side: "home",
            touchdowns: 0,
            casualtiesInflicted: 1,
            completions: 0,
            receptions: 0,
            interceptions: 0,
            aggressions: 0,
            ttmLandings: 0,
          },
        ],
      }),
      sideOf,
      casualtySpp: { home: 2, away: 2 },
      bonusRules: null,
    });
    expect(plan.players).toEqual([]);
  });

  it("ajoute une ligne au snapshot pour un joueur crédité sans ligne figée", () => {
    const plan = planCasualtyResync({
      pairingId: "pair-1",
      matchId: "m1",
      snapshot: snapshot({ casualtiesHome: 0, playerStats: [] }),
      summary: summary({ casualtiesHome: 4, playerStats: [summary().playerStats[0]] }),
      sideOf,
      casualtySpp: { home: 2, away: 2 },
      bonusRules: null,
    });
    expect(plan.snapshot.input.playerStats).toEqual([
      { teamPlayerId: "h1", casualties: 4 },
    ]);
  });
});

describe("resyncValidatedSheetCasualties", () => {
  const ctx = {
    kind: "league" as const,
    pairingId: "pair-1",
    competitionId: "L1",
    competitionName: "Ligue",
    creatorId: "commish",
    homeTeamId: "team-home",
    awayTeamId: "team-away",
    homeOwnerId: "home-owner",
    awayOwnerId: "away-owner",
    rules: {} as never,
  };
  const events = [
    ...[1, 2, 3, 4].map((n) => ({
      kind: "casualty",
      team: "home",
      actorPlayerId: "h1",
      targetPlayerId: `a${n + 1}`,
      causeDetail: "block",
      injurySeverity: "badly_hurt",
    })),
    {
      kind: "aggression",
      team: "home",
      actorPlayerId: "h5",
      targetPlayerId: "a9",
      injurySeverity: "mng",
    },
    { kind: "touchdown", team: "home", actorPlayerId: "h1" },
    { kind: "touchdown", team: "home", actorPlayerId: "h1" },
    { kind: "touchdown", team: "away", actorPlayerId: "a1" },
  ];

  function arrangeValidatedSheet(over: {
    prayersHome?: unknown;
    seasonStatus?: string;
    bonusPointsConfig?: unknown;
    bonusBreakdown?: unknown;
  } = {}) {
    mockResolve.mockResolvedValue(ctx);
    mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
      id: "ms1",
      status: "validated",
      prayersHome: over.prayersHome ?? null,
      events,
    });
    mockPrisma.match.findFirst.mockResolvedValue({
      id: "m1",
      offlineResultInput: JSON.stringify(snapshot()),
    });
    mockPrisma.leaguePairing.findUnique.mockResolvedValue({
      id: "pair-1",
      bonusBreakdown: over.bonusBreakdown ?? null,
      homeParticipant: { id: "part-h", teamId: "team-home", team: { roster: "human" } },
      awayParticipant: { id: "part-a", teamId: "team-away", team: { roster: "orc" } },
      round: {
        season: {
          status: over.seasonStatus ?? "in_progress",
          league: { bonusPointsConfig: over.bonusPointsConfig ?? null },
        },
      },
    });
    mockLoadTeams.mockResolvedValue({
      home: { players: [{ id: "h1", number: 1, name: "Griff", skills: "" }, { id: "h5", number: 5, name: "Boot", skills: "" }] },
      away: { players: [{ id: "a1", number: 1, name: "Ork", skills: "" }] },
    });
    mockPrisma.roster.findMany.mockResolvedValue([
      { slug: "human", specialRules: "" },
      { slug: "orc", specialRules: "" },
    ]);
    mockPrisma.teamPlayer.findMany.mockResolvedValue([
      { id: "h1", teamId: "team-home" },
      { id: "h5", teamId: "team-home" },
      { id: "a1", teamId: "team-away" },
    ]);
    mockPrisma.team.findUnique.mockResolvedValue({ id: "t", players: [] });
    mockPrisma.leagueParticipant.update.mockResolvedValue({});
    mockPrisma.teamPlayer.update.mockResolvedValue({});
    mockPrisma.leaguePairing.update.mockResolvedValue({});
    mockPrisma.match.update.mockResolvedValue({});
    mockPrisma.teamAuditEvent.create.mockResolvedValue({});
  }

  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.$transaction.mockImplementation(async (ops: Promise<unknown>[]) =>
      Promise.all(ops),
    );
  });

  it("simulation : le plan est calculé, rien n'est écrit", async () => {
    arrangeValidatedSheet();
    const out = await resyncValidatedSheetCasualties("pair-1");
    expect(out).toMatchObject({
      skipped: false,
      applied: false,
      plan: {
        casualties: { before: { home: 5, away: 0 }, after: { home: 4, away: 0 } },
        players: [
          { teamPlayerId: "h5", side: "home", before: 1, after: 0, sppDelta: -2 },
        ],
      },
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.leagueParticipant.update).not.toHaveBeenCalled();
  });

  it("application : participants, joueur, snapshot — et journal des deux équipes", async () => {
    arrangeValidatedSheet();
    const out = await resyncValidatedSheetCasualties("pair-1", { apply: true });
    expect(out).toMatchObject({ skipped: false, applied: true });

    // Classement : -1 sortie pour le domicile, -1 encaissée pour l'extérieur.
    const participantUpdates = mockPrisma.leagueParticipant.update.mock.calls.map(
      (c: [{ where: unknown; data: unknown }]) => c[0],
    );
    expect(participantUpdates).toEqual([
      {
        where: { id: "part-h" },
        data: { casualtiesFor: { decrement: 1 }, casualtiesAgainst: undefined },
      },
      {
        where: { id: "part-a" },
        data: { casualtiesFor: undefined, casualtiesAgainst: { decrement: 1 } },
      },
    ]);
    // Joueur : la sortie de carrière et ses 2 PSP sont repris.
    expect(mockPrisma.teamPlayer.update).toHaveBeenCalledWith({
      where: { id: "h5" },
      data: { totalCasualties: { decrement: 1 }, spp: { decrement: 2 } },
    });
    // Snapshot du match offline réécrit (l'invalidation reprendra 4, pas 5).
    const matchUpdate = mockPrisma.match.update.mock.calls[0][0];
    expect(matchUpdate.where).toEqual({ id: "m1" });
    expect(matchUpdate.data.offlineResultInput.input).toMatchObject({
      casualtiesHome: 4,
      playerStats: expect.arrayContaining([{ teamPlayerId: "h5", casualties: 0 }]),
    });
    // Pas de règle bonus : le pairing n'est pas touché.
    expect(mockPrisma.leaguePairing.update).not.toHaveBeenCalled();
    // Journal d'équipe : une étape par équipe.
    const audits = mockPrisma.teamAuditEvent.create.mock.calls.map(
      (c: [{ data: { teamId: string; action: string } }]) => c[0].data,
    );
    expect(audits.map((a: { teamId: string }) => a.teamId).sort()).toEqual([
      "team-away",
      "team-home",
    ]);
    expect(audits[0].action).toBe("league.sheet.casualties.resync");
  });

  it("Frénésie d'Agression sur la feuille : l'agression reste une sortie, rien ne bouge", async () => {
    arrangeValidatedSheet({ prayersHome: [{ roll: 13, prayerId: "fouling-frenzy" }] });
    const out = await resyncValidatedSheetCasualties("pair-1", { apply: true });
    expect(out).toMatchObject({ skipped: false, applied: false });
    if (out.skipped) throw new Error("unexpected skip");
    expect(out.plan.changed).toBe(false);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("règle bonus « sorties infligées » : le pairing est ré-évalué, le bonus commissaire conservé", async () => {
    arrangeValidatedSheet({
      bonusPointsConfig: [
        {
          id: "cas5",
          label: "5 sorties",
          condition: { type: "cas_inflicted_gte", value: 5 },
          points: 1,
          appliesTo: "both",
        },
      ],
      bonusBreakdown: JSON.stringify([
        { ruleId: "cas5", label: "5 sorties", side: "home", points: 1 },
        { ruleId: "commissioner-ranking-bonus", label: "Bonus commissaire", side: "away", points: 2 },
      ]),
    });
    await resyncValidatedSheetCasualties("pair-1", { apply: true });
    const update = mockPrisma.leaguePairing.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: "pair-1" });
    expect(update.data.bonusPointsHome).toEqual({ decrement: 1 });
    expect(update.data.bonusPointsAway).toBeUndefined();
    expect(JSON.parse(update.data.bonusBreakdown)).toEqual([
      { ruleId: "commissioner-ranking-bonus", label: "Bonus commissaire", side: "away", points: 2 },
    ]);
  });

  it.each([
    ["pairing-missing", () => mockResolve.mockResolvedValue(null)],
    ["not-a-league", () => mockResolve.mockResolvedValue({ ...ctx, kind: "cup" })],
    [
      "sheet-not-validated",
      () => mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({ id: "ms1", status: "draft", events: [] }),
    ],
    ["snapshot-missing", () => mockPrisma.match.findFirst.mockResolvedValue(null)],
    ["season-completed", () => undefined],
  ] as const)("ignore une rencontre %s", async (reason, arrange) => {
    arrangeValidatedSheet(reason === "season-completed" ? { seasonStatus: "completed" } : {});
    arrange();
    const out = await resyncValidatedSheetCasualties("pair-1", { apply: true });
    expect(out).toEqual({ skipped: true, reason });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
