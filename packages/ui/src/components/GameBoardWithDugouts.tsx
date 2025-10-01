/**
 * Composant principal du terrain avec les zones de dugout
 */

import React from 'react';
import { GameState } from '@bb/game-engine';
import PixiBoard from '../board/PixiBoard';
import TeamDugoutComponent from './TeamDugout';

interface GameBoardWithDugoutsProps {
  state: GameState;
  onCellClick?: (pos: { x: number; y: number }) => void;
  onPlayerClick?: (playerId: string) => void;
  legalMoves?: { x: number; y: number }[];
  blockTargets?: { x: number; y: number }[];
  selectedPlayerId?: string | null;
  selectedForRepositioning?: string | null; // Nouvelle prop pour joueur sélectionné pour repositionnement
  onDragStart?: (e: React.DragEvent, playerId: string) => void;
  placedPlayers?: string[]; // Nouvelle prop pour setup
  boardContainerRef?: React.RefObject<HTMLDivElement>;
  isSetupPhase?: boolean; // Nouvelle prop pour indiquer si on est en phase setup
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
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
  placedPlayers = [], // Default
  boardContainerRef,
  isSetupPhase = false,
  onDragOver,
  onDrop,
}: GameBoardWithDugoutsProps) {
  
  return (
    <div className="flex items-start gap-4 p-4 bg-gray-100 min-h-screen">
      {/* Dugout équipe A */}
      <div className="flex-shrink-0">
        <TeamDugoutComponent
          dugout={state.dugouts.teamA}
          allPlayers={state.players}
          placedPlayers={placedPlayers}
          onPlayerClick={onPlayerClick}
          onDragStart={onDragStart}
          teamName={state.teamNames.teamA}
          isSetupPhase={isSetupPhase}
        />
      </div>

      {/* Terrain */}
      <div className="flex-shrink-0" ref={boardContainerRef} onDragOver={onDragOver} onDrop={onDrop}>
        <PixiBoard
          state={state}
          onCellClick={onCellClick}
          onPlayerClick={onPlayerClick}
          legalMoves={legalMoves}
          blockTargets={blockTargets}
          selectedPlayerId={selectedPlayerId}
          selectedForRepositioning={selectedForRepositioning}
        />
      </div>

      {/* Dugout équipe B */}
      <div className="flex-shrink-0">
        <TeamDugoutComponent
          dugout={state.dugouts.teamB}
          allPlayers={state.players}
          placedPlayers={placedPlayers}
          onPlayerClick={onPlayerClick}
          onDragStart={onDragStart}
          teamName={state.teamNames.teamB}
          isSetupPhase={isSetupPhase}
        />
      </div>
    </div>
  );
}
