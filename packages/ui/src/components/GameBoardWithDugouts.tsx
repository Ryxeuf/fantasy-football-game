/**
 * Composant principal du terrain avec les zones de dugout
 * Layout responsive : sur mobile le terrain est plein écran avec dugouts en accordéon
 */

import React, { useState } from "react";
import { GameState, Player } from "@bb/game-engine";
import PixiBoard from "../board/PixiBoard";
import TeamDugoutComponent from "./TeamDugout";
import PlayerDetails from "./PlayerDetails";

interface GameBoardWithDugoutsProps {
  state: GameState | null | undefined;
  onCellClick?: (pos: { x: number; y: number }) => void;
  onPlayerClick?: (playerId: string) => void;
  legalMoves?: { x: number; y: number }[];
  blockTargets?: { x: number; y: number }[];
  selectedPlayerId?: string | null;
  selectedForRepositioning?: string | null;
  onDragStart?: (e: React.DragEvent, playerId: string) => void;
  placedPlayers?: string[];
  boardContainerRef?: React.RefObject<HTMLDivElement>;
  isSetupPhase?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  /** Called when the responsive cell size changes (for drop coordinate math) */
  onCellSizeChange?: (cellSize: number) => void;
}

export default function GameBoardWithDugouts({
  state,
  onCellClick,
  onPlayerClick,
  legalMoves = [],
  blockTargets = [],
  selectedPlayerId,
  selectedForRepositioning,
  onDragStart,
  placedPlayers = [],
  boardContainerRef,
  isSetupPhase = false,
  onDragOver,
  onDrop,
  onCellSizeChange,
}: GameBoardWithDugoutsProps) {
  const [showDugoutA, setShowDugoutA] = useState(false);
  const [showDugoutB, setShowDugoutB] = useState(false);
  const [inspectedPlayer, setInspectedPlayer] = useState<Player | null>(null);

  if (!state) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] bg-gray-100">
        <div className="text-gray-600">Chargement du terrain...</div>
      </div>
    );
  }

  const handlePlayerClick = (playerId: string) => {
    const player = state.players?.find((p) => p.id === playerId) || null;
    setInspectedPlayer(player);
    onPlayerClick?.(playerId);
  };

  const dugoutA = (
    <TeamDugoutComponent
      dugout={state.dugouts?.teamA}
      allPlayers={state.players}
      placedPlayers={placedPlayers}
      onPlayerClick={handlePlayerClick}
      onDragStart={onDragStart}
      teamName={state.teamNames?.teamA}
      isSetupPhase={isSetupPhase}
    />
  );

  const dugoutB = (
    <TeamDugoutComponent
      dugout={state.dugouts?.teamB}
      allPlayers={state.players}
      placedPlayers={placedPlayers}
      onPlayerClick={handlePlayerClick}
      onDragStart={onDragStart}
      teamName={state.teamNames?.teamB}
      isSetupPhase={isSetupPhase}
    />
  );

  return (
    <div className="relative bg-gray-100 min-h-screen">
      {/* Mobile: dugout toggle buttons (hidden on desktop) */}
      <div className="lg:hidden flex gap-2 px-3 pt-3 pb-1">
        <button
          onClick={() => { setShowDugoutA(!showDugoutA); setShowDugoutB(false); }}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
            showDugoutA
              ? "bg-red-600 text-white"
              : "bg-red-100 text-red-800 border border-red-300"
          }`}
        >
          {state.teamNames?.teamA || "Equipe A"}
        </button>
        <button
          onClick={() => { setShowDugoutB(!showDugoutB); setShowDugoutA(false); }}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
            showDugoutB
              ? "bg-blue-600 text-white"
              : "bg-blue-100 text-blue-800 border border-blue-300"
          }`}
        >
          {state.teamNames?.teamB || "Equipe B"}
        </button>
      </div>

      {/* Mobile: collapsible dugout panels (hidden on desktop) */}
      {showDugoutA && (
        <div className="lg:hidden px-3 pb-2">{dugoutA}</div>
      )}
      {showDugoutB && (
        <div className="lg:hidden px-3 pb-2">{dugoutB}</div>
      )}

      {/* Main layout: desktop side-by-side, mobile board-only */}
      <div className="flex flex-col lg:flex-row items-start gap-4 p-2 lg:p-4">
        {/* Dugout A - desktop only */}
        <div className="hidden lg:block flex-shrink-0">{dugoutA}</div>

        {/* Board - single instance, always rendered */}
        <div
          className="w-full lg:w-auto lg:flex-shrink-0"
          ref={boardContainerRef}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          <PixiBoard
            state={state}
            onCellClick={onCellClick}
            onPlayerClick={handlePlayerClick}
            legalMoves={legalMoves}
            blockTargets={blockTargets}
            selectedPlayerId={selectedPlayerId}
            selectedForRepositioning={selectedForRepositioning}
            onCellSizeChange={onCellSizeChange}
          />
        </div>

        {/* Dugout B - desktop only */}
        <div className="hidden lg:block flex-shrink-0">{dugoutB}</div>
      </div>

      {/* Player info bottom sheet (mobile) / floating panel (desktop) */}
      {inspectedPlayer && (
        <>
          {/* Mobile: bottom sheet overlay */}
          <div className="lg:hidden fixed inset-0 z-40" onClick={() => setInspectedPlayer(null)}>
            <div className="absolute inset-0 bg-black/30" />
            <div
              className="absolute bottom-0 left-0 right-0 max-h-[70vh] overflow-y-auto rounded-t-2xl bg-white shadow-2xl animate-in slide-in-from-bottom"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-gray-300" />
              </div>
              <PlayerDetails
                player={inspectedPlayer}
                onClose={() => setInspectedPlayer(null)}
                variant="sidebar"
              />
            </div>
          </div>
          {/* Desktop: floating panel */}
          <div className="hidden lg:block">
            <PlayerDetails
              player={inspectedPlayer}
              onClose={() => setInspectedPlayer(null)}
              variant="floating"
            />
          </div>
        </>
      )}
    </div>
  );
}
