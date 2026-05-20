/**
 * Service replay (Phase 3.G) : recree une league fictive sur une
 * saison passee deja ingee (NflGameStat presents), draft automatique,
 * settle weeks sequentiellement.
 *
 * Permet de valider end-to-end le pipeline (draft → lineup → matchup
 * → settle → standings) sur des stats reelles avant la mise en ligne.
 *
 * Pre-requis : la saison cible doit etre seedee + ingerees (via
 * backfillNflSeason). La saison reelle a `NflGameStat.computedSpp` non
 * null pour les players du roster.
 *
 * Pattern : reutilise les services existants (createLeague,
 * autoFillRosters, finalizeLeague, setLineup, generateMatchups,
 * lockLineups, settleNflFantasyWeek). Ne duplique pas la logique.
 */

import { prisma } from "../prisma";
import { autoFillRosters, finalizeLeague } from "./nfl-fantasy-draft";
import { createLeague } from "./nfl-fantasy-league";
import { lockLineups, setLineup } from "./nfl-fantasy-lineup";
import { getRosterWithPlayers } from "./nfl-fantasy-roster";
import {
  generateMatchups,
  settleNflFantasyWeek,
} from "./nfl-fantasy-scoring";

// ────────────────────────────────────────────────────────────────────
// Erreurs typees
// ────────────────────────────────────────────────────────────────────

export class NflFantasyReplayError extends Error {
  constructor(
    public readonly code:
      | "SEASON_NOT_FOUND"
      | "INVALID_TEAM_COUNT"
      | "INVALID_WEEK_RANGE",
    message: string,
  ) {
    super(message);
    this.name = "NflFantasyReplayError";
  }
}

// ────────────────────────────────────────────────────────────────────
// Replay
// ────────────────────────────────────────────────────────────────────

/**
 * Mode de construction du lineup hebdomadaire :
 *  - `first11` : prend les 11 premiers du roster (ordre acquisition).
 *    Reproduit un comportement coach passif / fixe.
 *  - `optimal` : pour chaque week, lit les NflGameStat.computedSpp
 *    et selectionne les 11 plus hauts scorers du roster pour CETTE
 *    week. Captain = top 1, vice = top 2. C'est du hindsight cheating
 *    mais utile pour donner un upper-bound de score atteignable.
 */
export type ReplayLineupMode = "first11" | "optimal";

export interface ReplaySeasonOpts {
  readonly seasonId: string;
  /** Default 8, range 2-16. */
  readonly teamCount?: number;
  /** Default 15, range 11-30. */
  readonly playersPerEntry?: number;
  /** Default 1. */
  readonly fromWeek?: number;
  /** Default 18 (skip playoffs par default). */
  readonly toWeek?: number;
  /** Default 'first11'. Voir {@link ReplayLineupMode}. */
  readonly lineupMode?: ReplayLineupMode;
  /** Optionnel — owner Id custom (default: synthetique replay-{ts}). */
  readonly ownerId?: string;
  /** Optionnel — suffixe ajoute au nom de league. */
  readonly nameSuffix?: string;
  /** Callback de progression par week. */
  readonly onProgress?: (
    weekNumber: number,
    status: "settled" | "failed",
    error?: string,
  ) => void;
}

export interface ReplaySeasonResult {
  readonly leagueId: string;
  readonly seasonId: string;
  readonly teamCount: number;
  readonly fromWeek: number;
  readonly toWeek: number;
  readonly lineupMode: ReplayLineupMode;
  readonly weeksSettled: number;
  readonly weeksFailed: number;
  readonly errors: ReadonlyArray<{ weekNumber: number; error: string }>;
}

const DEFAULT_TEAM_COUNT = 8;
const DEFAULT_PLAYERS_PER_ENTRY = 15;
const MIN_TEAMS = 2;
const MAX_TEAMS = 16;

/**
 * Crée une league de replay sur une saison passée et settle weeks
 * fromWeek..toWeek sequentiellement.
 *
 * Flow :
 *   1. Verifie que la saison existe
 *   2. createLeague (owner synthetique) avec l'owner entry
 *   3. Cree teamCount-1 entries additionnelles directement (skip
 *      joinLeague qui dependrait d'inviteCode)
 *   4. autoFillRosters (deterministe par seed = leagueId)
 *   5. finalizeLeague (status → in_progress, seed 8 rerolls / entry)
 *   6. Pour chaque week : setLineup (11 premiers du roster, captain=0,
 *      vice=1) → generateMatchups → lockLineups → settleNflFantasyWeek
 *
 * Errors par week sont collectees, la boucle continue.
 */
export async function replaySeason(
  opts: ReplaySeasonOpts,
): Promise<ReplaySeasonResult> {
  const teamCount = opts.teamCount ?? DEFAULT_TEAM_COUNT;
  const playersPerEntry = opts.playersPerEntry ?? DEFAULT_PLAYERS_PER_ENTRY;
  const fromWeek = opts.fromWeek ?? 1;
  const toWeek = opts.toWeek ?? 18;
  const lineupMode: ReplayLineupMode = opts.lineupMode ?? "first11";

  if (
    !Number.isInteger(teamCount) ||
    teamCount < MIN_TEAMS ||
    teamCount > MAX_TEAMS
  ) {
    throw new NflFantasyReplayError(
      "INVALID_TEAM_COUNT",
      `teamCount doit etre entre ${MIN_TEAMS} et ${MAX_TEAMS} (recu ${teamCount})`,
    );
  }
  if (
    !Number.isInteger(fromWeek) ||
    !Number.isInteger(toWeek) ||
    fromWeek < 1 ||
    toWeek > 22 ||
    fromWeek > toWeek
  ) {
    throw new NflFantasyReplayError(
      "INVALID_WEEK_RANGE",
      `range invalide [${fromWeek}, ${toWeek}], attendu 1..22 avec from <= to`,
    );
  }

  const season = await prisma.nflSeason.findUnique({
    where: { id: opts.seasonId },
  });
  if (!season) {
    throw new NflFantasyReplayError(
      "SEASON_NOT_FOUND",
      `NflSeason ${opts.seasonId} introuvable — utilise backfill-past-seasons d'abord`,
    );
  }

  const ts = Date.now();
  const ownerId = opts.ownerId ?? `replay-${opts.seasonId}-owner-${ts}`;
  const name = `Replay ${opts.seasonId}${opts.nameSuffix ? ` — ${opts.nameSuffix}` : ` — ${teamCount} teams`}`;

  // 1. Create league + owner entry
  const league = await createLeague({
    ownerId,
    name,
    teamName: `Replay Owner ${opts.seasonId}`,
    seasonId: opts.seasonId,
    size: teamCount,
    type: "private",
    draftMode: "snake",
  });

  // 2. Add teamCount-1 entries directement (skip joinLeague pour
  //    eviter la dance inviteCode dans un contexte admin)
  for (let i = 1; i < teamCount; i++) {
    await prisma.nflFantasyEntry.create({
      data: {
        leagueId: league.id,
        userId: `replay-${opts.seasonId}-team${i}-${ts}`,
        teamName: `Replay Team ${i}`,
      },
    });
  }

  // 3. AutoFill (deterministe par seed = leagueId)
  await autoFillRosters({ leagueId: league.id, playersPerEntry });

  // 4. Finalize → in_progress + seed rerolls
  await finalizeLeague({ leagueId: league.id });

  const entries = await prisma.nflFantasyEntry.findMany({
    where: { leagueId: league.id },
    orderBy: { joinedAt: "asc" },
  });

  let weeksSettled = 0;
  let weeksFailed = 0;
  const errors: Array<{ weekNumber: number; error: string }> = [];

  for (let w = fromWeek; w <= toWeek; w++) {
    const weekId = `${opts.seasonId}:W${w}`;
    try {
      // 5.1. setLineup pour chaque entry. Le choix des starters depend
      //      de lineupMode :
      //   - 'first11' : 11 premiers du roster (ordre acquisition)
      //   - 'optimal' : top 11 SPP earners du roster pour cette week
      //                 (lit NflGameStat.computedSpp, hindsight)
      for (const entry of entries) {
        const roster = await getRosterWithPlayers(entry.id);
        if (roster.length < 11) {
          throw new Error(
            `Entry ${entry.id} a seulement ${roster.length} joueurs (besoin >= 11)`,
          );
        }

        const playerOrder =
          lineupMode === "optimal"
            ? await pickOptimalStarters(roster, weekId)
            : roster.slice(0, 11);

        const starters = playerOrder.map((r) => ({
          playerId: r.player!.id,
          bbPosition: r.player!.bbPosition,
        }));
        await setLineup({
          entryId: entry.id,
          weekId,
          starters,
          captainId: starters[0]!.playerId,
          viceCaptainId: starters[1]!.playerId,
        });
      }

      // 5.2. generateMatchups (idempotent — skip si exist deja pour
      //      la week)
      await generateMatchups({ leagueId: league.id, weekId });

      // 5.3. lockLineups (necessaire pour settle qui exige
      //      lockedAt != null)
      await lockLineups(weekId);

      // 5.4. settleNflFantasyWeek (lit NflGameStat.computedSpp,
      //      applique captain ×1.5 / vice ×1.2, persiste scores +
      //      winnerId + settledAt sur matchups + finalSpp sur
      //      starters)
      await settleNflFantasyWeek({ leagueId: league.id, weekId });

      weeksSettled++;
      opts.onProgress?.(w, "settled");
    } catch (e) {
      const msg = (e as Error).message;
      weeksFailed++;
      errors.push({ weekNumber: w, error: msg });
      opts.onProgress?.(w, "failed", msg);
    }
  }

  return {
    leagueId: league.id,
    seasonId: opts.seasonId,
    teamCount,
    fromWeek,
    toWeek,
    lineupMode,
    weeksSettled,
    weeksFailed,
    errors,
  };
}

/**
 * Pour le mode 'optimal' : trie le roster par SPP descending sur la
 * week donnee (somme des computedSpp des stats de la week) et
 * retourne les 11 premiers. Les joueurs qui n'ont pas joue (pas de
 * stat) terminent en queue (SPP = 0). En cas d'egalite, conserve
 * l'ordre roster (stable).
 */
async function pickOptimalStarters<R extends { player: { id: string } | null }>(
  roster: ReadonlyArray<R>,
  weekId: string,
): Promise<R[]> {
  const playerIds = roster
    .map((r) => r.player?.id)
    .filter((id): id is string => typeof id === "string");
  if (playerIds.length === 0) return [];

  type StatRow = { playerId: string; computedSpp: number | null };
  const stats = (await prisma.nflGameStat.findMany({
    where: { playerId: { in: playerIds }, game: { weekId } },
    select: { playerId: true, computedSpp: true },
  })) as StatRow[];

  const sppByPlayer = new Map<string, number>();
  for (const s of stats) {
    const prev = sppByPlayer.get(s.playerId) ?? 0;
    sppByPlayer.set(s.playerId, prev + (s.computedSpp ?? 0));
  }

  // Tri stable : indexe l'ordre roster pour tie-break.
  const indexed = roster.map((r, i) => ({
    r,
    i,
    spp: r.player ? (sppByPlayer.get(r.player.id) ?? 0) : 0,
  }));
  indexed.sort((a, b) => (b.spp - a.spp) || (a.i - b.i));
  return indexed.slice(0, 11).map((x) => x.r);
}
