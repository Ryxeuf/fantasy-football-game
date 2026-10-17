/**
 * Ce que les compétitions apportent aux statistiques de succès d'un coach.
 *
 * Les succès « Jouer N matchs », « Gagner N matchs », « Marquer N TD »,
 * « Infliger N sorties », « Pionnier / Maître de <équipe> » ne comptaient
 * que les matchs EN LIGNE. Un coach de ligue ou de coupe — le cœur du site,
 * qui se joue sur table et se saisit sur une feuille — n'en débloquait aucun.
 *
 * Deux sources de matchs JOUÉS :
 *  - LIGUE : le `Match` offline que crée chaque résultat validé (feuille ou
 *    saisie du commissaire), et son snapshot `offlineResultInput` (score et
 *    sorties, réécrits par le rattrapage des sorties). PAS les compteurs de
 *    `LeagueParticipant` : un FORFAIT y inscrit une victoire et des TD sans
 *    qu'aucun match n'ait eu lieu — or un succès paie des Couronnes, et une
 *    ligue montée contre sa propre seconde équipe se laisserait « gagner »
 *    par forfaits. Un forfait ne crée pas de `Match` offline : il est exclu
 *    par construction ;
 *  - COUPE : le `LocalMatch` complété que matérialise la validation d'une
 *    feuille de coupe, et ses actions pour les sorties (au contact, la règle
 *    de `cupActorGesture`, comme les classements individuels de la coupe).
 *
 * Les amicaux (`LocalMatch` hors coupe, dont l'entraînement contre l'IA) ne
 * comptent pas : un succès se gagne en compétition.
 *
 * Un match EN LIGNE déjà reporté au classement (`leagueScoredAt` : un forfait
 * en ligne) n'est compté nulle part : l'appelant l'écarte de sa lecture en
 * ligne, et il n'a pas de `Match` offline.
 *
 * Module PUR.
 */

import { cupActorGesture } from "./cup-player-stats";

export interface CompetitionTeam {
  readonly id: string;
  readonly roster: string;
}

/** `Match` offline d'un résultat de ligue validé. */
export interface LeagueMatchForAchievements {
  readonly homeTeamId: string | null;
  readonly awayTeamId: string | null;
  /** Snapshot `{ input: { scoreHome, scoreAway, casualtiesHome, … } }`. */
  readonly offlineResultInput: unknown;
}

interface LeagueResult {
  readonly scoreHome: number;
  readonly scoreAway: number;
  readonly casualtiesHome: number;
  readonly casualtiesAway: number;
}

/**
 * Score et sorties d'un snapshot `offlineResultInput` (objet natif PG ou
 * chaîne du miroir SQLite). `null` sans score lisible : le match est ignoré.
 */
export function leagueResultFromOfflineSnapshot(raw: unknown): LeagueResult | null {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const input =
    value && typeof value === "object"
      ? (value as { input?: unknown }).input
      : null;
  if (!input || typeof input !== "object") return null;
  const i = input as Record<string, unknown>;
  if (typeof i.scoreHome !== "number" || typeof i.scoreAway !== "number") {
    return null;
  }
  const count = (v: unknown): number => (typeof v === "number" ? v : 0);
  return {
    scoreHome: i.scoreHome,
    scoreAway: i.scoreAway,
    casualtiesHome: count(i.casualtiesHome),
    casualtiesAway: count(i.casualtiesAway),
  };
}

export interface CupMatchForAchievements {
  readonly teamAId: string;
  readonly teamBId: string | null;
  readonly scoreTeamA: number | null;
  readonly scoreTeamB: number | null;
  readonly actions: ReadonlyArray<{
    readonly playerTeam: string;
    readonly actionType: string;
    readonly armorBroken: boolean;
    readonly opponentState: string | null;
  }>;
}

export interface CompetitionAchievementStats {
  readonly matchesPlayed: number;
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
  readonly touchdowns: number;
  readonly casualties: number;
  readonly rostersPlayed: ReadonlySet<string>;
  readonly winsByRoster: ReadonlyMap<string, number>;
}

export function summarizeCompetitionAchievementStats(input: {
  readonly teams: readonly CompetitionTeam[];
  readonly leagueMatches: readonly LeagueMatchForAchievements[];
  readonly cupMatches: readonly CupMatchForAchievements[];
}): CompetitionAchievementStats {
  const rosterByTeam = new Map(input.teams.map((t) => [t.id, t.roster]));
  let matchesPlayed = 0;
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let touchdowns = 0;
  let casualties = 0;
  const rostersPlayed = new Set<string>();
  const winsByRoster = new Map<string, number>();

  const record = (
    teamId: string,
    result: { wins: number; draws: number; losses: number },
  ): void => {
    const played = result.wins + result.draws + result.losses;
    if (played === 0) return;
    matchesPlayed += played;
    wins += result.wins;
    draws += result.draws;
    losses += result.losses;
    const roster = rosterByTeam.get(teamId);
    if (!roster) return;
    rostersPlayed.add(roster);
    if (result.wins > 0) {
      winsByRoster.set(roster, (winsByRoster.get(roster) ?? 0) + result.wins);
    }
  };

  const recordResult = (teamId: string, mine: number, theirs: number): void =>
    record(teamId, {
      wins: mine > theirs ? 1 : 0,
      draws: mine === theirs ? 1 : 0,
      losses: mine < theirs ? 1 : 0,
    });

  for (const match of input.leagueMatches) {
    const result = leagueResultFromOfflineSnapshot(match.offlineResultInput);
    if (!result) continue;
    if (match.homeTeamId && rosterByTeam.has(match.homeTeamId)) {
      recordResult(match.homeTeamId, result.scoreHome, result.scoreAway);
      touchdowns += result.scoreHome;
      casualties += result.casualtiesHome;
    }
    if (match.awayTeamId && rosterByTeam.has(match.awayTeamId)) {
      recordResult(match.awayTeamId, result.scoreAway, result.scoreHome);
      touchdowns += result.scoreAway;
      casualties += result.casualtiesAway;
    }
  }

  for (const match of input.cupMatches) {
    const sides: Array<{ teamId: string | null; side: "A" | "B" }> = [
      { teamId: match.teamAId, side: "A" },
      { teamId: match.teamBId, side: "B" },
    ];
    for (const { teamId, side } of sides) {
      if (!teamId || !rosterByTeam.has(teamId)) continue;
      const mine = (side === "A" ? match.scoreTeamA : match.scoreTeamB) ?? 0;
      const theirs = (side === "A" ? match.scoreTeamB : match.scoreTeamA) ?? 0;
      recordResult(teamId, mine, theirs);
      touchdowns += mine;
      casualties += match.actions.filter(
        (a) => a.playerTeam === side && cupActorGesture(a) === "casualty",
      ).length;
    }
  }

  return {
    matchesPlayed,
    wins,
    draws,
    losses,
    touchdowns,
    casualties,
    rostersPlayed,
    winsByRoster,
  };
}
