/**
 * Pronostics vus JOURNÉE par journée — règles d'affichage pures (sans DOM).
 *
 * Les pronostics ne vivent plus en bloc sur la fiche de ligue : chaque
 * journée du calendrier porte un bouton vers SA page, et la fiche ne garde
 * qu'une ligne de résumé. Ce module dérive, de la vue servie par
 * `GET /leagues/seasons/:id/predictions`, l'état de chaque journée pour le
 * lecteur (à faire, fait, à consulter), les liens et la navigation.
 */
import {
  roundLabel,
  viewerEntry,
  type LeaderboardEntryView,
  type PredictionGroup,
  type RoundPredictionsView,
  type SeasonPredictionLeaderboardView,
  type SeasonPredictionsView,
} from "./predictions";

// ---------------------------------------------------------------------------
// Chemins (pages web, pas l'API)
// ---------------------------------------------------------------------------

export function seasonPredictionsPagePath(
  leagueId: string,
  seasonId: string,
): string {
  return `/leagues/${leagueId}/seasons/${seasonId}/predictions`;
}

export function roundPredictionsPagePath(
  leagueId: string,
  seasonId: string,
  roundId: string,
): string {
  return `${seasonPredictionsPagePath(leagueId, seasonId)}/${roundId}`;
}

// ---------------------------------------------------------------------------
// État d'une journée pour le lecteur
// ---------------------------------------------------------------------------

/**
 * - `todo`   : au moins une rencontre que le lecteur peut pronostiquer et
 *              ne l'a pas encore fait ;
 * - `done`   : il a pronostiqué tout ce qui lui est ouvert ;
 * - `open`   : des rencontres sont ouvertes, mais pas pour lui (anonyme,
 *              non-membre, ses propres matchs) ;
 * - `closed` : tout est clos — on vient y lire les résultats.
 */
export type RoundPredictionState = "todo" | "done" | "open" | "closed";

export interface RoundPredictionStatus {
  readonly state: RoundPredictionState;
  /** Rencontres ouvertes au lecteur et encore sans pronostic. */
  readonly todo: number;
  /** Rencontres ouvertes au lecteur, pronostiquées ou non. */
  readonly predictable: number;
}

/**
 * État d'une journée, ou `null` si elle n'a rien à montrer (aucune
 * rencontre, ou seulement des affiches à venir de bracket).
 */
export function roundPredictionStatus(
  round: RoundPredictionsView,
): RoundPredictionStatus | null {
  const real = round.pairings.filter((p) => !p.placeholder);
  if (real.length === 0) return null;
  const predictable = real.filter((p) => p.eligibility === "ok");
  const todo = predictable.filter((p) => p.myPrediction === null).length;
  let state: RoundPredictionState;
  if (todo > 0) state = "todo";
  else if (predictable.length > 0) state = "done";
  else if (real.some((p) => !p.closed)) state = "open";
  else state = "closed";
  return { state, todo, predictable: predictable.length };
}

/** Libellé court du bouton de journée. */
export function roundPredictionLabel(status: RoundPredictionStatus): string {
  switch (status.state) {
    case "todo":
      return `Pronostiquer (${status.todo})`;
    case "done":
      return "Pronostics ✓";
    case "open":
      return "Pronostics";
    case "closed":
      return "Résultats des pronos";
  }
}

export interface RoundPredictionLink {
  readonly href: string;
  readonly label: string;
  readonly state: RoundPredictionState;
}

/**
 * Lien de chaque journée vers sa page de pronostics, indexé par id de
 * journée. Vide si la ligue n'a pas de pronostics : le calendrier n'affiche
 * alors aucun bouton.
 */
export function roundPredictionLinks(
  view: SeasonPredictionsView | null,
  leagueId: string,
): Readonly<Record<string, RoundPredictionLink>> {
  if (!view || view.scope === "off") return {};
  const links: Record<string, RoundPredictionLink> = {};
  for (const round of view.rounds) {
    const status = roundPredictionStatus(round);
    if (!status) continue;
    links[round.id] = {
      href: roundPredictionsPagePath(leagueId, view.seasonId, round.id),
      label: roundPredictionLabel(status),
      state: status.state,
    };
  }
  return links;
}

// ---------------------------------------------------------------------------
// Navigation entre journées
// ---------------------------------------------------------------------------

export interface AdjacentRounds {
  readonly previous: RoundPredictionsView | null;
  readonly current: RoundPredictionsView | null;
  readonly next: RoundPredictionsView | null;
}

/** La journée demandée et ses voisines, dans l'ordre servi par l'API. */
export function adjacentRounds(
  rounds: readonly RoundPredictionsView[],
  roundId: string,
): AdjacentRounds {
  const index = rounds.findIndex((r) => r.id === roundId);
  if (index < 0) return { previous: null, current: null, next: null };
  return {
    previous: index > 0 ? rounds[index - 1] : null,
    current: rounds[index],
    next: index < rounds.length - 1 ? rounds[index + 1] : null,
  };
}

// ---------------------------------------------------------------------------
// Résumé d'une ligne pour la fiche de ligue
// ---------------------------------------------------------------------------

export interface PredictionsDigest {
  /** Première journée où le lecteur a encore quelque chose à saisir. */
  readonly nextRound: RoundPredictionsView | null;
  readonly nextRoundLabel: string | null;
  /** Rencontres à pronostiquer dans cette journée. */
  readonly todo: number;
  /** Place du lecteur dans le classement de SON groupe, s'il y figure. */
  readonly standing: LeaderboardEntryView | null;
  readonly group: PredictionGroup;
}

export function predictionsDigest(
  view: SeasonPredictionsView,
  board: SeasonPredictionLeaderboardView | null,
): PredictionsDigest {
  let nextRound: RoundPredictionsView | null = null;
  let todo = 0;
  for (const round of view.rounds) {
    const status = roundPredictionStatus(round);
    if (status?.state === "todo") {
      nextRound = round;
      todo = status.todo;
      break;
    }
  }
  const group = view.viewer.group ?? "coach";
  return {
    nextRound,
    nextRoundLabel: nextRound ? roundLabel(nextRound) : null,
    todo,
    standing: board ? viewerEntry(board[group]) : null,
    group,
  };
}

/** « 1er », « 2e », « 3e »… */
export function rankLabel(rank: number): string {
  return rank === 1 ? "1er" : `${rank}e`;
}
