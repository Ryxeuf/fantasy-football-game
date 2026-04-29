"use client";

/**
 * Section principale "board" — wrap `<GameBoardWithDugouts>` (Pixi.js)
 * avec ses 12 props injectees. Calcule en interne :
 *  - `legalMoves` : positions legales pour le drag setup ou le move
 *    courant
 *  - `placedPlayers` : depuis preMatch.placedPlayers
 *  - `isSetupPhase` : depuis preMatch.phase
 *
 * Extrait de `play/[id]/page.tsx` dans le cadre du refactor S26.0v.
 */

import dynamic from "next/dynamic";
import {
  type ExtendedGameState,
  type Position,
} from "@bb/game-engine";
import { type TerrainSkinId } from "@bb/ui";

// GameBoardWithDugouts pulls in the entire Pixi.js + @pixi/react bundle.
// It uses Canvas APIs that don't exist on the server, so disable SSR and
// let Next.js emit it as a separate chunk that only ships when the user
// actually opens an online match.
const GameBoardWithDugouts = dynamic(
  () => import("@bb/ui").then((m) => m.GameBoardWithDugouts),
  {
    ssr: false,
    loading: () => (
      <div className="w-full aspect-[2/1] bg-gray-900 text-gray-400 flex items-center justify-center rounded-lg">
        Chargement du plateau…
      </div>
    ),
  },
);

interface BoardSectionProps {
  state: ExtendedGameState;
  onCellClick: (pos: Position) => void;
  movesForSelected: Position[];
  blockTargets: Position[];
  draggedPlayerId: string | null;
  selectedFromReserve: string | null;
  onPlayerClick: (playerId: string) => void;
  onDragStart: (e: React.DragEvent, playerId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  boardContainerRef: React.RefObject<HTMLDivElement>;
  onCellSizeChange: (size: number) => void;
}

export function BoardSection({
  state,
  onCellClick,
  movesForSelected,
  blockTargets,
  draggedPlayerId,
  selectedFromReserve,
  onPlayerClick,
  onDragStart,
  onDragOver,
  onDrop,
  boardContainerRef,
  onCellSizeChange,
}: BoardSectionProps) {
  return (
    <div
      className="flex flex-col lg:flex-row items-start gap-6 mb-6"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Board et sidebar */}
      <div className="flex-1 flex justify-center">
        <GameBoardWithDugouts
          state={state}
          onCellClick={onCellClick}
          legalMoves={
            draggedPlayerId && state.preMatch?.phase === "setup"
              ? state.preMatch.legalSetupPositions
              : movesForSelected
          }
          blockTargets={blockTargets}
          selectedPlayerId={state.selectedPlayerId || undefined}
          selectedForRepositioning={selectedFromReserve}
          placedPlayers={state.preMatch?.placedPlayers || []}
          onPlayerClick={onPlayerClick}
          onDragStart={onDragStart}
          boardContainerRef={boardContainerRef}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onCellSizeChange={onCellSizeChange}
          isSetupPhase={state.preMatch?.phase === "setup"}
          initialTerrainSkin={state.terrainSkin as TerrainSkinId | undefined}
        />
      </div>
      {/* PlayerDetails is now integrated in GameBoardWithDugouts */}
    </div>
  );
}
