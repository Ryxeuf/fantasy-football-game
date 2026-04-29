"use client";

/**
 * Panneau qui resume la phase pre-match courante quand `half === 0`
 * (avant le premier coup d'envoi). Affiche le coin toss puis delegue
 * a `KickoffSequencePanel` ou `SetupPhasePanel` selon la phase.
 *
 * Extrait de `play/[id]/page.tsx` dans le cadre du refactor S26.0t.
 */

import { type ExtendedGameState } from "@bb/game-engine";
import { KickoffSequencePanel } from "./KickoffSequencePanel";
import { SetupPhasePanel } from "./SetupPhasePanel";

interface PreMatchPanelProps {
  state: ExtendedGameState;
  myTeamSide: "A" | "B" | null;
  teamNameA: string | null | undefined;
  teamNameB: string | null | undefined;
  setupError: string | null;
  setupSubmitting: boolean;
  onValidatePlacement: () => void | Promise<void>;
  onCalculateDeviation: () => void | Promise<void>;
  onResolveKickoffEvent: () => void | Promise<void>;
}

export function PreMatchPanel({
  state,
  myTeamSide,
  teamNameA,
  teamNameB,
  setupError,
  setupSubmitting,
  onValidatePlacement,
  onCalculateDeviation,
  onResolveKickoffEvent,
}: PreMatchPanelProps) {
  return (
    <div className="text-center text-sm text-gray-600 bg-white border border-gray-200 shadow-sm p-4 rounded-lg w-full max-w-md">
      {/* Resume du coin toss */}
      {state.preMatch?.kickingTeam && state.preMatch?.receivingTeam && (
        <div className="mb-3 pb-3 border-b border-gray-200">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Coin Toss
          </div>
          <div className="flex justify-center gap-4 text-xs">
            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">
              Frappe :{" "}
              {state.preMatch.kickingTeam === "A"
                ? state.teamNames.teamA
                : state.teamNames.teamB}
            </span>
            <span className="px-2 py-1 bg-green-50 text-green-700 rounded">
              Recoit :{" "}
              {state.preMatch.receivingTeam === "A"
                ? state.teamNames.teamA
                : state.teamNames.teamB}
            </span>
          </div>
        </div>
      )}

      {state.preMatch?.phase === "kickoff" ||
      state.preMatch?.phase === "kickoff-sequence" ? (
        <KickoffSequencePanel
          state={state}
          myTeamSide={myTeamSide}
          onCalculateDeviation={onCalculateDeviation}
          onResolveKickoffEvent={onResolveKickoffEvent}
        />
      ) : state.preMatch?.phase === "setup" ? (
        <SetupPhasePanel
          state={state}
          myTeamSide={myTeamSide}
          teamNameA={teamNameA}
          teamNameB={teamNameB}
          setupError={setupError}
          setupSubmitting={setupSubmitting}
          onValidatePlacement={onValidatePlacement}
        />
      ) : (
        <div>
          <div className="text-gray-500">Phase pré-match en cours...</div>
        </div>
      )}
    </div>
  );
}
