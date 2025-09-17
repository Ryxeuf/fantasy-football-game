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
      className="relative border-2 rounded-lg p-2 flex flex-col"
      style={{
        backgroundColor: zone.color,
        borderColor: teamColor,
        width: zone.position.width,
        height: zone.position.height,
      }}
    >
      {/* En-tête de la zone */}
      <div className="flex items-center justify-between mb-1 flex-shrink-0">
        <div className="flex items-center gap-1">
          <span className="text-lg">{zone.icon}</span>
          <span className="font-bold text-xs">{zone.name}</span>
        </div>
        <span className="text-xs bg-black bg-opacity-20 px-1 py-0.5 rounded">
          {players.length}/{zone.maxCapacity}
        </span>
      </div>

      {/* Grille des joueurs - 2x2 pour les 4 premiers emplacements */}
      <div className="flex-1 flex flex-col gap-1">
        {/* Ligne du haut */}
        <div className="flex gap-1 justify-center">
          {players.slice(0, 2).map((player) => (
            <div
              key={player.id}
              className="w-5 h-5 bg-white rounded-full border-2 flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
              style={{ borderColor: teamColor }}
              onClick={() => onPlayerClick?.(player.id)}
              title={`${player.name} (${player.position})`}
            >
              <span className="text-xs font-bold" style={{ color: teamColor }}>
                {player.number}
              </span>
            </div>
          ))}
          {/* Espaces vides pour la ligne du haut */}
          {Array.from({ length: Math.max(0, 2 - players.slice(0, 2).length) }).map((_, index) => (
            <div
              key={`empty-top-${index}`}
              className="w-5 h-5 border-2 border-dashed border-gray-400 rounded-full flex items-center justify-center"
            >
              <span className="text-xs text-gray-400">-</span>
            </div>
          ))}
        </div>
        
        {/* Ligne du bas */}
        <div className="flex gap-1 justify-center">
          {players.slice(2, 4).map((player) => (
            <div
              key={player.id}
              className="w-5 h-5 bg-white rounded-full border-2 flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
              style={{ borderColor: teamColor }}
              onClick={() => onPlayerClick?.(player.id)}
              title={`${player.name} (${player.position})`}
            >
              <span className="text-xs font-bold" style={{ color: teamColor }}>
                {player.number}
              </span>
            </div>
          ))}
          {/* Espaces vides pour la ligne du bas */}
          {Array.from({ length: Math.max(0, 2 - players.slice(2, 4).length) }).map((_, index) => (
            <div
              key={`empty-bottom-${index}`}
              className="w-5 h-5 border-2 border-dashed border-gray-400 rounded-full flex items-center justify-center"
            >
              <span className="text-xs text-gray-400">-</span>
            </div>
          ))}
        </div>
        
        {/* Joueurs supplémentaires (au-delà de 4) - affichés en ligne */}
        {players.length > 4 && (
          <div className="flex flex-wrap gap-1 justify-center mt-1">
            {players.slice(4).map((player) => (
              <div
                key={player.id}
                className="w-4 h-4 bg-white rounded-full border-2 flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
                style={{ borderColor: teamColor }}
                onClick={() => onPlayerClick?.(player.id)}
                title={`${player.name} (${player.position})`}
              >
                <span className="text-xs font-bold" style={{ color: teamColor, fontSize: '10px' }}>
                  {player.number}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
