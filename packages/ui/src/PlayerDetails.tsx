import React from "react";
import type { Player } from "@bb/game-engine";

interface PlayerDetailsProps {
  player: Player | null;
  onClose: () => void;
  /**
   * Variante d'affichage:
   * - "floating": encart flottant (positionné en overlay)
   * - "sidebar": encart latéral intégré dans la mise en page
   */
  variant?: "floating" | "sidebar";
}

export default function PlayerDetails({ player, onClose, variant = "floating" }: PlayerDetailsProps) {
  if (!player) return null;

  return (
    <div
      className={
        variant === "floating"
          ? "fixed right-4 top-4 w-80 bg-white border border-gray-300 rounded-lg shadow-lg p-6 z-50"
          : "w-80 bg-white border border-gray-300 rounded-lg shadow p-6"
      }
    >
      {/* En-tête avec bouton de fermeture */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-gray-800">Détails du Joueur</h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 text-xl font-bold"
        >
          ×
        </button>
      </div>

      {/* Informations principales */}
      <div className="space-y-4">
        {/* Numéro et nom */}
        <div className="text-center pb-3 border-b border-gray-200">
          <div className="text-3xl font-bold text-blue-600">
            #{player.number}
          </div>
          <div className="text-xl font-semibold text-gray-800">
            {player.name}
          </div>
          <div className="text-sm text-gray-600">{player.position}</div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-teal-50 rounded-lg">
            <div className="text-xs text-gray-600 uppercase tracking-wide">
              PM
            </div>
            <div className="text-2xl font-bold text-teal-600">{player.pm}</div>
            <div className="text-xs text-gray-500">Points de mouvement</div>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-xs text-gray-600 uppercase tracking-wide">
              MA
            </div>
            <div className="text-2xl font-bold text-blue-600">{player.ma}</div>
            <div className="text-xs text-gray-500">Movement</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-xs text-gray-600 uppercase tracking-wide">
              ST
            </div>
            <div className="text-2xl font-bold text-red-600">{player.st}</div>
            <div className="text-xs text-gray-500">Strength</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-xs text-gray-600 uppercase tracking-wide">
              AG
            </div>
            <div className="text-2xl font-bold text-green-600">{player.ag}</div>
            <div className="text-xs text-gray-500">Agility</div>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-xs text-gray-600 uppercase tracking-wide">
              PA
            </div>
            <div className="text-2xl font-bold text-purple-600">
              {player.pa}
            </div>
            <div className="text-xs text-gray-500">Passing</div>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg col-span-2">
            <div className="text-xs text-gray-600 uppercase tracking-wide">
              AR
            </div>
            <div className="text-2xl font-bold text-yellow-600">
              {player.av}
            </div>
            <div className="text-xs text-gray-500">Armour</div>
          </div>
        </div>

        {/* Compétences */}
        <div className="pt-3 border-t border-gray-200">
          <h4 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
            Compétences
          </h4>
          {player.skills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {player.skills.map((skill, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full border border-gray-300"
                >
                  {skill}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-sm italic">
              Aucune compétence spéciale
            </div>
          )}
        </div>

        {/* État du joueur */}
        <div className="pt-3 border-t border-gray-200">
          <h4 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
            État
          </h4>
          <div className="space-y-2">
            {/* Statut de base */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Statut:</span>
              <span
                className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  player.stunned
                    ? "bg-red-100 text-red-800 border border-red-300"
                    : "bg-green-100 text-green-800 border border-green-300"
                }`}
              >
                {player.stunned ? "Sonné" : "Debout"}
              </span>
            </div>
            
            {/* Ballon */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Ballon:</span>
              <span
                className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  player.hasBall
                    ? "bg-yellow-100 text-yellow-800 border border-yellow-300"
                    : "bg-gray-100 text-gray-600 border border-gray-300"
                }`}
              >
                {player.hasBall ? "Possède le ballon" : "Pas de ballon"}
              </span>
            </div>
            
            {/* Points de mouvement */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">PM restants:</span>
              <span
                className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  player.pm > 0
                    ? "bg-blue-100 text-blue-800 border border-blue-300"
                    : "bg-gray-100 text-gray-600 border border-gray-300"
                }`}
              >
                {player.pm} / {player.ma}
              </span>
            </div>
          </div>
        </div>

        {/* Équipe */}
        <div className="pt-3 border-t border-gray-200">
          <div className="text-center">
            <div className="text-xs text-gray-600 uppercase tracking-wide mb-1">
              Équipe
            </div>
            <div
              className={`inline-block px-3 py-1 rounded-full text-white text-sm font-semibold ${
                player.team === "A" ? "bg-red-500" : "bg-blue-500"
              }`}
            >
              Équipe {player.team}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
