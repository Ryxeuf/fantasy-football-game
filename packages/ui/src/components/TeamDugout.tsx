/**
 * Composant pour afficher le dugout complet d'une équipe
 */

import React from 'react';
import { TeamDugout, Player } from '@bb/game-engine';
import DugoutZoneComponent from './DugoutZone';

interface TeamDugoutProps {
  dugout: TeamDugout;
  allPlayers: Player[];
  placedPlayers?: string[]; // Nouvelle prop pour setup
  onPlayerClick?: (playerId: string) => void;
  onDragStart?: (e: React.DragEvent, playerId: string) => void;
}

export default function TeamDugoutComponent({ 
  dugout, 
  allPlayers, 
  placedPlayers = [], // Default empty
  onPlayerClick,
  onDragStart,
}: TeamDugoutProps) {
  
  // Pour reserve en setup : tous non placés
  const reservePlayers = allPlayers.filter(p => p.team === dugout.team && !placedPlayers.includes(p.id));

  return (
    <div className="bg-gray-200 p-2 rounded">
      {/* Zone Reserve */}
      <DugoutZoneComponent
        zone={{ type: 'reserve', name: 'Réserve' }}
        players={reservePlayers}
        teamColor={dugout.team === 'A' ? 'red' : 'blue'}
        onPlayerClick={onPlayerClick}
        onDragStart={onDragStart}
      />
      
      {/* Autres zones - fallback à filtre pos si pas setup */}
      <DugoutZoneComponent
        zone={{ type: 'ko', name: 'KO' }}
        players={allPlayers.filter(p => p.pos.x === -2 && p.team === dugout.team)}
        teamColor={dugout.team === 'A' ? 'red' : 'blue'}
        onPlayerClick={onPlayerClick}
        onDragStart={onDragStart}
      />
      
      <DugoutZoneComponent
        zone={{ type: 'stunned', name: 'Sonnés' }}
        players={allPlayers.filter(p => p.stunned && p.team === dugout.team)}
        teamColor={dugout.team === 'A' ? 'red' : 'blue'}
        onPlayerClick={onPlayerClick}
        onDragStart={onDragStart}
      />
      
      {/* Casualty si besoin */}
      {dugout.zones?.casualty && (
        <DugoutZoneComponent
          zone={{ type: 'casualty', name: 'Blessés' }}
          players={allPlayers.filter(p => p.pos.x === -3 && p.team === dugout.team)} // Ex. pos.x = -3 pour casualty
          teamColor={dugout.team === 'A' ? 'red' : 'blue'}
          onPlayerClick={onPlayerClick}
          onDragStart={onDragStart}
        />
      )}
    </div>
  );
}
