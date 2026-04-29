"use client";

/**
 * Section affichee sous le board pendant et apres le match :
 *  - `GameLog` : journal des actions (toujours visible si non vide)
 *  - `PostMatchSPP` : visible quand le match est termine, affiche
 *    les SPP par joueur avec match stats / result.
 *
 * Extrait de `play/[id]/page.tsx` dans le cadre du refactor S26.0w.
 */

import { type ExtendedGameState } from "@bb/game-engine";
import { GameLog } from "@bb/ui";
import PostMatchSPP from "../../../components/PostMatchSPP";

interface MatchLogAndSppProps {
  state: ExtendedGameState;
  teamNameA: string | null | undefined;
  teamNameB: string | null | undefined;
}

export function MatchLogAndSpp({
  state,
  teamNameA,
  teamNameB,
}: MatchLogAndSppProps) {
  return (
    <>
      {state.gameLog && state.gameLog.length > 0 && (
        <div className="mt-2 w-full max-w-5xl mx-auto">
          <GameLog logEntries={state.gameLog} />
        </div>
      )}

      {state.gamePhase === "ended" &&
        state.matchStats &&
        Object.keys(state.matchStats).length > 0 &&
        state.matchResult &&
        state.players && (
          <div className="mt-6">
            <PostMatchSPP
              matchStats={state.matchStats}
              matchResult={state.matchResult}
              players={state.players.map((p) => ({
                id: p.id,
                team: p.team,
                name: p.name,
                number: p.number ?? 0,
                position: p.position ?? "",
              }))}
              teamAName={teamNameA || state.teamNames?.teamA || "Équipe A"}
              teamBName={teamNameB || state.teamNames?.teamB || "Équipe B"}
            />
          </div>
        )}
    </>
  );
}
