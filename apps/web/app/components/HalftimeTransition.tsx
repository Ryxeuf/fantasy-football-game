"use client";

import type { ExtendedGameState, GameState } from "@bb/game-engine";

interface HalftimeTransitionProps {
  state: ExtendedGameState | GameState;
  onAcknowledge: () => void;
}

/**
 * Overlay affiché au passage de la 1ère à la 2e mi-temps (B1.7).
 * - Annonce la mi-temps et rappelle le score
 * - Résume les joueurs KO récupérés depuis le dernier log de récupération
 * - Prévient que la 2e mi-temps démarre par un re-setup + re-kickoff
 *
 * Bloquant : le joueur doit cliquer sur le CTA pour continuer. La dismiss est
 * purement UI (pas de mutation de state serveur) — voir play/[id]/page.tsx.
 */
export default function HalftimeTransition({
  state,
  onAcknowledge,
}: HalftimeTransitionProps) {
  const teamAName = state.teamNames?.teamA ?? "Équipe A";
  const teamBName = state.teamNames?.teamB ?? "Équipe B";
  const scoreA = state.score?.teamA ?? 0;
  const scoreB = state.score?.teamB ?? 0;

  // Extraire la dernière ligne de récupération KO du log pour résumé
  const koRecoveryLogs = (state.gameLog ?? []).filter((log) =>
    log.message?.includes("récupèrent du KO"),
  );
  const lastKoSummary = koRecoveryLogs[koRecoveryLogs.length - 1]?.message;

  const kickingTeamKey = state.kickingTeam === "A" ? "teamA" : "teamB";
  const receivingTeamKey = state.kickingTeam === "A" ? "teamB" : "teamA";
  const kickingTeamName = state.teamNames?.[kickingTeamKey] ?? kickingTeamKey;
  const receivingTeamName =
    state.teamNames?.[receivingTeamKey] ?? receivingTeamKey;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="halftime-title"
      data-testid="halftime-transition"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h2
          id="halftime-title"
          className="text-center text-3xl font-bold text-amber-600"
        >
          Mi-temps
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Fin de la 1ère mi-temps
        </p>

        <div className="mt-6 flex items-center justify-around rounded-xl bg-gray-50 p-4">
          <div className="flex flex-col items-center">
            <span className="text-sm font-medium text-gray-700">
              {teamAName}
            </span>
            <span className="text-4xl font-bold text-gray-900">{scoreA}</span>
          </div>
          <span className="text-2xl font-light text-gray-400">—</span>
          <div className="flex flex-col items-center">
            <span className="text-sm font-medium text-gray-700">
              {teamBName}
            </span>
            <span className="text-4xl font-bold text-gray-900">{scoreB}</span>
          </div>
        </div>

        {lastKoSummary ? (
          <p
            data-testid="halftime-ko-summary"
            className="mt-4 rounded-md bg-green-50 px-3 py-2 text-center text-sm text-green-800"
          >
            {lastKoSummary}
          </p>
        ) : null}

        <div className="mt-4 space-y-1 text-sm text-gray-700">
          <p>
            <span className="font-semibold">{kickingTeamName}</span> frappe au
            pied.
          </p>
          <p>
            <span className="font-semibold">{receivingTeamName}</span> reçoit et
            joue en premier.
          </p>
          <p className="text-xs text-gray-500">
            Les deux équipes repositionnent leurs joueurs avant le kickoff.
          </p>
        </div>

        <button
          // autoFocus garantit que la tabulation clavier commence sur le CTA
          // (minimum pour la pattern ARIA modal — focus trap complet non requis
          // ici puisque le dialog est blocant et le seul élément interactif).
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          type="button"
          onClick={onAcknowledge}
          data-testid="halftime-acknowledge"
          className="mt-6 w-full rounded-lg bg-amber-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
        >
          Commencer la 2e mi-temps
        </button>
      </div>
    </div>
  );
}
