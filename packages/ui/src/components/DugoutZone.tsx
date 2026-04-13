/**
 * Composant pour afficher une zone de dugout
 */

import React from "react";
import { Player } from "@bb/game-engine";

interface ZoneDescriptor {
  type: string;
  name: string;
}

interface DugoutZoneProps {
  zone: ZoneDescriptor;
  players: Player[];
  teamColor: string;
  onPlayerClick?: (playerId: string) => void;
  onDragStart?: (e: React.DragEvent, playerId: string) => void;
  isSetupPhase?: boolean;
}

/** Extract initials from player name */
function getInitials(player: Player): string {
  if (!player.name) return String(player.number);
  const parts = player.name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return player.name.slice(0, 2).toUpperCase();
}

export default function DugoutZoneComponent({
  zone,
  players,
  teamColor,
  onPlayerClick,
  onDragStart,
  isSetupPhase = false,
}: DugoutZoneProps) {
  const zoneType = zone?.type || "zone";
  const zoneName =
    zone?.name || zoneType.charAt(0).toUpperCase() + zoneType.slice(1);

  return (
    <div
      className={`dugout-zone ${zoneType} p-1.5 border rounded ${teamColor === "red" ? "border-red-300" : "border-blue-300"}`}
    >
      <h4 className="text-xs font-bold text-gray-700 mb-1 capitalize">
        {zoneName}
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {players.map((player, index) => (
          <div
            key={`${player.id}-${zoneType}-${index}`}
            className={`player-token w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold cursor-pointer border-2 transition-transform active:scale-95 ${
              player.stunned
                ? "bg-gray-400 text-white border-gray-500"
                : teamColor === "red"
                  ? "bg-red-500 text-white border-red-600"
                  : "bg-blue-500 text-white border-blue-600"
            } ${player.hasBall ? "ring-2 ring-yellow-400 ring-offset-1" : ""}`}
            onClick={() => onPlayerClick?.(player.id)}
            draggable={
              zoneType === "reserve" || player.pos.x < 0 || isSetupPhase
            }
            onDragStart={(e) => onDragStart?.(e, player.id)}
            title={`${player.name} (#${player.number}) - ${player.position}`}
          >
            {getInitials(player)}
          </div>
        ))}
      </div>
    </div>
  );
}
