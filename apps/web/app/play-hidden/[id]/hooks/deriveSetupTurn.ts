import type { ExtendedGameState } from "@bb/game-engine";

type TeamSide = "A" | "B";

/**
 * Derives whether it's the current player's turn based on the game state.
 * Used after WebSocket state updates to keep isMyTurn in sync
 * without waiting for polling.
 *
 * During setup phase: checks preMatch.currentCoach
 * During kickoff-sequence: checks preMatch.currentCoach (kicking team acts)
 * During playing: checks currentPlayer
 */
export function deriveIsMyTurn(
  state: ExtendedGameState,
  myTeamSide: TeamSide | null,
): boolean {
  if (!myTeamSide) return false;

  const phase = state.preMatch?.phase;

  // Setup and kickoff phases: currentCoach is the acting player
  if (phase === "setup" || phase === "kickoff-sequence") {
    return state.preMatch.currentCoach === myTeamSide;
  }

  // Playing phase: currentPlayer is the acting player
  if (state.gamePhase === "playing") {
    return state.currentPlayer === myTeamSide;
  }

  return false;
}
