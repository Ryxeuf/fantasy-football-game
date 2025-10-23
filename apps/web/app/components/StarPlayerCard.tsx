"use client";

import React from 'react';
import type { StarPlayerDefinition } from '@bb/game-engine';

interface StarPlayerCardProps {
  starPlayer: StarPlayerDefinition;
  onSelect?: (starPlayer: StarPlayerDefinition) => void;
  selected?: boolean;
}

/**
 * Composant pour afficher une carte de Star Player
 */
export default function StarPlayerCard({ starPlayer, onSelect, selected }: StarPlayerCardProps) {
  const formatCost = (cost: number) => {
    if (cost === 0) return 'Gratuit (avec Grak)';
    return `${(cost / 1000).toLocaleString()} K po`;
  };

  const formatSkills = (skills: string) => {
    return skills.split(',').map(skill => {
      // Convertir les slugs en noms lisibles
      const skillName = skill
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      return skillName;
    });
  };

  const getRarityColor = (cost: number) => {
    if (cost === 0) return 'bg-gray-100 border-gray-400';
    if (cost >= 300000) return 'bg-purple-100 border-purple-500'; // Légendaire
    if (cost >= 250000) return 'bg-orange-100 border-orange-500'; // Épique
    if (cost >= 200000) return 'bg-blue-100 border-blue-500';     // Rare
    return 'bg-green-100 border-green-500';                        // Commun
  };

  const getRarityLabel = (cost: number) => {
    if (cost === 0) return 'Spécial';
    if (cost >= 300000) return 'Légendaire';
    if (cost >= 250000) return 'Épique';
    if (cost >= 200000) return 'Rare';
    return 'Commun';
  };

  return (
    <div
      className={`
        rounded-lg border-2 p-4 cursor-pointer transition-all
        ${getRarityColor(starPlayer.cost)}
        ${selected ? 'ring-4 ring-blue-500 shadow-lg' : 'hover:shadow-md'}
      `}
      onClick={() => onSelect?.(starPlayer)}
    >
      {/* En-tête */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-lg">{starPlayer.displayName}</h3>
          <span className="text-xs font-semibold text-gray-600">
            {getRarityLabel(starPlayer.cost)}
          </span>
        </div>
        <div className="text-right">
          <div className="font-bold text-xl">{formatCost(starPlayer.cost)}</div>
        </div>
      </div>

      {/* Caractéristiques */}
      <div className="grid grid-cols-6 gap-2 mb-3 text-center">
        <div className="bg-white rounded p-1 shadow-sm">
          <div className="text-xs text-gray-600">MA</div>
          <div className="font-bold">{starPlayer.ma}</div>
        </div>
        <div className="bg-white rounded p-1 shadow-sm">
          <div className="text-xs text-gray-600">ST</div>
          <div className="font-bold">{starPlayer.st}</div>
        </div>
        <div className="bg-white rounded p-1 shadow-sm">
          <div className="text-xs text-gray-600">AG</div>
          <div className="font-bold">{starPlayer.ag}+</div>
        </div>
        <div className="bg-white rounded p-1 shadow-sm">
          <div className="text-xs text-gray-600">PA</div>
          <div className="font-bold">{starPlayer.pa ? `${starPlayer.pa}+` : '-'}</div>
        </div>
        <div className="bg-white rounded p-1 shadow-sm">
          <div className="text-xs text-gray-600">AV</div>
          <div className="font-bold">{starPlayer.av}+</div>
        </div>
      </div>

      {/* Compétences */}
      <div className="mb-3">
        <div className="text-xs text-gray-600 mb-1 font-semibold">Compétences :</div>
        <div className="flex flex-wrap gap-1">
          {formatSkills(starPlayer.skills).map((skill, index) => (
            <span
              key={index}
              className="bg-white text-xs px-2 py-1 rounded border border-gray-300"
            >
              {skill}
            </span>
          ))}
        </div>
      </div>

      {/* Règle spéciale */}
      {starPlayer.specialRule && (
        <div className="mt-3 pt-3 border-t border-gray-300">
          <div className="text-xs text-gray-600 mb-1 font-semibold">Règle spéciale :</div>
          <div className="text-xs text-gray-700 line-clamp-3">
            {starPlayer.specialRule}
          </div>
        </div>
      )}

      {/* Bouton de sélection */}
      {onSelect && (
        <button
          className={`
            w-full mt-3 py-2 px-4 rounded font-semibold transition-colors
            ${
              selected
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-white text-gray-800 border-2 border-gray-300 hover:border-blue-500'
            }
          `}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(starPlayer);
          }}
        >
          {selected ? '✓ Sélectionné' : 'Recruter'}
        </button>
      )}
    </div>
  );
}

