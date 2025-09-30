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
  teamName?: string;
}

export default function TeamDugoutComponent({ 
  dugout, 
  allPlayers, 
  placedPlayers = [], // Default empty
  onPlayerClick,
  onDragStart,
  teamName,
}: TeamDugoutProps) {
  
  // Pour reserve en setup : tous non placés
  const reservePlayers = allPlayers.filter(p => p.team === dugout.teamId && !placedPlayers.includes(p.id));

  const badgeClasses = dugout.teamId === 'A'
    ? 'inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-red-900/10 text-red-700 border border-red-600'
    : 'inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-blue-900/10 text-blue-700 border border-blue-600';

  return (
    <div className="bg-gray-200 p-2 rounded w-64">
      {/* En-tête équipe */}
      <div className="mb-2 text-sm font-semibold text-gray-800">
        <span className={badgeClasses}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dugout.teamId === 'A' ? '#dc2626' : '#2563eb' }}></span>
          {teamName || (dugout.teamId === 'A' ? 'Équipe A' : 'Équipe B')}
        </span>
      </div>
      {/* Zone Reserve */}
      <DugoutZoneComponent
        zone={{ type: 'reserve', name: 'Réserve' }}
        players={reservePlayers}
        teamColor={dugout.teamId === 'A' ? 'red' : 'blue'}
        onPlayerClick={onPlayerClick}
        onDragStart={onDragStart}
      />
      
      {/* Autres zones - fallback à filtre pos si pas setup */}
      <DugoutZoneComponent
        zone={{ type: 'ko', name: 'KO' }}
        players={allPlayers.filter(p => p.pos.x === -2 && p.team === dugout.teamId)}
        teamColor={dugout.teamId === 'A' ? 'red' : 'blue'}
        onPlayerClick={onPlayerClick}
        onDragStart={onDragStart}
      />
      
      <DugoutZoneComponent
        zone={{ type: 'stunned', name: 'Sonnés' }}
        players={allPlayers.filter(p => p.stunned && p.team === dugout.teamId)}
        teamColor={dugout.teamId === 'A' ? 'red' : 'blue'}
        onPlayerClick={onPlayerClick}
        onDragStart={onDragStart}
      />
      
      {/* Casualty si besoin */}
      {dugout.zones?.casualty && (
        <DugoutZoneComponent
          zone={{ type: 'casualty', name: 'Blessés' }}
          players={allPlayers.filter(p => p.pos.x === -3 && p.team === dugout.teamId)} // Ex. pos.x = -3 pour casualty
          teamColor={dugout.teamId === 'A' ? 'red' : 'blue'}
          onPlayerClick={onPlayerClick}
          onDragStart={onDragStart}
        />
      )}
    </div>
  );
}
