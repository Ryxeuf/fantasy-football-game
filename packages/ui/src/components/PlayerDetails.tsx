import React from "react";
import type { Player } from "@bb/game-engine";
import { getPlayerStarRules } from "@bb/game-engine";

interface PlayerDetailsProps {
  player: Player | null;
  onClose: () => void;
  variant?: "floating" | "sidebar";
  usedStarPlayerRules?: Record<string, boolean>;
}

/** Extract initials from player name */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function PlayerDetails({
  player,
  onClose,
  variant = "floating",
  usedStarPlayerRules,
}: PlayerDetailsProps) {
  if (!player) return null;

  const teamBg = player.team === "A" ? "bg-red-500" : "bg-blue-500";
  const teamBgLight = player.team === "A" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700";

  const starRules = getPlayerStarRules(player, usedStarPlayerRules);
  const starRuleSlugs = new Set(starRules.map(r => r.slug));
  const regularSkills = player.skills.filter(s => !starRuleSlugs.has(s));

  return (
    <div
      className={
        variant === "floating"
          ? "fixed right-4 top-4 w-80 bg-white border border-gray-200 rounded-xl shadow-xl p-5 z-50"
          : "w-full bg-white p-4 sm:p-5"
      }
    >
      {/* Header: avatar + name + close */}
      <div className="flex items-center gap-3 mb-4">
        {/* Avatar circle with initials */}
        <div className={`${teamBg} w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0`}>
          {getInitials(player.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-bold text-gray-900 truncate">
            {player.name}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>#{player.number}</span>
            <span className="text-gray-300">|</span>
            <span>{player.position}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 p-1 -mr-1"
          aria-label="Fermer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Status badges row */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
          player.stunned ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${player.stunned ? "bg-red-500" : "bg-green-500"}`} />
          {player.stunned ? "Sonne" : "Actif"}
        </span>
        {player.hasBall && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
            Ballon
          </span>
        )}
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${teamBgLight}`}>
          Equipe {player.team}
        </span>
      </div>

      {/* Stats grid - compact 3-column */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: "MA", value: player.ma, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "ST", value: player.st, color: "text-red-600", bg: "bg-red-50" },
          { label: "AG", value: player.ag, color: "text-green-600", bg: "bg-green-50" },
          { label: "PA", value: player.pa, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "AV", value: player.av, color: "text-yellow-600", bg: "bg-yellow-50" },
          { label: "PM", value: `${player.pm}/${player.ma}`, color: "text-teal-600", bg: "bg-teal-50" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-lg p-2 text-center`}>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">{label}</div>
            <div className={`text-lg font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Skills */}
      {regularSkills.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Competences
          </div>
          <div className="flex flex-wrap gap-1.5">
            {regularSkills.map((skill, i) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full border border-gray-200"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Star Player Special Rules */}
      {starRules.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Règle spéciale
          </div>
          {starRules.map((rule) => (
            <div
              key={rule.slug}
              className={`rounded-lg p-3 border ${
                rule.isUsed
                  ? "bg-gray-50 border-gray-300"
                  : "bg-yellow-50 border-yellow-300"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-bold ${
                  rule.isUsed ? "text-gray-500" : "text-yellow-800"
                }`}>
                  {rule.nameFr}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  rule.isUsed
                    ? "bg-gray-200 text-gray-600"
                    : "bg-green-100 text-green-700"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    rule.isUsed ? "bg-gray-400" : "bg-green-500"
                  }`} />
                  {rule.isUsed ? "Utilisée" : "Disponible"}
                </span>
              </div>
              <p className={`text-xs leading-relaxed ${
                rule.isUsed ? "text-gray-400" : "text-yellow-700"
              }`}>
                {rule.description}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
