/**
 * Composant pour afficher une zone de dugout
 */

import React from 'react';
import { DugoutZone, Player } from '@bb/game-engine';

interface DugoutZoneProps {
  zone: DugoutZone;
  players: Player[];
  teamColor: string;
  onPlayerClick?: (playerId: string) => void;
}

export default function DugoutZoneComponent({ 
  zone, 
  players, 
  teamColor, 
  onPlayerClick 
}: DugoutZoneProps) {
  return (
    <div
      className="relative border-2 rounded-lg p-2 min-h-[80px] flex flex-col"
      style={{
        backgroundColor: zone.color,
        borderColor: teamColor,
        width: zone.position.width,
        height: zone.position.height,
      }}
    >
      {/* En-tête de la zone */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{zone.icon}</span>
          <span className="font-bold text-sm">{zone.name}</span>
        </div>
        <span className="text-xs bg-black bg-opacity-20 px-2 py-1 rounded">
          {players.length}/{zone.maxCapacity}
        </span>
      </div>

      {/* Liste des joueurs */}
      <div className="flex flex-wrap gap-1 flex-1">
        {players.map((player) => (
          <div
            key={player.id}
            className="w-6 h-6 bg-white rounded-full border-2 flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
            style={{ borderColor: teamColor }}
            onClick={() => onPlayerClick?.(player.id)}
            title={`${player.name} (${player.position})`}
          >
            <span className="text-xs font-bold" style={{ color: teamColor }}>
              {player.number}
            </span>
          </div>
        ))}
        
        {/* Espaces vides */}
        {Array.from({ length: zone.maxCapacity - players.length }).map((_, index) => (
          <div
            key={`empty-${index}`}
            className="w-6 h-6 border-2 border-dashed border-gray-400 rounded-full flex items-center justify-center"
          >
            <span className="text-xs text-gray-400">-</span>
          </div>
        ))}
      </div>
    </div>
  );
}
