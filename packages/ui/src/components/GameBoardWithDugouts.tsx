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
}

export default function GameBoardWithDugouts({
  state,
  onCellClick,
  onPlayerClick,
  legalMoves = [],
  blockTargets = [],
  selectedPlayerId,
}: GameBoardWithDugoutsProps) {
  return (
    <div className="flex items-start gap-4 p-4 bg-gray-100 min-h-screen">
      {/* Dugout équipe A (gauche) */}
      <div className="flex-shrink-0">
        <TeamDugoutComponent
          dugout={state.dugouts.teamA}
          allPlayers={state.players}
          onPlayerClick={onPlayerClick}
        />
      </div>

      {/* Terrain principal */}
      <div className="flex-shrink-0">
        <PixiBoard
          state={state}
          onCellClick={onCellClick}
          legalMoves={legalMoves}
          blockTargets={blockTargets}
          selectedPlayerId={selectedPlayerId}
        />
      </div>

      {/* Dugout équipe B (droite) */}
      <div className="flex-shrink-0">
        <TeamDugoutComponent
          dugout={state.dugouts.teamB}
          allPlayers={state.players}
          onPlayerClick={onPlayerClick}
        />
      </div>
    </div>
  );
}
