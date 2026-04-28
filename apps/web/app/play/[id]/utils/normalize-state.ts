/**
 * Normalise un etat de jeu recu du serveur en garantissant la presence
 * des champs optionnels et des dimensions par defaut. Retourne un nouvel
 * objet (immutable, pas de mutation in-place).
 *
 * Extrait de `play/[id]/page.tsx` dans le cadre du refactor S26.0a.
 */

import { type ExtendedGameState } from "@bb/game-engine";

export function normalizeState(state: any): ExtendedGameState {
  if (!state) return state;
  return {
    ...state,
    playerActions: state.playerActions ?? {},
    teamBlitzCount: state.teamBlitzCount ?? {},
    teamFoulCount: state.teamFoulCount ?? {},
    matchStats: state.matchStats ?? {},
    width: typeof state.width === "number" ? state.width : 26,
    height: typeof state.height === "number" ? state.height : 15,
    selectedPlayerId: state.preMatch?.phase === "setup" ? null : state.selectedPlayerId,
  } as ExtendedGameState;
}
