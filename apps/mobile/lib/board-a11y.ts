/**
 * S27.4 (a11y) — Helper pur pour resumer l'etat du jeu a destination
 * des screen readers / VoiceOver.
 *
 * Module locale-agnostic : retourne uniquement les parametres bruts.
 * Le formatage du label final passe par `t("play.a11y.boardLabel", ...)`
 * dans la couche UI (mobile).
 */
import type { GameState, TeamId } from "@bb/game-engine";

export interface BoardA11yParams {
  /** Score equipe A */
  scoreA: number;
  /** Score equipe B */
  scoreB: number;
  /** Mi-temps (1 ou 2) */
  half: number;
  /** Tour courant */
  turn: number;
  /** Equipe active */
  currentTeam: TeamId;
  /** Nom equipe A */
  teamA: string;
  /** Nom equipe B */
  teamB: string;
  /** Nombre de joueurs sur le terrain pour A */
  playersA: number;
  /** Nombre de joueurs sur le terrain pour B */
  playersB: number;
}

/**
 * Compte les joueurs d'une equipe presents sur le terrain (etat
 * `on-field` ou non defini, qui est le defaut historique pour les
 * joueurs places).
 */
function countOnField(state: GameState, team: TeamId): number {
  return state.players.filter(
    (p) => p.team === team && (!p.state || p.state === "on-field"),
  ).length;
}

/**
 * Resume l'etat du jeu pour la lecture par un screen reader.
 *
 * Donne les chiffres bruts ; le formatage en chaine localisee se
 * fait dans la UI via `t("play.a11y.boardLabel", summarize(state))`.
 */
export function summarizeBoardForA11y(state: GameState): BoardA11yParams {
  return {
    scoreA: state.score?.teamA ?? 0,
    scoreB: state.score?.teamB ?? 0,
    half: state.half ?? 1,
    turn: state.turn ?? 1,
    currentTeam: state.currentPlayer,
    teamA: state.teamNames?.teamA ?? "Equipe A",
    teamB: state.teamNames?.teamB ?? "Equipe B",
    playersA: countOnField(state, "A"),
    playersB: countOnField(state, "B"),
  };
}
