/**
 * Composant pour afficher le dugout complet d'une equipe
 */

import React from "react";
import { TeamDugout, Player } from "@bb/game-engine";
import DugoutZoneComponent from "./DugoutZone";

interface TeamDugoutProps {
  dugout: TeamDugout;
  allPlayers: Player[];
  placedPlayers?: string[];
  onPlayerClick?: (playerId: string) => void;
  onDragStart?: (e: React.DragEvent, playerId: string) => void;
  teamName?: string;
  isSetupPhase?: boolean;
}

export default function TeamDugoutComponent({
  dugout,
  allPlayers,
  placedPlayers = [],
  onPlayerClick,
  onDragStart,
  teamName,
  isSetupPhase = false,
}: TeamDugoutProps) {
  const reservePlayers = allPlayers?.filter(
    (p) => p.team === dugout?.teamId &&
           !placedPlayers.includes(p.id) &&
           p.pos && p.pos.x < 0,
  ) || [];

  const badgeClasses =
    dugout?.teamId === "A"
      ? "inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-red-900/10 text-red-700 border border-red-600"
      : "inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-blue-900/10 text-blue-700 border border-blue-600";

  return (
    <div className="bg-gray-200 p-2 rounded w-full lg:w-64 space-y-1">
      {/* En-tete equipe */}
      <div className="mb-1 text-sm font-semibold text-gray-800">
        <span className={badgeClasses}>
          <span
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: dugout?.teamId === "A" ? "#dc2626" : "#2563eb",
            }}
          ></span>
          {teamName || (dugout?.teamId === "A" ? "Equipe A" : "Equipe B")}
        </span>
      </div>
      {/* Zone Reserve */}
      <DugoutZoneComponent
        zone={{ type: "reserve", name: "Reserve" }}
        players={reservePlayers}
        teamColor={dugout?.teamId === "A" ? "red" : "blue"}
        onPlayerClick={onPlayerClick}
        onDragStart={onDragStart}
        isSetupPhase={isSetupPhase}
      />

      {/* Autres zones */}
      <DugoutZoneComponent
        zone={{ type: "ko", name: "KO" }}
        players={allPlayers?.filter(
          (p) => p.pos.x === -2 && p.team === dugout?.teamId,
        ) || []}
        teamColor={dugout?.teamId === "A" ? "red" : "blue"}
        onPlayerClick={onPlayerClick}
        onDragStart={onDragStart}
        isSetupPhase={isSetupPhase}
      />

      <DugoutZoneComponent
        zone={{ type: "stunned", name: "Sonnes" }}
        players={allPlayers?.filter(
          (p) => p.stunned && p.team === dugout?.teamId,
        ) || []}
        teamColor={dugout?.teamId === "A" ? "red" : "blue"}
        onPlayerClick={onPlayerClick}
        onDragStart={onDragStart}
        isSetupPhase={isSetupPhase}
      />

      {/* Casualty si besoin */}
      {dugout?.zones?.casualty && (
        <DugoutZoneComponent
          zone={{ type: "casualty", name: "Blesses" }}
          players={allPlayers?.filter(
            (p) => p.pos.x === -3 && p.team === dugout?.teamId,
          ) || []}
          teamColor={dugout?.teamId === "A" ? "red" : "blue"}
          onPlayerClick={onPlayerClick}
          onDragStart={onDragStart}
          isSetupPhase={isSetupPhase}
        />
      )}
    </div>
  );
}
