"use client";

/**
 * Overlays bloquants en haut de page :
 *  - `MatchEndScreen` : affiche le resultat du match (en mode online).
 *  - `HalftimeTransition` : overlay bloquant quand on passe a la mi-temps.
 *
 * Extrait de `play/[id]/page.tsx` dans le cadre du refactor S26.0x.
 */

import { type ExtendedGameState } from "@bb/game-engine";
import MatchEndScreen from "../../../components/MatchEndScreen";
import HalftimeTransition from "../../../components/HalftimeTransition";

interface BlockingOverlaysProps {
  state: ExtendedGameState;
  matchStatus: string | null;
  matchId: string;
  myTeamSide: "A" | "B" | null;
  halftimeDismissedHalf: number | null;
  onAcknowledgeHalftime: (half: number) => void;
}

export function BlockingOverlays({
  state,
  matchStatus,
  matchId,
  myTeamSide,
  halftimeDismissedHalf,
  onAcknowledgeHalftime,
}: BlockingOverlaysProps) {
  return (
    <>
      {matchStatus === "ended" && state.gamePhase === "ended" && (
        <MatchEndScreen
          matchId={matchId}
          myTeamSide={myTeamSide}
          onClose={() => {
            window.location.href = "/lobby";
          }}
        />
      )}
      {state.gamePhase === "halftime" && halftimeDismissedHalf !== state.half && (
        <HalftimeTransition
          state={state}
          onAcknowledge={() => onAcknowledgeHalftime(state.half)}
        />
      )}
    </>
  );
}
