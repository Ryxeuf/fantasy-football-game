"use client";

/**
 * Panneau d'UI pour la sequence de kickoff pre-match.
 *
 * Couvre les 4 sous-etapes (`kickoffStep`):
 * - place-ball : kicker pose le ballon (instructions adverses sinon)
 * - kick-deviation : bouton "Calculer la deviation"
 * - kickoff-event : bouton "Resoudre l'evenement"
 * - undefined : spinner d'attente
 *
 * Les actions API sont passees en props (extraites dans
 * utils/kickoff-actions.ts par S26.0d) ; ce composant ne gere que la
 * presentation et le clic.
 *
 * Extrait de `play/[id]/page.tsx` dans le cadre du refactor S26.0g.
 */

import { type ExtendedGameState } from "@bb/game-engine";

interface KickoffSequencePanelProps {
  state: ExtendedGameState;
  myTeamSide: "A" | "B" | null;
  onCalculateDeviation: () => void | Promise<void>;
  onResolveKickoffEvent: () => void | Promise<void>;
}

export function KickoffSequencePanel({
  state,
  myTeamSide,
  onCalculateDeviation,
  onResolveKickoffEvent,
}: KickoffSequencePanelProps) {
  return (
    <div className="space-y-3">
      <div className="text-lg font-bold text-green-600 mb-1">Sequence de Kickoff</div>

      {state.preMatch?.kickoffStep === "place-ball" && (
        <div>
          <p className="text-sm text-gray-600 mb-2">
            L&apos;equipe qui frappe doit placer le ballon dans la moitie adverse
            {state.preMatch?.receivingTeam && (
              <>
                {" "}(zone de{" "}
                <span className="font-semibold text-green-700">
                  {state.preMatch.receivingTeam === "A"
                    ? state.teamNames.teamA
                    : state.teamNames.teamB}
                </span>
                )
              </>
            )}
            .
          </p>
          {myTeamSide === state.preMatch?.kickingTeam ? (
            <p className="text-sm font-semibold text-blue-600">
              Cliquez sur une case de la moitie adverse pour placer le ballon.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <span className="inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                En attente du placement du ballon par l&apos;adversaire...
              </div>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="text-xs text-gray-500 underline hover:text-gray-700"
              >
                Rien ne se passe ? Rafraichir la page
              </button>
            </div>
          )}
        </div>
      )}

      {state.preMatch?.kickoffStep === "kick-deviation" && (
        <div>
          <p className="text-sm text-gray-600 mb-2">Calcul de la deviation du ballon...</p>
          <button
            onClick={onCalculateDeviation}
            className="px-4 py-2 bg-nuffle-gold hover:bg-nuffle-gold/90 text-nuffle-anthracite font-semibold rounded-lg shadow transition-all"
          >
            Calculer la deviation
          </button>
        </div>
      )}

      {state.preMatch?.kickoffStep === "kickoff-event" && (
        <div>
          <p className="text-sm text-gray-600 mb-2">Resolution de l&apos;evenement de kickoff...</p>
          <button
            onClick={onResolveKickoffEvent}
            className="px-4 py-2 bg-nuffle-gold hover:bg-nuffle-gold/90 text-nuffle-anthracite font-semibold rounded-lg shadow transition-all"
          >
            Resoudre l&apos;evenement
          </button>
        </div>
      )}

      {!state.preMatch?.kickoffStep && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
          <span className="inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          Preparation du kickoff...
        </div>
      )}
    </div>
  );
}
