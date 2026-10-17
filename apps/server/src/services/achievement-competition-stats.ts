/**
 * Ce que les compétitions apportent aux statistiques de succès d'un coach.
 *
 * Les succès « Jouer N matchs », « Gagner N matchs », « Marquer N TD »,
 * « Infliger N sorties », « Pionnier / Maître de <équipe> » ne comptaient
 * que les matchs EN LIGNE. Un coach de ligue ou de coupe — le cœur du site,
 * qui se joue sur table et se saisit sur une feuille — n'en débloquait aucun.
 *
 * Deux sources, celles du bilan de la fiche d'équipe :
 *  - LIGUE : les compteurs de `LeagueParticipant` (ceux du classement),
 *    sommés par équipe — un match = une victoire, un nul ou une défaite ;
 *  - COUPE : le `LocalMatch` complété que matérialise la validation d'une
 *    feuille de coupe, et ses actions pour les sorties (au contact, la règle
 *    de `cupActorGesture`, comme les classements individuels de la coupe).
 *
 * Les amicaux (`LocalMatch` hors coupe, dont l'entraînement contre l'IA) ne
 * comptent pas : un succès se gagne en compétition.
 *
 * Un match en ligne de LIGUE déjà reporté au classement (`leagueScoredAt`)
 * est compté ici, par la ligue : l'appelant l'écarte de sa lecture en ligne.
 *
 * Module PUR.
 */

import { cupActorGesture } from "./cup-player-stats";

export interface CompetitionTeam {
  readonly id: string;
  readonly roster: string;
}

/** `_sum` d'un `leagueParticipant.groupBy` par équipe. */
export interface LeagueTeamSums {
  readonly teamId: string;
  readonly _sum: {
    readonly wins?: number | null;
    readonly draws?: number | null;
    readonly losses?: number | null;
    readonly touchdownsFor?: number | null;
    readonly casualtiesFor?: number | null;
  } | null;
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
  readonly leagueSums: readonly LeagueTeamSums[];
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

  for (const row of input.leagueSums) {
    if (!rosterByTeam.has(row.teamId)) continue;
    record(row.teamId, {
      wins: row._sum?.wins ?? 0,
      draws: row._sum?.draws ?? 0,
      losses: row._sum?.losses ?? 0,
    });
    touchdowns += row._sum?.touchdownsFor ?? 0;
    casualties += row._sum?.casualtiesFor ?? 0;
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
      record(teamId, {
        wins: mine > theirs ? 1 : 0,
        draws: mine === theirs ? 1 : 0,
        losses: mine < theirs ? 1 : 0,
      });
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
