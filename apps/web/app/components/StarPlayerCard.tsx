"use client";

import React from 'react';
import type { StarPlayerDefinition } from '@bb/game-engine';
import { getStarPlayerSkillDisplayNames } from '@bb/game-engine';
import KeywordChips from './KeywordChips';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * L'API renvoie `keywordsEn` en plus du `keywords` FR porte par la definition
 * engine. Champ optionnel (retro-compat : un serveur pre-migration ne le
 * renvoie pas encore).
 */
export type StarPlayerWithKeywords = StarPlayerDefinition & {
  readonly keywordsEn?: string | null;
};

interface StarPlayerCardProps {
  starPlayer: StarPlayerWithKeywords;
  onClick?: (starPlayer: StarPlayerDefinition) => void;
}

/**
 * Composant pour afficher une carte de Star Player
 */
export default function StarPlayerCard({ starPlayer, onClick }: StarPlayerCardProps) {
  const { language } = useLanguage();
  // Mots-cles (lignee + type) : EN si dispo, repli FR (cf. positions).
  const keywords =
    language === 'en'
      ? starPlayer.keywordsEn ?? starPlayer.keywords
      : starPlayer.keywords ?? starPlayer.keywordsEn;

  const formatCost = (cost: number) => {
    if (cost === 0) return 'Gratuit (avec Grak)';
    return `${(cost / 1000).toLocaleString()} K po`;
  };

  // Utiliser la fonction centralisée pour obtenir les noms d'affichage
  const skillDisplayNames = getStarPlayerSkillDisplayNames(starPlayer);

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
        rounded-lg border-2 p-4 cursor-pointer transition-all hover:shadow-lg hover:scale-105
        ${getRarityColor(starPlayer.cost)}
      `}
      onClick={() => onClick?.(starPlayer)}
    >
      {/* En-tête */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-lg">{starPlayer.displayName}</h3>
            {starPlayer.isMegaStar && (
              <span className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-black text-xs font-bold px-2 py-1 rounded-full shadow-md border-2 border-yellow-700">
                ⭐ MEGA STAR
              </span>
            )}
          </div>
          <span className="text-xs font-semibold text-gray-600">
            {getRarityLabel(starPlayer.cost)}
          </span>
          <KeywordChips
            keywords={keywords}
            className="mt-1"
            testId="star-player-keywords"
          />
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
          {skillDisplayNames.map((skill, index) => (
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

      {/* Bouton d'action */}
      {onClick && (
        <div className="mt-3 pt-3 border-t border-gray-300">
          <div className="text-center">
            <span className="text-sm text-blue-600 font-semibold">
              👆 Cliquer pour voir les détails
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

