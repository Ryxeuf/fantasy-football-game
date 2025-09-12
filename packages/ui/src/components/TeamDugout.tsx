/**
 * Composant pour afficher le dugout complet d'une équipe
 */

import React from 'react';
import { TeamDugout, Player } from '@bb/game-engine';
import DugoutZoneComponent from './DugoutZone';

interface TeamDugoutProps {
  dugout: TeamDugout;
  allPlayers: Player[];
  onPlayerClick?: (playerId: string) => void;
}

export default function TeamDugoutComponent({ 
  dugout, 
  allPlayers, 
  onPlayerClick 
}: TeamDugoutProps) {
  const teamColor = dugout.teamId === 'A' ? '#3B82F6' : '#EF4444';
  
  // Récupérer les joueurs pour chaque zone
  const getPlayersInZone = (zoneType: keyof TeamDugout['zones']) => {
    return allPlayers.filter(player => 
      player.team === dugout.teamId && 
      dugout.zones[zoneType].players.includes(player.id)
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {/* En-tête de l'équipe */}
      <div 
        className="text-center font-bold text-white py-2 rounded"
        style={{ backgroundColor: teamColor }}
      >
        Équipe {dugout.teamId}
      </div>

      {/* Zones du dugout */}
      <div className="flex flex-col gap-2">
        <DugoutZoneComponent
          zone={dugout.zones.reserves}
          players={getPlayersInZone('reserves')}
          teamColor={teamColor}
          onPlayerClick={onPlayerClick}
        />
        
        <DugoutZoneComponent
          zone={dugout.zones.stunned}
          players={getPlayersInZone('stunned')}
          teamColor={teamColor}
          onPlayerClick={onPlayerClick}
        />
        
        <DugoutZoneComponent
          zone={dugout.zones.knockedOut}
          players={getPlayersInZone('knockedOut')}
          teamColor={teamColor}
          onPlayerClick={onPlayerClick}
        />
        
        <DugoutZoneComponent
          zone={dugout.zones.casualty}
          players={getPlayersInZone('casualty')}
          teamColor={teamColor}
          onPlayerClick={onPlayerClick}
        />
        
        <DugoutZoneComponent
          zone={dugout.zones.sentOff}
          players={getPlayersInZone('sentOff')}
          teamColor={teamColor}
          onPlayerClick={onPlayerClick}
        />
      </div>
    </div>
  );
}
