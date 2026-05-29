/**
 * Service NFL Fantasy Matchup Detail — vue read-only complete d'un
 * matchup pour repondre "comment j'ai gagne / perdu cette semaine ?".
 *
 * Charge le matchup + ses 2 lineups + leurs starters + les NflPlayer
 * associes + leurs equipes (race) + parse les sppBreakdown stockes
 * pendant le settle pour exposer les events bruts (TD, CP, DP, CAS,
 * MALUS) plus les bonus de skill BB.
 *
 * Pour chaque starter :
 *   - rawSpp  = computedSpp(NFL stats) + skill bonuses (stocke par settle)
 *   - finalSpp = rawSpp x multiplier captain/vice (stocke par settle)
 *   - captainBonus = finalSpp - rawSpp (positif si captain/vice, 0 sinon)
 *
 * Pour chaque side (home/away) :
 *   - totalSpp = somme finalSpp des starters
 *   - topScorer = starter avec le plus gros finalSpp
 *
 * Au niveau matchup :
 *   - margin = homeScore - awayScore (signed)
 *   - decisivePlayers : starters qui, retires du gagnant, auraient inverse
 *     le resultat (heuristique pour la narration "qui a fait gagner").
 *
 * Matchup non-settle : SPP nuls, events vides. Le caller peut quand meme
 * afficher les lineups (qui sont les compositions au moment du lock).
 */

import { prisma } from "../prisma";
import {
  CAPTAIN_MULTIPLIER,
  VICE_CAPTAIN_MULTIPLIER,
} from "./nfl-fantasy-lineup";
import {
  parseSppEvents,
  type SkillBonusEvent,
} from "./nfl-fantasy-skill-bonus";
import type { SppEvent } from "@bb/nfl-mapper";

// ────────────────────────────────────────────────────────────────────
// Erreur typee
// ────────────────────────────────────────────────────────────────────

export type MatchupDetailErrorCode = "MATCHUP_NOT_FOUND" | "LEAGUE_MISMATCH";

export class MatchupDetailError extends Error {
  constructor(
    public readonly code: MatchupDetailErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MatchupDetailError";
  }
}

// ────────────────────────────────────────────────────────────────────
// Types view
// ────────────────────────────────────────────────────────────────────

export interface MatchupStarterView {
  readonly starterId: string;
  readonly playerId: string;
  readonly pseudonym: string;
  readonly teamCode: string | null;
  readonly nflPosition: string;
  readonly bbPosition: string;
  readonly raceLabel: string | null;
  readonly bbRace: string | null;
  readonly isCaptain: boolean;
  readonly isViceCaptain: boolean;
  /** SPP avant multiplier captain. Null si non-settle. */
  readonly rawSpp: number | null;
  /** SPP final apres multiplier. Null si non-settle. */
  readonly finalSpp: number | null;
  /** finalSpp - rawSpp. 0 si pas C/V. */
  readonly captainBonus: number;
  /** Events NFL bruts (TD pass, rush yards, fumbles, etc.). */
  readonly events: ReadonlyArray<SppEvent>;
  /** Bonus de skill BB (Pass +1 par passing TD, etc.). */
  readonly skillBonuses: ReadonlyArray<SkillBonusEvent>;
}

export interface MatchupSideView {
  readonly entryId: string;
  readonly teamName: string;
  readonly lineupId: string | null;
  readonly totalSpp: number;
  /** Top finalSpp de la side. Null si aucun starter score. */
  readonly topScorerId: string | null;
  readonly starters: ReadonlyArray<MatchupStarterView>;
}

export type MatchupOutcome = "home-win" | "away-win" | "tie" | "pending";

export interface MatchupDetailView {
  readonly matchupId: string;
  readonly leagueId: string;
  readonly weekId: string;
  readonly weekNumber: number | null;
  readonly isPlayoffs: boolean;
  readonly settledAt: string | null;
  readonly outcome: MatchupOutcome;
  /** homeScore - awayScore. Null si non-settle. */
  readonly margin: number | null;
  readonly winnerEntryId: string | null;
  readonly home: MatchupSideView;
  readonly away: MatchupSideView;
  /**
   * Gazette narrative LLM (optionnelle, generee post-settle). Null si
   * pas encore generee.
   */
  readonly gazette: {
    readonly title: string;
    readonly body: string;
    readonly generatedAt: string;
  } | null;
}

// ────────────────────────────────────────────────────────────────────
// Helpers (purs)
// ────────────────────────────────────────────────────────────────────

interface ParsedBreakdown {
  readonly events: readonly SppEvent[];
  readonly skillBonuses: readonly SkillBonusEvent[];
}

/**
 * Decompose le sppBreakdown stocke (PG Json natif ou string sqlite)
 * en `{ events, skillBonuses }`. Tolere les payloads vides / corrompus
 * en retournant des arrays vides plutot que de jeter.
 */
export function parseStarterBreakdown(raw: unknown): ParsedBreakdown {
  // parseSppEvents tolere deja string/array/object → utilise le helper
  // existant pour la partie events (qui peut etre soit `[...]` brut,
  // soit `{ events: [...], skillBonuses?: [...] }`).
  const events = parseSppEvents(raw);

  // Pour les skillBonuses, on parse manuellement uniquement si on a un
  // object (PG natif) ou une string parsable. Les versions anciennes
  // (avant Phase 2.F) n'ont pas ce champ → on retourne [].
  let bonusesRaw: unknown = undefined;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    bonusesRaw = (raw as Record<string, unknown>).skillBonuses;
  } else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        bonusesRaw = (parsed as Record<string, unknown>).skillBonuses;
      }
    } catch {
      bonusesRaw = undefined;
    }
  }

  const skillBonuses: SkillBonusEvent[] = [];
  if (Array.isArray(bonusesRaw)) {
    for (const b of bonusesRaw) {
      if (!b || typeof b !== "object") continue;
      const obj = b as Partial<SkillBonusEvent>;
      if (
        typeof obj.skill === "string" &&
        typeof obj.count === "number" &&
        typeof obj.spp === "number" &&
        typeof obj.reason === "string"
      ) {
        skillBonuses.push({
          skill: obj.skill,
          count: obj.count,
          spp: obj.spp,
          reason: obj.reason,
        });
      }
    }
  }

  return { events, skillBonuses };
}

/**
 * Captain/vice gain en SPP par rapport au rawSpp. Pur. Suit
 * `applyCaptainMultiplier` (truncation entiere).
 */
export function computeCaptainBonus(opts: {
  rawSpp: number;
  isCaptain: boolean;
  isViceCaptain: boolean;
}): number {
  if (opts.isCaptain) {
    return Math.trunc(opts.rawSpp * CAPTAIN_MULTIPLIER) - opts.rawSpp;
  }
  if (opts.isViceCaptain) {
    return Math.trunc(opts.rawSpp * VICE_CAPTAIN_MULTIPLIER) - opts.rawSpp;
  }
  return 0;
}

/**
 * Determine l'outcome d'un matchup a partir des scores + settledAt.
 * Pur.
 */
export function computeOutcome(opts: {
  settledAt: Date | null;
  homeScore: number | null;
  awayScore: number | null;
  winnerEntryId: string | null;
  homeEntryId: string;
  awayEntryId: string;
}): MatchupOutcome {
  if (!opts.settledAt) return "pending";
  if (opts.winnerEntryId === opts.homeEntryId) return "home-win";
  if (opts.winnerEntryId === opts.awayEntryId) return "away-win";
  return "tie";
}

// ────────────────────────────────────────────────────────────────────
// Service principal
// ────────────────────────────────────────────────────────────────────

/**
 * Verifie que `matchupId` appartient bien a `leagueId`, charge le
 * detail complet et retourne un MatchupDetailView. Throw
 * MatchupDetailError sinon.
 *
 * Caller responsabilites :
 *   - Authentification (deja faite par authUser middleware en amont)
 *   - Authorisation par appartenance a la league (caller doit verifier
 *     que l'user fait partie de la league via getLeague avant d'appeler
 *     ce service). Pour eviter de dupliquer la logique league-access ici.
 */
export async function getMatchupDetail(opts: {
  leagueId: string;
  matchupId: string;
}): Promise<MatchupDetailView> {
  // 1. Charge le matchup + sanity check leagueId
  const matchup = await prisma.nflFantasyMatchup.findUnique({
    where: { id: opts.matchupId },
  });
  if (!matchup) {
    throw new MatchupDetailError(
      "MATCHUP_NOT_FOUND",
      `Matchup ${opts.matchupId} introuvable`,
    );
  }
  if (matchup.leagueId !== opts.leagueId) {
    throw new MatchupDetailError(
      "LEAGUE_MISMATCH",
      `Matchup ${opts.matchupId} n'appartient pas a la league ${opts.leagueId}`,
    );
  }

  // 2. Resolution des teamName via NflFantasyEntry
  type EntryRow = { id: string; teamName: string };
  const entries: ReadonlyArray<EntryRow> = await prisma.nflFantasyEntry.findMany(
    {
      where: { id: { in: [matchup.homeEntryId, matchup.awayEntryId] } },
      select: { id: true, teamName: true },
    },
  );
  const entryById = new Map(entries.map((e) => [e.id, e] as const));

  // 3. Lineups + starters
  type StarterRow = {
    id: string;
    playerId: string;
    bbPosition: string;
    isCaptain: boolean;
    isViceCaptain: boolean;
    rawSpp: number | null;
    finalSpp: number | null;
    sppBreakdown: unknown;
  };
  type LineupRow = {
    id: string;
    entryId: string;
    totalSpp: number | null;
    starters: StarterRow[];
  };
  const lineups: ReadonlyArray<LineupRow> = await prisma.nflFantasyLineup.findMany(
    {
      where: {
        entryId: { in: [matchup.homeEntryId, matchup.awayEntryId] },
        weekId: matchup.weekId,
      },
      include: { starters: true },
    },
  );
  const lineupByEntry = new Map(lineups.map((l) => [l.entryId, l] as const));

  // 4. NflPlayer meta pour tous les starters (FK logique, JS join)
  const allStarterIds = lineups.flatMap((l) => l.starters.map((s) => s.playerId));
  type PlayerRow = {
    id: string;
    pseudonym: string;
    teamCode: string | null;
    nflPosition: string;
  };
  const players: ReadonlyArray<PlayerRow> =
    allStarterIds.length === 0
      ? []
      : await prisma.nflPlayer.findMany({
          where: { id: { in: allStarterIds } },
          select: {
            id: true,
            pseudonym: true,
            teamCode: true,
            nflPosition: true,
          },
        });
  const playerById = new Map(players.map((p) => [p.id, p] as const));

  // 5. Race + label via NflTeam (1 query par batch de teamCodes)
  const teamCodes = Array.from(
    new Set(
      players
        .map((p) => p.teamCode)
        .filter((c): c is string => typeof c === "string" && c.length > 0),
    ),
  );
  type TeamRow = { code: string; bbRace: string; raceLabel: string };
  const teams: ReadonlyArray<TeamRow> =
    teamCodes.length === 0
      ? []
      : await prisma.nflTeam.findMany({
          where: { code: { in: teamCodes } },
          select: { code: true, bbRace: true, raceLabel: true },
        });
  const teamByCode = new Map(teams.map((t) => [t.code, t] as const));

  // 6. Week meta (weekNumber + isPlayoffs)
  const week = await prisma.nflWeek.findUnique({
    where: { id: matchup.weekId },
    select: { weekNumber: true, isPlayoffs: true },
  });

  // 7. Assemble les MatchupSideView (avec tri starters par finalSpp desc)
  const buildSide = (entryId: string): MatchupSideView => {
    const entry = entryById.get(entryId);
    const lineup = lineupByEntry.get(entryId);
    const starters: MatchupStarterView[] = (lineup?.starters ?? []).map((s) => {
      const player = playerById.get(s.playerId);
      const team = player?.teamCode ? teamByCode.get(player.teamCode) : undefined;
      const { events, skillBonuses } = parseStarterBreakdown(s.sppBreakdown);
      const rawSpp = s.rawSpp;
      const finalSpp = s.finalSpp;
      const captainBonus =
        rawSpp != null
          ? computeCaptainBonus({
              rawSpp,
              isCaptain: s.isCaptain,
              isViceCaptain: s.isViceCaptain,
            })
          : 0;
      return {
        starterId: s.id,
        playerId: s.playerId,
        pseudonym: player?.pseudonym ?? "(inconnu)",
        teamCode: player?.teamCode ?? null,
        nflPosition: player?.nflPosition ?? "?",
        bbPosition: s.bbPosition,
        raceLabel: team?.raceLabel ?? null,
        bbRace: team?.bbRace ?? null,
        isCaptain: s.isCaptain,
        isViceCaptain: s.isViceCaptain,
        rawSpp,
        finalSpp,
        captainBonus,
        events,
        skillBonuses,
      };
    });
    // Tri : finalSpp desc, tiebreak pseudonym asc
    starters.sort((a, b) => {
      const af = a.finalSpp ?? 0;
      const bf = b.finalSpp ?? 0;
      if (af !== bf) return bf - af;
      return a.pseudonym.localeCompare(b.pseudonym);
    });
    const topStarter =
      starters.length > 0 && (starters[0].finalSpp ?? 0) > 0
        ? starters[0]
        : null;
    return {
      entryId,
      teamName: entry?.teamName ?? entryId.slice(0, 8),
      lineupId: lineup?.id ?? null,
      totalSpp: lineup?.totalSpp ?? 0,
      topScorerId: topStarter?.starterId ?? null,
      starters,
    };
  };

  const home = buildSide(matchup.homeEntryId);
  const away = buildSide(matchup.awayEntryId);

  const outcome = computeOutcome({
    settledAt: matchup.settledAt,
    homeScore: matchup.homeScore,
    awayScore: matchup.awayScore,
    winnerEntryId: matchup.winnerId,
    homeEntryId: matchup.homeEntryId,
    awayEntryId: matchup.awayEntryId,
  });

  return {
    matchupId: matchup.id,
    leagueId: matchup.leagueId,
    weekId: matchup.weekId,
    weekNumber: week?.weekNumber ?? null,
    isPlayoffs: week?.isPlayoffs ?? false,
    settledAt: matchup.settledAt?.toISOString() ?? null,
    outcome,
    margin:
      matchup.homeScore != null && matchup.awayScore != null
        ? matchup.homeScore - matchup.awayScore
        : null,
    winnerEntryId: matchup.winnerId ?? null,
    home,
    away,
    gazette:
      matchup.gazetteTitle &&
      matchup.gazetteBody &&
      matchup.gazetteGeneratedAt
        ? {
            title: matchup.gazetteTitle,
            body: matchup.gazetteBody,
            generatedAt: matchup.gazetteGeneratedAt.toISOString(),
          }
        : null,
  };
}
