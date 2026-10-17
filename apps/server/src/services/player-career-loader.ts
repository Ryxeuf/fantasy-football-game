/**
 * Chargement de la carrière TOUTES compétitions des joueurs d'un ensemble
 * d'équipes (cf. `player-career-stats` pour la règle).
 *
 * Trois lectures, quel que soit le nombre de joueurs (pas de N+1) :
 *  1. les joueurs des équipes, tous statuts (un mort a joué ses matchs) ;
 *  2. les feuilles VALIDÉES où l'une de ces équipes est engagée — ligue
 *     (via le participant) ou coupe (via la rencontre) — avec leur journal ;
 *  3. pour la ligue, le snapshot de validation du `Match` offline, qui dit
 *     quels joueurs la validation a déjà crédités d'un match.
 *
 * Enrichissement d'AFFICHAGE : les appelants l'enveloppent dans un
 * `try/catch` et servent les compteurs persistés seuls en cas d'échec.
 */

import { prisma } from "../prisma";
import { OFFLINE_MATCH_MODE } from "./match-modes";
import type { CupSheetEvent } from "./cup-sheet-actions";
import {
  applyCareerAdjustment,
  computeCompetitionCareerAdjustments,
  persistedPlayerIdsFromOfflineSnapshot,
  type CareerSheet,
  type CareerTeamPlayer,
  type CompetitionCareerAdjustment,
  type PersistedCareer,
  type PlayerCareerTotals,
} from "./player-career-stats";

interface SheetRow {
  readonly pairingId: string | null;
  readonly cupPairingId: string | null;
  readonly forfeitSide: string | null;
  readonly motmPlayerIds: unknown;
  readonly rosterSnapshotHome: unknown;
  readonly rosterSnapshotAway: unknown;
  readonly pairing: {
    readonly homeParticipant: { readonly teamId: string } | null;
    readonly awayParticipant: { readonly teamId: string } | null;
  } | null;
  readonly cupPairing: {
    readonly homeTeamId: string;
    readonly awayTeamId: string | null;
  } | null;
  readonly events: readonly CupSheetEvent[];
}

interface ScoredMatchRow {
  readonly leaguePairingId: string | null;
  readonly mode: string | null;
  readonly offlineResultInput: unknown;
}

/** Client minimal : les tests passent un double, la prod le client global. */
export interface CareerLoaderDb {
  readonly teamPlayer: { findMany: (args: unknown) => Promise<unknown> };
  readonly leagueMatchSheet: { findMany: (args: unknown) => Promise<unknown> };
  readonly match: { findMany: (args: unknown) => Promise<unknown> };
}

export interface CompetitionCareer {
  /** Apport des feuilles, par id de joueur (absent = rien à ajouter). */
  readonly adjustments: Map<string, CompetitionCareerAdjustment>;
  /** Joueurs des équipes lues (tous statuts), poste compris. */
  readonly players: readonly CareerTeamPlayer[];
}

/** Vrai si l'appelant a déjà chargé TOUS les champs que la résolution lit. */
function isCareerTeamPlayer(p: unknown): p is CareerTeamPlayer {
  if (!p || typeof p !== "object") return false;
  const r = p as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.teamId === "string" &&
    typeof r.number === "number" &&
    typeof r.name === "string" &&
    typeof r.position === "string"
  );
}

/**
 * Apport des feuilles validées à la carrière de chaque joueur des équipes
 * `teamIds`. `knownPlayers` : TOUS les joueurs de ces équipes (morts et
 * licenciés compris), quand l'appelant les a déjà chargés — on ne les relit
 * pas.
 */
export async function loadCompetitionCareer(
  teamIds: readonly string[],
  db: CareerLoaderDb = prisma as unknown as CareerLoaderDb,
  knownPlayers?: readonly CareerTeamPlayer[],
): Promise<CompetitionCareer> {
  const ids = [...new Set(teamIds)].filter(Boolean);
  if (ids.length === 0) return { adjustments: new Map(), players: [] };

  const [players, sheets] = (await Promise.all([
    knownPlayers ??
      db.teamPlayer.findMany({
        where: { teamId: { in: ids } },
        select: { id: true, teamId: true, number: true, name: true, position: true },
      }),
    db.leagueMatchSheet.findMany({
      where: {
        status: "validated",
        OR: [
          { pairing: { homeParticipant: { teamId: { in: ids } } } },
          { pairing: { awayParticipant: { teamId: { in: ids } } } },
          { cupPairing: { homeTeamId: { in: ids } } },
          { cupPairing: { awayTeamId: { in: ids } } },
        ],
      },
      select: {
        pairingId: true,
        cupPairingId: true,
        forfeitSide: true,
        motmPlayerIds: true,
        rosterSnapshotHome: true,
        rosterSnapshotAway: true,
        pairing: {
          select: {
            homeParticipant: { select: { teamId: true } },
            awayParticipant: { select: { teamId: true } },
          },
        },
        cupPairing: { select: { homeTeamId: true, awayTeamId: true } },
        events: {
          select: {
            kind: true,
            team: true,
            actorPlayerId: true,
            targetPlayerId: true,
            causeDetail: true,
            injurySeverity: true,
            meta: true,
          },
        },
      },
    }),
  ])) as [CareerTeamPlayer[], SheetRow[]];

  if (sheets.length === 0) return { adjustments: new Map(), players };

  // Ligue : le Match qui a noté chaque rencontre (au plus un :
  // `leaguePairingId` est unique, une invalidation supprime le Match offline).
  // Offline : son snapshot dit qui la validation a crédité. En ligne : la fin
  // de partie a crédité chaque joueur aligné, rien à ajouter.
  const leaguePairingIds = sheets
    .filter((s) => s.pairingId && !s.cupPairingId)
    .map((s) => s.pairingId as string);
  const persistedByPairing = new Map<string, string[] | "all" | null>();
  if (leaguePairingIds.length > 0) {
    const matches = (await db.match.findMany({
      where: {
        leaguePairingId: { in: leaguePairingIds },
        leagueScoredAt: { not: null },
      },
      select: { leaguePairingId: true, mode: true, offlineResultInput: true },
    })) as ScoredMatchRow[];
    for (const m of matches) {
      if (!m.leaguePairingId) continue;
      persistedByPairing.set(
        m.leaguePairingId,
        m.mode === OFFLINE_MATCH_MODE
          ? persistedPlayerIdsFromOfflineSnapshot(m.offlineResultInput)
          : "all",
      );
    }
  }

  const careerSheets: CareerSheet[] = sheets.map((s) => {
    const isCup = Boolean(s.cupPairingId);
    return {
      kind: isCup ? "cup" : "league",
      homeTeamId: isCup
        ? (s.cupPairing?.homeTeamId ?? null)
        : (s.pairing?.homeParticipant?.teamId ?? null),
      awayTeamId: isCup
        ? (s.cupPairing?.awayTeamId ?? null)
        : (s.pairing?.awayParticipant?.teamId ?? null),
      forfeit: s.forfeitSide === "home" || s.forfeitSide === "away",
      motmPlayerIds: s.motmPlayerIds,
      rosterSnapshotHome: s.rosterSnapshotHome,
      rosterSnapshotAway: s.rosterSnapshotAway,
      events: s.events ?? [],
      persistedPlayerIds:
        !isCup && s.pairingId ? (persistedByPairing.get(s.pairingId) ?? null) : null,
    };
  });

  return {
    adjustments: computeCompetitionCareerAdjustments({ sheets: careerSheets, players }),
    players,
  };
}

/**
 * Apport des feuilles validées à la carrière de chaque joueur des équipes
 * `teamIds`. Un joueur absent de la map n'a rien à ajouter.
 */
export async function loadCompetitionCareerAdjustments(
  teamIds: readonly string[],
  db?: CareerLoaderDb,
  knownPlayers?: readonly CareerTeamPlayer[],
): Promise<Map<string, CompetitionCareerAdjustment>> {
  return (await loadCompetitionCareer(teamIds, db, knownPlayers)).adjustments;
}

/**
 * Carrière toutes compétitions de chaque joueur fourni (compteurs persistés
 * déjà chargés), indexée par id. Ne lève jamais : en cas d'échec de lecture
 * des feuilles, la carrière se réduit aux compteurs persistés (journalisé
 * par l'appelant via `onError`).
 */
export async function buildPlayerCareerTotals(
  teamIds: readonly string[],
  players: ReadonlyArray<PersistedCareer & { readonly id: string }>,
  onError: (e: unknown) => void = () => {},
  db?: CareerLoaderDb,
): Promise<Map<string, PlayerCareerTotals>> {
  let adjustments = new Map<string, CompetitionCareerAdjustment>();
  // La fiche d'équipe a déjà chargé ses joueurs (tous statuts, poste
  // compris) : pas de seconde lecture. Un appelant qui n'a chargé que les
  // compteurs laisse le chargeur les relire.
  const known = players.every(isCareerTeamPlayer)
    ? (players as unknown as CareerTeamPlayer[])
    : undefined;
  try {
    adjustments = await loadCompetitionCareerAdjustments(teamIds, db, known);
  } catch (e: unknown) {
    onError(e);
  }
  return new Map(
    players.map((p) => [p.id, applyCareerAdjustment(p, adjustments.get(p.id))]),
  );
}
