/**
 * Service NFL Fantasy Draft — Phase A.1.
 *
 * V1 minimal viable : pas de draft interactif (snake en live). Une seule
 * fonction `autoFillRosters` distribue des joueurs aleatoirement (mais
 * deterministe via seed) aux entries d'une league, puis
 * `finalizeLeague` transitionne la league de "draft" -> "in_progress"
 * et seed les 8 rerolls de demarrage par entry.
 *
 * Le snake draft interactif sera un service dedie en Phase A' une fois
 * la stack visualisable bout-en-bout.
 *
 * Pure helper :
 *   - `seededShuffle(seed, items)` : Fisher-Yates avec PRNG xorshift32
 *     pour reproductibilite testable.
 */

import type { NflFantasyLeague } from "@prisma/client";

import { prisma } from "../prisma";
import {
  NflFantasyRosterError,
  addPlayerToRoster,
} from "./nfl-fantasy-roster";
import { seedStartingRerolls } from "./nfl-fantasy-mercato";
import { generateMatchups } from "./nfl-fantasy-scoring";
import { serverLog } from "../utils/server-log";

// ────────────────────────────────────────────────────────────────────
// Erreur typee
// ────────────────────────────────────────────────────────────────────

export type NflFantasyDraftErrorCode =
  | "LEAGUE_NOT_FOUND"
  | "INVALID_STATUS"
  | "NO_ENTRIES"
  | "POOL_TOO_SMALL"
  | "INVALID_PLAYERS_PER_ENTRY"
  /** Au moins un coach a moins de MIN_PLAYERS_PER_ENTRY joueurs draftes. */
  | "INSUFFICIENT_ROSTER"
  /** Retour en draft impossible : une journee est deja resolue. */
  | "WEEK_ALREADY_SETTLED";

export class NflFantasyDraftError extends Error {
  constructor(
    public readonly code: NflFantasyDraftErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "NflFantasyDraftError";
  }
}

// ────────────────────────────────────────────────────────────────────
// Constantes
// ────────────────────────────────────────────────────────────────────

export const DEFAULT_PLAYERS_PER_ENTRY = 15;
export const MIN_PLAYERS_PER_ENTRY = 11;
export const MAX_PLAYERS_PER_ENTRY = 30;

// ────────────────────────────────────────────────────────────────────
// Helpers purs (PRNG + shuffle)
// ────────────────────────────────────────────────────────────────────

/**
 * Mulberry32 PRNG : 32 bits, deterministe, qualite suffisante pour
 * un shuffle (pas pour de la crypto). Pur.
 */
function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Convertit une seed string en u32. Pur, deterministe.
 */
function seedToU32(seed: string): number {
  let h = 2166136261; // FNV offset basis
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * Fisher-Yates shuffle deterministe via seed string. Ne modifie pas
 * `items` : retourne une copie shuffle. Pur.
 */
export function seededShuffle<T>(seed: string, items: ReadonlyArray<T>): T[] {
  const rng = mulberry32(seedToU32(seed));
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

// ────────────────────────────────────────────────────────────────────
// autoFillRosters
// ────────────────────────────────────────────────────────────────────

export interface AutoFillRostersOpts {
  readonly leagueId: string;
  readonly playersPerEntry?: number;
  /**
   * Seed deterministe (pour les tests). Default : `leagueId` (donne un
   * shuffle stable par league, donc re-run du meme call produit le meme
   * resultat tant que le pool de NflPlayer ne bouge pas).
   */
  readonly seed?: string;
}

export interface AutoFillRostersResult {
  readonly leagueId: string;
  readonly entriesFilled: number;
  readonly playersAssigned: number;
  readonly playersPerEntry: number;
}

/**
 * Remplit les rosters de toutes les entries d'une league avec des
 * joueurs aleatoires (deterministes via `seed`), en evitant d'assigner
 * deux fois le meme NflPlayer dans la league.
 *
 * Pre-conditions :
 *   - League existe et status = "draft"
 *   - >= 1 entry
 *   - Pool de NflPlayer.status="active" >= entries × playersPerEntry
 *
 * Side effects :
 *   - addPlayerToRoster pour chaque (entry, playerId) — skip si deja
 *     present (idempotence partielle : re-run apres ajout manuel ne
 *     duplique pas)
 *   - tvCost = 0 en V1 (pas de marche)
 *
 * @throws NflFantasyDraftError
 */
export async function autoFillRosters(
  opts: AutoFillRostersOpts,
): Promise<AutoFillRostersResult> {
  const playersPerEntry = opts.playersPerEntry ?? DEFAULT_PLAYERS_PER_ENTRY;
  if (
    !Number.isInteger(playersPerEntry) ||
    playersPerEntry < MIN_PLAYERS_PER_ENTRY ||
    playersPerEntry > MAX_PLAYERS_PER_ENTRY
  ) {
    throw new NflFantasyDraftError(
      "INVALID_PLAYERS_PER_ENTRY",
      `playersPerEntry doit etre entre ${MIN_PLAYERS_PER_ENTRY} et ${MAX_PLAYERS_PER_ENTRY} (recu ${playersPerEntry})`,
    );
  }

  const league = await prisma.nflFantasyLeague.findUnique({
    where: { id: opts.leagueId },
    include: { entries: { orderBy: { joinedAt: "asc" } } },
  });
  if (!league) {
    throw new NflFantasyDraftError(
      "LEAGUE_NOT_FOUND",
      `League ${opts.leagueId} introuvable`,
    );
  }
  if (league.status !== "draft") {
    throw new NflFantasyDraftError(
      "INVALID_STATUS",
      `League en status '${league.status}', auto-fill requiert 'draft'`,
    );
  }
  if (league.entries.length === 0) {
    throw new NflFantasyDraftError(
      "NO_ENTRIES",
      `League ${opts.leagueId} sans entries`,
    );
  }

  // Pool des NflPlayer actifs deja sur le roster de la league : a exclure.
  const alreadyRostered: ReadonlyArray<{
    playerId: string;
    entryId: string;
  }> = await prisma.nflFantasyRoster.findMany({
    where: { entry: { leagueId: league.id } },
    select: { playerId: true, entryId: true },
  });
  const alreadyIds = new Set(alreadyRostered.map((r) => r.playerId));
  const countByEntry = new Map<string, number>();
  for (const r of alreadyRostered) {
    countByEntry.set(r.entryId, (countByEntry.get(r.entryId) ?? 0) + 1);
  }

  // Combien il manque a chaque entry pour atteindre playersPerEntry.
  const needsByEntry = new Map<string, number>();
  let totalNeeded = 0;
  for (const e of league.entries) {
    const current = countByEntry.get(e.id) ?? 0;
    const need = Math.max(0, playersPerEntry - current);
    needsByEntry.set(e.id, need);
    totalNeeded += need;
  }

  if (totalNeeded === 0) {
    return {
      leagueId: league.id,
      entriesFilled: 0,
      playersAssigned: 0,
      playersPerEntry,
    };
  }

  // Pool : NflPlayer actifs non-deja-rostered. Tri stable par id pour
  // que seededShuffle soit reproductible.
  const pool: ReadonlyArray<{ id: string }> = await prisma.nflPlayer.findMany({
    where: { status: "active", id: { notIn: Array.from(alreadyIds) } },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  if (pool.length < totalNeeded) {
    throw new NflFantasyDraftError(
      "POOL_TOO_SMALL",
      `Pool de ${pool.length} joueurs actifs insuffisant (besoin ${totalNeeded})`,
    );
  }

  const seed = opts.seed ?? league.id;
  const shuffled = seededShuffle(
    seed,
    pool.map((p) => p.id),
  );

  // Distribue dans l'ordre joinedAt : entry[0] -> 15 premiers, entry[1] ->
  // 15 suivants, etc. C'est simple, deterministe, et suffisant V1.
  let cursor = 0;
  let playersAssigned = 0;
  let entriesFilled = 0;
  for (const entry of league.entries) {
    const need = needsByEntry.get(entry.id) ?? 0;
    if (need === 0) continue;
    const slice = shuffled.slice(cursor, cursor + need);
    cursor += need;
    let assigned = 0;
    for (const playerId of slice) {
      try {
        await addPlayerToRoster({
          entryId: entry.id,
          playerId,
          acquiredVia: "draft",
          tvCost: 0,
        });
        assigned++;
      } catch (e) {
        if (
          e instanceof NflFantasyRosterError &&
          e.code === "PLAYER_ALREADY_ON_ROSTER"
        ) {
          // Race : un autre process a deja assigne ce joueur. Skip.
          continue;
        }
        throw e;
      }
    }
    playersAssigned += assigned;
    if (assigned > 0) entriesFilled++;
  }

  return {
    leagueId: league.id,
    entriesFilled,
    playersAssigned,
    playersPerEntry,
  };
}

// ────────────────────────────────────────────────────────────────────
// finalizeLeague
// ────────────────────────────────────────────────────────────────────

export interface FinalizeLeagueOpts {
  readonly leagueId: string;
}

export interface FinalizeLeagueResult {
  readonly leagueId: string;
  readonly status: "in_progress";
  readonly entriesSeeded: number;
  readonly rerollsSeededTotal: number;
  /** Nb total de matchups crees sur l'ensemble des semaines du cycle. */
  readonly matchupsCreated: number;
  /** Nb de semaines pour lesquelles des matchups existaient deja. */
  readonly weeksAlreadyPaired: number;
}

/**
 * Transitionne la league `draft` -> `in_progress` et seed les rerolls
 * de demarrage (8 par entry V1) si pas deja fait.
 *
 * Pre-conditions :
 *   - League existe et status = "draft"
 *
 * Side effects :
 *   - update NflFantasyLeague.status
 *   - seedStartingRerolls par entry (idempotent si deja seed)
 *
 * @throws NflFantasyDraftError
 */
export async function finalizeLeague(
  opts: FinalizeLeagueOpts,
): Promise<FinalizeLeagueResult> {
  const league = await prisma.nflFantasyLeague.findUnique({
    where: { id: opts.leagueId },
    include: { entries: { select: { id: true } } },
  });
  if (!league) {
    throw new NflFantasyDraftError(
      "LEAGUE_NOT_FOUND",
      `League ${opts.leagueId} introuvable`,
    );
  }
  if (league.status !== "draft") {
    throw new NflFantasyDraftError(
      "INVALID_STATUS",
      `League en status '${league.status}', finalize requiert 'draft'`,
    );
  }
  if (league.entries.length === 0) {
    throw new NflFantasyDraftError(
      "NO_ENTRIES",
      `League ${opts.leagueId} sans entries`,
    );
  }

  // Garde-fou (s'applique aussi en mode test) : tous les coachs doivent
  // avoir au moins MIN_PLAYERS_PER_ENTRY joueurs draftes. Sinon ils ne
  // peuvent pas composer de lineup valide (11 titulaires) et la saison
  // est ingerable. Un seul round-trip via groupBy (cf. CLAUDE.md).
  const entryIds = league.entries.map((e: { id: string }) => e.id);
  const rosterCounts = await prisma.nflFantasyRoster.groupBy({
    by: ["entryId"],
    where: { entryId: { in: entryIds } },
    _count: { _all: true },
  });
  const countByEntry = new Map<string, number>();
  for (const c of rosterCounts) {
    countByEntry.set(c.entryId, c._count?._all ?? 0);
  }
  const understaffed = entryIds.filter(
    (id: string) => (countByEntry.get(id) ?? 0) < MIN_PLAYERS_PER_ENTRY,
  );
  if (understaffed.length > 0) {
    throw new NflFantasyDraftError(
      "INSUFFICIENT_ROSTER",
      `${understaffed.length} coach(s) ont moins de ${MIN_PLAYERS_PER_ENTRY} joueurs draftes ; impossible de demarrer la saison (chaque coach doit pouvoir aligner 11 titulaires)`,
    );
  }

  let rerollsSeededTotal = 0;
  for (const e of league.entries) {
    const out = await seedStartingRerolls({ entryId: e.id });
    rerollsSeededTotal += out.rerollsSeeded;
  }

  await prisma.nflFantasyLeague.update({
    where: { id: league.id },
    data: { status: "in_progress" },
  });

  // Pre-generation des matchups : des le demarrage de la saison on
  // calcule les pairings round-robin pour TOUTES les semaines du
  // cycle. Comme ca chaque coach sait des le jour 1 contre qui il
  // joue chaque semaine -> peut adapter ses lineups en consequence.
  // Idempotent (generateMatchups skip si deja existants).
  const matchupsTotals = await preGenerateCycleMatchups(league);

  return {
    leagueId: league.id,
    status: "in_progress",
    entriesSeeded: league.entries.length,
    rerollsSeededTotal,
    matchupsCreated: matchupsTotals.created,
    weeksAlreadyPaired: matchupsTotals.alreadyPaired,
  };
}

// ────────────────────────────────────────────────────────────────────
// revertLeagueToDraft
// ────────────────────────────────────────────────────────────────────

export interface RevertLeagueToDraftOpts {
  readonly leagueId: string;
}

export interface RevertLeagueToDraftResult {
  readonly leagueId: string;
  readonly status: "draft";
  /** Nb de matchups pre-generes supprimes lors du retour en draft. */
  readonly matchupsDeleted: number;
}

/**
 * Repasse un championnat `in_progress` -> `draft` (action mode test).
 *
 * Utile quand l'owner s'apercoit, juste apres avoir demarre, que la
 * saison est mal configuree (roster incomplet, mauvais cycle, etc.) et
 * veut relancer la phase de draft/mercato.
 *
 * Pre-conditions :
 *   - League existe et status = "in_progress"
 *   - AUCUNE journee resolue : aucun NflFantasyMatchup.settledAt non-null.
 *     Une fois la 1ere journee resolue, des SPP/carrieres ont ete
 *     attribues -> revenir en draft corromprait ces donnees.
 *
 * Side effects :
 *   - delete des matchups pre-generes (tous non-settled, garanti par la
 *     garde) pour permettre une regeneration propre au prochain demarrage
 *   - update NflFantasyLeague.status -> "draft"
 *   (les 2 dans une transaction atomique)
 *
 * Les rerolls de demarrage seedes par finalizeLeague sont conserves :
 * seedStartingRerolls est idempotent, donc un nouveau demarrage ne les
 * dupliquera pas.
 *
 * @throws NflFantasyDraftError
 */
export async function revertLeagueToDraft(
  opts: RevertLeagueToDraftOpts,
): Promise<RevertLeagueToDraftResult> {
  const league = await prisma.nflFantasyLeague.findUnique({
    where: { id: opts.leagueId },
    select: { id: true, status: true },
  });
  if (!league) {
    throw new NflFantasyDraftError(
      "LEAGUE_NOT_FOUND",
      `League ${opts.leagueId} introuvable`,
    );
  }
  if (league.status !== "in_progress") {
    throw new NflFantasyDraftError(
      "INVALID_STATUS",
      `League en status '${league.status}', retour en draft requiert 'in_progress'`,
    );
  }

  const settledCount = await prisma.nflFantasyMatchup.count({
    where: { leagueId: league.id, settledAt: { not: null } },
  });
  if (settledCount > 0) {
    throw new NflFantasyDraftError(
      "WEEK_ALREADY_SETTLED",
      "Au moins une journee est deja resolue ; retour en draft impossible",
    );
  }

  // Atomique : suppression des matchups + flip du status dans une seule
  // transaction pour eviter une fenetre incoherente (matchups supprimes
  // mais status encore in_progress) si le 2e write echoue.
  const [deleted] = await prisma.$transaction([
    prisma.nflFantasyMatchup.deleteMany({ where: { leagueId: league.id } }),
    prisma.nflFantasyLeague.update({
      where: { id: league.id },
      data: { status: "draft" },
    }),
  ]);

  return {
    leagueId: league.id,
    status: "draft",
    matchupsDeleted: deleted.count,
  };
}

/**
 * Genere les matchups pour chaque NflWeek du cycle adosse au
 * championnat. Idempotent : reutilise generateMatchups (skip si
 * deja paires). Si le championnat n'a pas de cycleId, no-op.
 *
 * Erreurs par semaine logguees mais non bloquantes : on continue
 * pour ne pas bloquer le start-season si une seule semaine pose
 * probleme (ex: nb impair d'entries -> ODD_ENTRIES).
 */
async function preGenerateCycleMatchups(league: {
  id: string;
  seasonId: string;
  cycleId: string | null;
}): Promise<{ created: number; alreadyPaired: number }> {
  if (!league.cycleId) {
    return { created: 0, alreadyPaired: 0 };
  }
  const cycle = await prisma.nflFantasySeasonCycle.findUnique({
    where: { id: league.cycleId },
    select: { startWeek: true, endWeek: true },
  });
  if (!cycle) {
    return { created: 0, alreadyPaired: 0 };
  }
  const weeks = await prisma.nflWeek.findMany({
    where: {
      seasonId: league.seasonId,
      weekNumber: { gte: cycle.startWeek, lte: cycle.endWeek },
    },
    orderBy: { weekNumber: "asc" },
    select: { id: true },
  });

  let created = 0;
  let alreadyPaired = 0;
  for (const w of weeks) {
    try {
      const out = await generateMatchups({
        leagueId: league.id,
        weekId: w.id,
      });
      created += out.matchupsCreated;
      if (out.matchupsCreated === 0 && out.matchupsExisting > 0) {
        alreadyPaired += 1;
      }
    } catch (e) {
      serverLog.error(
        `[nfl-fantasy-draft] preGenerateCycleMatchups failed for week ${w.id}: ${(e as Error).message}`,
      );
    }
  }
  return { created, alreadyPaired };
}

// ────────────────────────────────────────────────────────────────────
// Helpers read-only
// ────────────────────────────────────────────────────────────────────

/**
 * Stats utiles pour piloter la draft (UI admin) :
 * combien de joueurs sont rostered par entry, combien il en faut encore.
 */
export async function getDraftStats(leagueId: string): Promise<{
  leagueId: string;
  status: string;
  perEntry: Array<{ entryId: string; teamName: string; rostered: number }>;
}> {
  const league = await prisma.nflFantasyLeague.findUnique({
    where: { id: leagueId },
    include: {
      entries: {
        orderBy: { joinedAt: "asc" },
        select: {
          id: true,
          teamName: true,
          roster: { select: { id: true } },
        },
      },
    },
  });
  if (!league) {
    throw new NflFantasyDraftError(
      "LEAGUE_NOT_FOUND",
      `League ${leagueId} introuvable`,
    );
  }
  return {
    leagueId,
    status: league.status,
    perEntry: league.entries.map(
      (e: { id: string; teamName: string; roster: ReadonlyArray<unknown> }) => ({
        entryId: e.id,
        teamName: e.teamName,
        rostered: e.roster.length,
      }),
    ),
  };
}

/**
 * Pour l'UI lineup builder : retourne la NflWeek "courante" cote
 * regulier (helper reuse-able par les pages frontend).
 */
export type {
  NflFantasyLeague as NflFantasyLeagueModel,
};
