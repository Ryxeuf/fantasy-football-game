/**
 * Tests de `reverseOfflineLeagueResult` (W-B2).
 *
 * Couvre les garde-fous (refus) et la reversion exacte : standings decrementes,
 * SPP/blessures/eco annulees, Match supprime, pairing/round re-ouverts.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => {
  const prisma: any = {
    match: { findUnique: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
    leagueRound: { count: vi.fn(), update: vi.fn() },
    leaguePairing: { findUnique: vi.fn(), update: vi.fn() },
    leagueParticipant: { update: vi.fn() },
    teamPlayer: {
      findMany: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    team: { update: vi.fn() },
    teamSelection: { deleteMany: vi.fn() },
    $transaction: vi.fn(async (ops: unknown) =>
      Array.isArray(ops) ? Promise.all(ops as Promise<unknown>[]) : ops,
    ),
  };
  return { prisma };
});

// Recalcul TV isole : la reversion d'achats appelle updateTeamValues apres la
// transaction (testee a part). On le neutralise ici.
vi.mock("../utils/team-values", () => ({ updateTeamValues: vi.fn() }));

vi.mock("./spp-tracking", () => ({
  loadLeagueSPPContext: vi.fn(async () => ({
    isLeagueMatch: true,
    teamA: { bagarreursBrutaux: false },
    teamB: { bagarreursBrutaux: false },
  })),
  calculatePlayerSPP: vi.fn(() => 6),
}));

// Garde parseOfflineSnapshot / OFFLINE_MATCH_MODE reels, mocke uniquement la
// re-saisie pour tester l'orchestration d'edition.
vi.mock("./league-offline-result", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, recordOfflineLeagueResult: vi.fn() };
});

// Reversion de statut (mort/licenciement) : service dedie, teste dans
// player-status.test.ts. Ici on verifie la delegation + la provenance.
vi.mock("./player-status", () => ({
  revertPlayerStatus: vi.fn(async ({ playerId }: { playerId: string }) => ({
    reverted: true,
    playerId,
    teamId: "team-home",
  })),
}));

// Retrait des evolutions post-match (deblocage advancement-consumed) :
// service dedie, teste dans league-sheet-advancements.test.ts. Ici on
// verifie la delegation (qui / combien).
vi.mock("./league-sheet-advancements", () => ({
  removeLatestAdvancements: vi.fn(async () => ({ removed: 1 })),
}));

// Bracket de playoffs : service dedie (teste dans league-playoffs.test.ts).
// Ici on verifie la delegation — quand on interroge l'etat du tour suivant,
// et avec quoi on le desavance.
// Haine (X) : service dedie (teste dans league-hate-trait.test.ts). Ici on
// verifie que l'invalidation retire bien ce que le match avait accorde.
vi.mock("./league-hate-trait", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, revertHateTraitGrants: vi.fn(async () => 1) };
});

vi.mock("./league-playoffs", () => ({
  playoffAdvancementState: vi.fn(async () => "none"),
  unadvancePlayoffsForSlot: vi.fn(async () => ({ unadvanced: true })),
}));

import { prisma } from "../prisma";
import { recordOfflineLeagueResult } from "./league-offline-result";
import { revertPlayerStatus } from "./player-status";
import { removeLatestAdvancements } from "./league-sheet-advancements";
import {
  playoffAdvancementState,
  unadvancePlayoffsForSlot,
} from "./league-playoffs";
import { revertHateTraitGrants } from "./league-hate-trait";
import { updateTeamValues } from "../utils/team-values";
import {
  reverseOfflineLeagueResult,
  editOfflineLeagueResult,
} from "./league-offline-edit";

type MockFn = ReturnType<typeof vi.fn>;
const m = {
  matchFind: prisma.match.findUnique as MockFn,
  matchFindFirst: prisma.match.findFirst as MockFn,
  matchDelete: prisma.match.delete as MockFn,
  roundCount: prisma.leagueRound.count as MockFn,
  roundUpdate: prisma.leagueRound.update as MockFn,
  pairFind: prisma.leaguePairing.findUnique as MockFn,
  pairUpdate: prisma.leaguePairing.update as MockFn,
  partUpdate: prisma.leagueParticipant.update as MockFn,
  tpFindMany: prisma.teamPlayer.findMany as MockFn,
  tpUpdate: prisma.teamPlayer.update as MockFn,
  tpDeleteMany: prisma.teamPlayer.deleteMany as MockFn,
  tpUpdateMany: prisma.teamPlayer.updateMany as MockFn,
  teamUpdate: prisma.team.update as MockFn,
  selDelete: prisma.teamSelection.deleteMany as MockFn,
  updateTv: updateTeamValues as unknown as MockFn,
  revertStatus: revertPlayerStatus as unknown as MockFn,
  poState: playoffAdvancementState as unknown as MockFn,
  poUnadvance: unadvancePlayoffsForSlot as unknown as MockFn,
  revertHate: revertHateTraitGrants as unknown as MockFn,
};

function buildSnapshot(over: Record<string, unknown> = {}) {
  return {
    input: {
      scoreHome: 2,
      scoreAway: 1,
      casualtiesHome: 3,
      casualtiesAway: 0,
      playerStats: [],
      winningsHome: 50000,
      winningsAway: 0,
      dedicatedFansDeltaHome: 1,
      dedicatedFansDeltaAway: 0,
      injuries: [],
      ...over,
    },
    dedicatedFansBefore: { home: 1, away: 6 },
  };
}

function buildMatch(over: Record<string, unknown> = {}) {
  return {
    id: "m-1",
    mode: "offline",
    leagueScoredAt: new Date(),
    leaguePairingId: "pair-1",
    leagueRoundId: "round-1",
    leagueSeasonId: "season-1",
    offlineResultInput: buildSnapshot(),
    leaguePostMatchSequence: null,
    leagueSeason: {
      status: "in_progress",
      league: { winPoints: 3, drawPoints: 1, lossPoints: 0 },
    },
    leagueRound: {
      id: "round-1",
      status: "completed",
      kind: "regular",
      bracketSlot: null,
    },
    ...over,
  };
}

function buildPairing() {
  return {
    id: "pair-1",
    homeParticipant: {
      id: "ph",
      teamId: "team-home",
      team: { roster: "orc" },
    },
    awayParticipant: {
      id: "pa",
      teamId: "team-away",
      team: { roster: "wood_elf" },
    },
  };
}

describe("reverseOfflineLeagueResult (W-B2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.roundCount.mockResolvedValue(0);
    m.poState.mockResolvedValue("none");
    m.poUnadvance.mockResolvedValue({ unadvanced: true });
    m.revertHate.mockResolvedValue(1);
    m.pairFind.mockResolvedValue(buildPairing());
    m.tpFindMany.mockResolvedValue([]);
    m.partUpdate.mockResolvedValue({});
    m.tpUpdate.mockResolvedValue({});
    m.tpDeleteMany.mockResolvedValue({ count: 0 });
    m.tpUpdateMany.mockResolvedValue({ count: 0 });
    m.teamUpdate.mockResolvedValue({});
    m.selDelete.mockResolvedValue({ count: 2 });
    m.matchDelete.mockResolvedValue({});
    m.pairUpdate.mockResolvedValue({});
    m.roundUpdate.mockResolvedValue({});
  });

  it("skip si le match est introuvable", async () => {
    m.matchFind.mockResolvedValue(null);
    expect(await reverseOfflineLeagueResult("nope")).toEqual({
      skipped: true,
      reason: "match-missing",
    });
  });

  it("skip si le match n'est pas offline", async () => {
    m.matchFind.mockResolvedValue(buildMatch({ mode: "realtime" }));
    expect(await reverseOfflineLeagueResult("m-1")).toEqual({
      skipped: true,
      reason: "not-offline-match",
    });
  });

  it("skip si pas encore comptabilise", async () => {
    m.matchFind.mockResolvedValue(buildMatch({ leagueScoredAt: null }));
    expect(await reverseOfflineLeagueResult("m-1")).toEqual({
      skipped: true,
      reason: "not-scored",
    });
  });

  it("skip si le snapshot est absent", async () => {
    m.matchFind.mockResolvedValue(buildMatch({ offlineResultInput: null }));
    expect(await reverseOfflineLeagueResult("m-1")).toEqual({
      skipped: true,
      reason: "snapshot-missing",
    });
  });

  it("skip si la saison est clôturee", async () => {
    m.matchFind.mockResolvedValue(
      buildMatch({
        leagueSeason: {
          status: "completed",
          league: { winPoints: 3, drawPoints: 1, lossPoints: 0 },
        },
      }),
    );
    expect(await reverseOfflineLeagueResult("m-1")).toEqual({
      skipped: true,
      reason: "season-completed",
    });
  });

  it("skip si des playoffs sont generes", async () => {
    m.matchFind.mockResolvedValue(buildMatch());
    m.roundCount.mockResolvedValue(1);
    expect(await reverseOfflineLeagueResult("m-1")).toEqual({
      skipped: true,
      reason: "playoffs-generated",
    });
  });

  // Un match DE playoff ne fige aucun classement de phase reguliere :
  // le refus « playoffs-generated » le rendait pourtant ineditable.
  const playoffRound = (
    slot: string | null,
    kind: string | null = "playoff",
  ) => ({
    id: "round-po",
    status: "completed",
    kind,
    bracketSlot: slot,
  });
  const playoffMatch = (slot = "sf1") =>
    buildMatch({
      leagueRound: playoffRound(slot),
      leaguePairing: { round: playoffRound(slot) },
    });

  it("invalide un match DE playoff sans buter sur « playoffs-generated »", async () => {
    m.matchFind.mockResolvedValue(playoffMatch());
    m.roundCount.mockResolvedValue(4); // le bracket existe : sans effet ici.

    const r = await reverseOfflineLeagueResult("m-1");

    expect(r).toEqual({ reversed: true, matchId: "m-1", pairingId: "pair-1" });
    // Le comptage global des rounds playoff n'est meme plus interroge.
    expect(m.roundCount).not.toHaveBeenCalled();
    expect(m.poState).toHaveBeenCalledWith("season-1", "sf1");
  });

  // A158 — `Match.leagueRoundId` est NULLABLE (`onDelete: SetNull`) et n'a
  // jamais pu etre backfille (`db push` en prod). Un match de playoff qui le
  // porte a NULL etait donc vu comme un match REGULIER, et son invalidation
  // butait sur « playoffs-generated ». Le round du PAIRING fait foi.
  it("invalide un match DE playoff dont le Match ne porte plus son round", async () => {
    m.matchFind.mockResolvedValue(
      buildMatch({
        leagueRound: null,
        leaguePairing: { round: playoffRound("sf1") },
      }),
    );
    m.roundCount.mockResolvedValue(2);

    const r = await reverseOfflineLeagueResult("m-1");

    expect(r).toEqual({ reversed: true, matchId: "m-1", pairingId: "pair-1" });
    expect(m.roundCount).not.toHaveBeenCalled();
    expect(m.poState).toHaveBeenCalledWith("season-1", "sf1");
  });

  // Un round de bracket cree a la main par le commissaire garde
  // `kind: "regular"` (le defaut Prisma) mais porte bien son slot.
  it("traite comme playoff un round qui porte un bracketSlot sans le declarer", async () => {
    m.matchFind.mockResolvedValue(
      buildMatch({
        leagueRound: null,
        leaguePairing: { round: playoffRound("final", "regular") },
      }),
    );
    m.roundCount.mockResolvedValue(3);

    expect(await reverseOfflineLeagueResult("m-1")).toEqual({
      reversed: true,
      matchId: "m-1",
      pairingId: "pair-1",
    });
    expect(m.poState).toHaveBeenCalledWith("season-1", "final");
  });

  // Le repli reste utile : un pairing illisible ne doit pas faire perdre
  // l'information de round portee par le Match.
  it("retombe sur le round du Match quand le pairing n'en porte pas", async () => {
    m.matchFind.mockResolvedValue(
      buildMatch({
        leagueRound: playoffRound("qf1"),
        leaguePairing: null,
      }),
    );
    m.roundCount.mockResolvedValue(4);

    expect(await reverseOfflineLeagueResult("m-1")).toEqual({
      reversed: true,
      matchId: "m-1",
      pairingId: "pair-1",
    });
    expect(m.roundCount).not.toHaveBeenCalled();
  });

  // Un match REGULIER reste refuse : le classement de phase reguliere est
  // fige des que le bracket existe.
  it("refuse toujours un match REGULIER une fois le bracket genere", async () => {
    m.matchFind.mockResolvedValue(
      buildMatch({
        leaguePairing: {
          round: {
            id: "round-1",
            status: "completed",
            kind: "regular",
            bracketSlot: null,
          },
        },
      }),
    );
    m.roundCount.mockResolvedValue(2);

    expect(await reverseOfflineLeagueResult("m-1")).toEqual({
      skipped: true,
      reason: "playoffs-generated",
    });
  });

  it("refuse si le tour suivant du bracket a deja demarre", async () => {
    m.matchFind.mockResolvedValue(playoffMatch());
    m.poState.mockResolvedValue("started");

    expect(await reverseOfflineLeagueResult("m-1")).toEqual({
      skipped: true,
      reason: "playoff-round-advanced",
    });
    // Refus AVANT toute ecriture.
    expect(m.matchDelete).not.toHaveBeenCalled();
  });

  it("retire du bracket la qualification issue du match invalide", async () => {
    // Snapshot 2-1 -> l'equipe a domicile (participant "ph") etait qualifiee.
    m.matchFind.mockResolvedValue(playoffMatch("qf2"));

    await reverseOfflineLeagueResult("m-1");

    expect(m.poUnadvance).toHaveBeenCalledWith({
      seasonId: "season-1",
      slot: "qf2",
      winnerParticipantId: "ph",
    });
  });

  it("retire les traits de Haine gagnes sur les blessures annulees", async () => {
    const granted = [
      { playerId: "p1", skillSlug: "hate-orque", keyword: "Orque", roll: 5 },
    ];
    m.matchFind.mockResolvedValue(
      buildMatch({
        offlineResultInput: {
          ...buildSnapshot({ injuries: [{ teamPlayerId: "p1", type: "mng" }] }),
          hateGranted: granted,
        },
      }),
    );

    await reverseOfflineLeagueResult("m-1");

    expect(m.revertHate).toHaveBeenCalledWith(granted);
  });

  it("n'appelle pas la reversion de Haine sans trait accorde", async () => {
    m.matchFind.mockResolvedValue(buildMatch());
    await reverseOfflineLeagueResult("m-1");
    expect(m.revertHate).not.toHaveBeenCalled();
  });

  it("ne touche pas au bracket pour un match de phase reguliere", async () => {
    m.matchFind.mockResolvedValue(buildMatch());

    await reverseOfflineLeagueResult("m-1");

    expect(m.poUnadvance).not.toHaveBeenCalled();
  });

  it("ressuscite un joueur tue : reverse une blessure 'dead' (dead:false)", async () => {
    // La mort est un flag (pas une suppression) -> la reversion la leve.
    // L'UI previent le commissaire avant de confirmer.
    m.matchFind.mockResolvedValue(
      buildMatch({
        offlineResultInput: buildSnapshot({
          injuries: [{ teamPlayerId: "p1", type: "dead" }],
        }),
      }),
    );

    const r = await reverseOfflineLeagueResult("m-1");
    expect(r).toEqual({ reversed: true, matchId: "m-1", pairingId: "pair-1" });

    // Delegue a player-status AVEC la provenance : la resurrection est
    // refusee si la mort courante vient d'une autre source.
    expect(m.revertStatus).toHaveBeenCalledWith({
      playerId: "p1",
      kind: "death",
      source: "match_sheet",
      sourceId: "m-1",
    });
    // Aucune ecriture aveugle `dead:false` sur la ligne joueur.
    expect(
      m.tpUpdate.mock.calls.some(
        (c) => "dead" in (c[0] as { data: Record<string, unknown> }).data,
      ),
    ).toBe(false);
  });

  it("A68 : reverse une Séquelle en restaurant la caractéristique perdue", async () => {
    m.matchFind.mockResolvedValue(
      buildMatch({
        offlineResultInput: buildSnapshot({
          injuries: [{ teamPlayerId: "p1", type: "ma" }],
        }),
      }),
    );
    // La saisie avait appliqué MA 8 -> 7 + maReduction 1.
    m.tpFindMany.mockResolvedValue([
      {
        id: "p1",
        ma: 7,
        st: 2,
        ag: 3,
        pa: 4,
        av: 8,
        maReduction: 1,
        stReduction: 0,
        agReduction: 0,
        paReduction: 0,
        avReduction: 0,
      },
    ]);

    const r = await reverseOfflineLeagueResult("m-1");
    expect(r).toEqual({ reversed: true, matchId: "m-1", pairingId: "pair-1" });

    const injUpd = m.tpUpdate.mock.calls.find(
      (c) => (c[0] as { where: { id: string } }).where.id === "p1",
    )?.[0] as { data: Record<string, unknown> };
    expect(injUpd.data).toEqual({
      missNextMatch: false,
      maReduction: { decrement: 1 },
      ma: 8,
    });
  });

  it("A68 : pas de restauration si la Séquelle n'avait rien posé (plancher)", async () => {
    m.matchFind.mockResolvedValue(
      buildMatch({
        offlineResultInput: buildSnapshot({
          injuries: [{ teamPlayerId: "p1", type: "st" }],
        }),
      }),
    );
    // ST était au plancher à la saisie : compteur jamais incrémenté.
    m.tpFindMany.mockResolvedValue([
      {
        id: "p1",
        ma: 8,
        st: 1,
        ag: 3,
        pa: 4,
        av: 8,
        maReduction: 0,
        stReduction: 0,
        agReduction: 0,
        paReduction: 0,
        avReduction: 0,
      },
    ]);

    await reverseOfflineLeagueResult("m-1");

    const injUpd = m.tpUpdate.mock.calls.find(
      (c) => (c[0] as { where: { id: string } }).where.id === "p1",
    )?.[0] as { data: Record<string, unknown> };
    expect(injUpd.data).toEqual({ missNextMatch: false });
  });

  it("skip si un level-up issu de ce match a ete consomme", async () => {
    m.matchFind.mockResolvedValue(
      buildMatch({
        leaguePostMatchSequence: {
          pendingChoices: JSON.stringify([
            { teamPlayerId: "p1", advancementsTaken: 0 },
          ]),
        },
      }),
    );
    // p1 a maintenant 1 advancement (> 0 capture) -> consomme.
    m.tpFindMany.mockResolvedValue([
      { id: "p1", advancements: JSON.stringify([{ skillSlug: "block" }]) },
    ]);
    expect(await reverseOfflineLeagueResult("m-1")).toEqual({
      skipped: true,
      reason: "advancement-consumed",
    });
  });

  it("ne bloque PAS quand l'advancement vient de la feuille elle-meme (sheetAppliedAdvancements)", async () => {
    m.matchFind.mockResolvedValue(
      buildMatch({
        leaguePostMatchSequence: {
          pendingChoices: JSON.stringify([
            { teamPlayerId: "p1", advancementsTaken: 0 },
          ]),
        },
      }),
    );
    // p1 a 1 advancement de plus que la capture, mais il a ete applique
    // par la feuille de match (et sera reverse juste apres) -> pas un
    // level-up consomme par un autre chemin, la reversion procede.
    m.tpFindMany.mockResolvedValue([
      { id: "p1", advancements: JSON.stringify([{ skillSlug: "block" }]) },
    ]);
    const r = await reverseOfflineLeagueResult("m-1", {
      sheetAppliedAdvancements: new Map([["p1", 1]]),
    });
    expect(r).toEqual({ reversed: true, matchId: "m-1", pairingId: "pair-1" });
  });

  it("bloque quand un advancement EXTERNE s'ajoute a ceux de la feuille", async () => {
    m.matchFind.mockResolvedValue(
      buildMatch({
        leaguePostMatchSequence: {
          pendingChoices: JSON.stringify([
            { teamPlayerId: "p1", advancementsTaken: 0 },
          ]),
        },
      }),
    );
    // 2 advancements : 1 pose par la feuille + 1 pris via le post-match
    // classique -> le second est bien un effet consomme, refus.
    m.tpFindMany.mockResolvedValue([
      {
        id: "p1",
        advancements: JSON.stringify([
          { skillSlug: "block" },
          { skillSlug: "dodge" },
        ]),
      },
    ]);
    expect(
      await reverseOfflineLeagueResult("m-1", {
        sheetAppliedAdvancements: new Map([["p1", 1]]),
      }),
    ).toEqual({
      skipped: true,
      reason: "advancement-consumed",
    });
  });

  it("débloque advancement-consumed en retirant les évolutions post-match (opt-in)", async () => {
    m.matchFind.mockResolvedValue(
      buildMatch({
        leaguePostMatchSequence: {
          pendingChoices: JSON.stringify([
            { teamPlayerId: "p1", advancementsTaken: 0 },
          ]),
        },
      }),
    );
    // 3 advancements : 1 pose par la feuille + 2 pris via le post-match
    // classique -> 2 evolutions consommees a retirer.
    m.tpFindMany.mockResolvedValue([
      {
        id: "p1",
        advancements: JSON.stringify([
          { skillSlug: "block" },
          { skillSlug: "dodge" },
          { skillSlug: "tackle" },
        ]),
      },
    ]);

    const r = await reverseOfflineLeagueResult("m-1", {
      sheetAppliedAdvancements: new Map([["p1", 1]]),
      removeConsumedAdvancements: true,
    });

    expect(removeLatestAdvancements).toHaveBeenCalledWith({
      playerId: "p1",
      count: 2,
    });
    expect(r).toEqual({ reversed: true, matchId: "m-1", pairingId: "pair-1" });
  });

  it("sans évolution consommée, l'opt-in ne retire rien", async () => {
    m.matchFind.mockResolvedValue(
      buildMatch({
        leaguePostMatchSequence: {
          pendingChoices: JSON.stringify([
            { teamPlayerId: "p1", advancementsTaken: 1 },
          ]),
        },
      }),
    );
    m.tpFindMany.mockResolvedValue([
      { id: "p1", advancements: JSON.stringify([{ skillSlug: "block" }]) },
    ]);

    const r = await reverseOfflineLeagueResult("m-1", {
      removeConsumedAdvancements: true,
    });

    expect(removeLatestAdvancements).not.toHaveBeenCalled();
    expect(r).toEqual({ reversed: true, matchId: "m-1", pairingId: "pair-1" });
  });

  it("reverse les standings (decrement) + eco + supprime + re-ouvre", async () => {
    m.matchFind.mockResolvedValue(buildMatch());

    const r = await reverseOfflineLeagueResult("m-1");
    expect(r).toEqual({ reversed: true, matchId: "m-1", pairingId: "pair-1" });

    // Standings home decrementes (victoire 2-1 -> wins-1, points-3, td...).
    const homeUpd = m.partUpdate.mock.calls.find(
      (c) => (c[0] as { where: { id: string } }).where.id === "ph",
    )?.[0] as { data: Record<string, unknown> };
    expect(homeUpd.data.wins).toEqual({ decrement: 1 });
    expect(homeUpd.data.points).toEqual({ decrement: 3 });
    expect(homeUpd.data.touchdownsFor).toEqual({ decrement: 2 });
    expect(homeUpd.data.casualtiesFor).toEqual({ decrement: 3 });

    // Eco : treasury decrement + dedicatedFans restaure a la pre-valeur.
    const homeTeam = m.teamUpdate.mock.calls.find(
      (c) => (c[0] as { where: { id: string } }).where.id === "team-home",
    )?.[0] as { data: Record<string, unknown> };
    expect(homeTeam.data.treasury).toEqual({ decrement: 50000 });
    expect(homeTeam.data.dedicatedFans).toBe(1);

    // Suppression selections puis match ; pairing + round re-ouverts.
    // Le snapshot de points bonus du pairing est remis a zero (les bonus
    // ne sont plus comptes dans `points`, la colonne Bo agrege ces
    // snapshots — un match reverse ne doit plus y contribuer).
    expect(m.selDelete).toHaveBeenCalledWith({ where: { matchId: "m-1" } });
    expect(m.matchDelete).toHaveBeenCalledWith({ where: { id: "m-1" } });
    expect(m.pairUpdate).toHaveBeenCalledWith({
      where: { id: "pair-1" },
      data: {
        status: "scheduled",
        bonusPointsHome: 0,
        bonusPointsAway: 0,
        bonusBreakdown: null,
      },
    });
    expect(m.roundUpdate).toHaveBeenCalledWith({
      where: { id: "round-1" },
      data: { status: "scheduled" },
    });
  });

  it("reverse le SPP bonus Nuffle ; le bonus au classement suit le snapshot bonus du pairing", async () => {
    m.matchFind.mockResolvedValue(
      buildMatch({
        offlineResultInput: buildSnapshot({
          playerStats: [],
          sppBonus: [{ teamPlayerId: "p1", spp: 4 }],
          rankingBonusHome: 2,
          rankingBonusAway: -1,
        }),
      }),
    );

    const r = await reverseOfflineLeagueResult("m-1");
    expect("reversed" in r && r.reversed).toBe(true);

    // SPP bonus -> decrement spp du joueur.
    const sppUpd = m.tpUpdate.mock.calls.find(
      (c) => (c[0] as { where: { id: string } }).where.id === "p1",
    ) as [{ data: Record<string, unknown> }] | undefined;
    expect(sppUpd![0].data.spp).toEqual({ decrement: 4 });

    // Le bonus au classement ne touche plus les points generiques : la
    // seule reversion de points est celle du bareme du match (ici -3 pour
    // la victoire home), jamais celle du bonus commissaire (2 / -1). Il
    // est annule avec la remise a zero du snapshot bonus du pairing.
    const bonusReversal = m.partUpdate.mock.calls.find((c) => {
      const points = (
        c[0] as {
          data: { points?: { decrement?: number; increment?: number } };
        }
      ).data.points;
      return (
        points?.decrement === 2 ||
        points?.decrement === -1 ||
        points?.increment === 1
      );
    });
    expect(bonusReversal).toBeUndefined();
    expect(m.pairUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pair-1" },
        data: expect.objectContaining({
          bonusPointsHome: 0,
          bonusPointsAway: 0,
          bonusBreakdown: null,
        }),
      }),
    );
  });

  it("reverse le net treasury applique (gains - depenses)", async () => {
    // home : 60k gains - 50k depenses = +10k net applique -> reversion -10k.
    // away : 0 gains - 30k depenses = -30k net applique -> reversion +30k.
    m.matchFind.mockResolvedValue(
      buildMatch({
        offlineResultInput: buildSnapshot({
          winningsHome: 60000,
          treasuryDebitHome: 50000,
          winningsAway: 0,
          treasuryDebitAway: 30000,
        }),
      }),
    );

    const r = await reverseOfflineLeagueResult("m-1");
    expect("reversed" in r && r.reversed).toBe(true);

    const homeTeam = m.teamUpdate.mock.calls.find(
      (c) => (c[0] as { where: { id: string } }).where.id === "team-home",
    )?.[0] as { data: Record<string, unknown> };
    expect(homeTeam.data.treasury).toEqual({ decrement: 10000 });

    const awayTeam = m.teamUpdate.mock.calls.find(
      (c) => (c[0] as { where: { id: string } }).where.id === "team-away",
    )?.[0] as { data: Record<string, unknown> };
    expect(awayTeam.data.treasury).toEqual({ increment: 30000 });
  });

  it("reverse le SPP par joueur (decrement exact) et les blessures", async () => {
    m.matchFind.mockResolvedValue(
      buildMatch({
        offlineResultInput: buildSnapshot({
          playerStats: [{ teamPlayerId: "p1", touchdowns: 1, casualties: 1 }],
          injuries: [{ teamPlayerId: "p2", type: "niggling" }],
        }),
      }),
    );
    m.tpFindMany.mockResolvedValue([{ id: "p1", teamId: "team-home" }]);

    await reverseOfflineLeagueResult("m-1");

    const sppUpd = m.tpUpdate.mock.calls.find(
      (c) => (c[0] as { where: { id: string } }).where.id === "p1",
    )?.[0] as { data: Record<string, unknown> };
    expect(sppUpd.data.spp).toEqual({ decrement: 6 }); // mock calculatePlayerSPP
    expect(sppUpd.data.totalTouchdowns).toEqual({ decrement: 1 });
    expect(sppUpd.data.matchesPlayed).toEqual({ decrement: 1 });

    const injUpd = m.tpUpdate.mock.calls.find(
      (c) => (c[0] as { where: { id: string } }).where.id === "p2",
    )?.[0] as { data: Record<string, unknown> };
    expect(injUpd.data).toEqual({
      missNextMatch: false,
      nigglingInjuries: { decrement: 1 },
    });
  });

  it("reverse les achats : supprime les joueurs crees + decremente les compteurs", async () => {
    const snapshot = {
      ...buildSnapshot(),
      rosterMutations: {
        home: {
          createdPlayerIds: ["np-1", "np-2"],
          rerollsAdded: 1,
          assistantsAdded: 0,
          cheerleadersAdded: 0,
          apothecaryAdded: true,
          dedicatedFansAdded: 0,
        },
        away: {
          createdPlayerIds: [],
          rerollsAdded: 0,
          assistantsAdded: 0,
          cheerleadersAdded: 0,
          apothecaryAdded: false,
          dedicatedFansAdded: 0,
        },
      },
    };
    m.matchFind.mockResolvedValue(buildMatch({ offlineResultInput: snapshot }));
    // Garde-fou achats : les joueurs crees sont intacts (non consommes).
    m.tpFindMany.mockResolvedValue([
      { id: "np-1", spp: 0, matchesPlayed: 0, dead: false, advancements: "[]" },
      { id: "np-2", spp: 0, matchesPlayed: 0, dead: false, advancements: "[]" },
    ]);

    const r = await reverseOfflineLeagueResult("m-1");
    expect("reversed" in r && r.reversed).toBe(true);

    // Joueurs crees supprimes.
    expect(m.tpDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["np-1", "np-2"] } },
    });
    // Compteurs home decrementes + apothicaire annule (update dedie aux achats).
    const counterUpd = m.teamUpdate.mock.calls.find(
      (c) =>
        (c[0] as { where: { id: string }; data: Record<string, unknown> }).where
          .id === "team-home" &&
        "rerolls" in (c[0] as { data: Record<string, unknown> }).data,
    )?.[0] as { data: Record<string, unknown> };
    expect(counterUpd.data).toEqual({
      rerolls: { decrement: 1 },
      apothecary: false,
    });
  });

  it("refuse la reversion si un joueur achete a deja joue (purchase-consumed)", async () => {
    const snapshot = {
      ...buildSnapshot(),
      rosterMutations: {
        home: {
          createdPlayerIds: ["np-1"],
          rerollsAdded: 0,
          assistantsAdded: 0,
          cheerleadersAdded: 0,
          apothecaryAdded: false,
          dedicatedFansAdded: 0,
        },
        away: {
          createdPlayerIds: [],
          rerollsAdded: 0,
          assistantsAdded: 0,
          cheerleadersAdded: 0,
          apothecaryAdded: false,
          dedicatedFansAdded: 0,
        },
      },
    };
    m.matchFind.mockResolvedValue(buildMatch({ offlineResultInput: snapshot }));
    // np-1 a joue un match ulterieur -> consomme.
    m.tpFindMany.mockResolvedValue([
      { id: "np-1", spp: 6, matchesPlayed: 1, dead: false, advancements: "[]" },
    ]);

    expect(await reverseOfflineLeagueResult("m-1")).toEqual({
      skipped: true,
      reason: "purchase-consumed",
    });
    // Aucune suppression : la reversion est refusee avant la transaction.
    expect(m.tpDeleteMany).not.toHaveBeenCalled();
    expect(m.matchDelete).not.toHaveBeenCalled();
  });

  it("reverse les licenciements : re-active firedAt=null + recalcule TV", async () => {
    const snapshot = { ...buildSnapshot(), firedApplied: ["p1", "p2"] };
    m.matchFind.mockResolvedValue(buildMatch({ offlineResultInput: snapshot }));

    const r = await reverseOfflineLeagueResult("m-1");
    expect("reversed" in r && r.reversed).toBe(true);

    // Re-activation des joueurs licencies par ce match, avec verification
    // de la provenance (pas d'`updateMany` aveugle).
    for (const playerId of ["p1", "p2"]) {
      expect(m.revertStatus).toHaveBeenCalledWith({
        playerId,
        kind: "firing",
        source: "match_sheet",
        sourceId: "m-1",
      });
    }
    // TV recalculee pour les 2 equipes (licenciements touchent home + away).
    expect(m.updateTv).toHaveBeenCalledWith(expect.anything(), "team-home");
    expect(m.updateTv).toHaveBeenCalledWith(expect.anything(), "team-away");
  });
});

describe("editOfflineLeagueResult (W-B3)", () => {
  const recordMock = recordOfflineLeagueResult as MockFn;

  beforeEach(() => {
    vi.clearAllMocks();
    m.roundCount.mockResolvedValue(0);
    m.poState.mockResolvedValue("none");
    m.poUnadvance.mockResolvedValue({ unadvanced: true });
    m.revertHate.mockResolvedValue(1);
    m.pairFind.mockResolvedValue(buildPairing());
    m.tpFindMany.mockResolvedValue([]);
    m.partUpdate.mockResolvedValue({});
    m.teamUpdate.mockResolvedValue({});
    m.selDelete.mockResolvedValue({ count: 2 });
    m.matchDelete.mockResolvedValue({});
    m.pairUpdate.mockResolvedValue({});
    m.roundUpdate.mockResolvedValue({});
  });

  it("skip si aucun resultat offline existant pour ce pairing", async () => {
    m.matchFindFirst.mockResolvedValue(null);
    const r = await editOfflineLeagueResult({
      pairingId: "pair-1",
      scoreHome: 1,
      scoreAway: 0,
      casualtiesHome: 0,
      casualtiesAway: 0,
    });
    expect(r).toEqual({ skipped: true, reason: "no-existing-result" });
    expect(recordMock).not.toHaveBeenCalled();
  });

  it("propage le refus de reversion (ex: level-up consomme) sans re-saisir", async () => {
    m.matchFindFirst.mockResolvedValue({ id: "m-1" });
    m.matchFind.mockResolvedValue(
      buildMatch({
        leaguePostMatchSequence: {
          pendingChoices: JSON.stringify([
            { teamPlayerId: "p1", advancementsTaken: 0 },
          ]),
        },
      }),
    );
    m.tpFindMany.mockResolvedValue([
      { id: "p1", advancements: JSON.stringify([{ skillSlug: "block" }]) },
    ]);

    const r = await editOfflineLeagueResult({
      pairingId: "pair-1",
      scoreHome: 1,
      scoreAway: 0,
      casualtiesHome: 0,
      casualtiesAway: 0,
    });
    expect(r).toEqual({ skipped: true, reason: "advancement-consumed" });
    expect(recordMock).not.toHaveBeenCalled();
  });

  it("annule puis re-saisit quand la reversion reussit", async () => {
    m.matchFindFirst.mockResolvedValue({ id: "m-1" });
    m.matchFind.mockResolvedValue(buildMatch());
    recordMock.mockResolvedValue({
      recorded: true,
      pairingId: "pair-1",
      matchId: "m-2",
      winner: "home",
      sppPlayersUpdated: 0,
    });

    const newInput = {
      pairingId: "pair-1",
      scoreHome: 3,
      scoreAway: 3,
      casualtiesHome: 0,
      casualtiesAway: 0,
    };
    const r = await editOfflineLeagueResult(newInput);

    // reversion effectuee (match supprime) PUIS re-saisie avec le nouvel input.
    expect(m.matchDelete).toHaveBeenCalledWith({ where: { id: "m-1" } });
    expect(recordMock).toHaveBeenCalledWith(newInput);
    expect(r).toMatchObject({ recorded: true, matchId: "m-2" });
  });
});
