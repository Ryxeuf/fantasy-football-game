/**
 * Composant pour afficher une zone de dugout
 */

import React from 'react';
import { DugoutZone, Player } from '@bb/game-engine';

interface DugoutZoneProps {
  zone: any; // Flexible pour { type: string, name?: string, players?: string[] }
  players: Player[];
  teamColor: string;
  onPlayerClick?: (playerId: string) => void;
  onDragStart?: (e: React.DragEvent, playerId: string) => void;
}

export default function DugoutZoneComponent({ 
  zone, 
  players, 
  teamColor, 
  onPlayerClick,
  onDragStart,
}: DugoutZoneProps) {
  
  const zoneType = zone?.type || 'zone';
  const zoneName = zone?.name || zoneType.charAt(0).toUpperCase() + zoneType.slice(1);

  return (
    <div className={`dugout-zone ${zoneType} p-1 border ${teamColor === 'red' ? 'border-red-300' : 'border-blue-300'}`}>
      <h4 className="text-xs font-bold text-gray-700 mb-1 capitalize">{zoneName}</h4>
      <div className="flex flex-wrap gap-1">
        {players.map((player) => (
          <div
            key={player.id}
            className={`player-token w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer border-2 ${
              player.stunned ? 'bg-gray-400 text-white' : teamColor === 'red' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
            } ${player.hasBall ? 'ring-2 ring-yellow-400' : ''}`}
            onClick={() => onPlayerClick?.(player.id)}
            draggable={zoneType === 'reserve' || player.pos.x < 0}
            onDragStart={(e) => onDragStart?.(e, player.id)}
            title={`${player.name} (#${player.number}) - ${player.position}`}
          >
            {player.number}
          </div>
        ))}
      </div>
    </div>
  );
}
