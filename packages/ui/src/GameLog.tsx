import React from "react";
import type { GameLogEntry } from "@bb/game-engine";

interface GameLogProps {
  logEntries: GameLogEntry[];
  maxEntries?: number;
}

export default function GameLog({ logEntries, maxEntries = 50 }: GameLogProps) {
  const displayEntries = logEntries.slice(-maxEntries).reverse(); // Plus récent en premier

  const getEntryIcon = (type: GameLogEntry['type']) => {
    switch (type) {
      case 'dice':
        return '🎲';
      case 'action':
        return '⚡';
      case 'turnover':
        return '💥';
      case 'score':
        return '🏆';
      case 'info':
        return 'ℹ️';
      default:
        return '📝';
    }
  };

  const getEntryColor = (type: GameLogEntry['type']) => {
    switch (type) {
      case 'dice':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'action':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'turnover':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'score':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'info':
        return 'text-gray-600 bg-gray-50 border-gray-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 h-96 flex flex-col">
      {/* En-tête */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Log du Match</h3>
          <div className="text-sm text-gray-500">
            {logEntries.length} entrée{logEntries.length > 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Liste des entrées */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {displayEntries.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            Aucune action enregistrée
          </div>
        ) : (
          displayEntries.map((entry) => (
            <div
              key={entry.id}
              className={`flex items-start space-x-3 p-3 rounded-lg border ${getEntryColor(entry.type)}`}
            >
              {/* Icône */}
              <div className="flex-shrink-0 text-lg">
                {getEntryIcon(entry.type)}
              </div>

              {/* Contenu */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900">
                    {entry.message}
                  </p>
                  <span className="text-xs text-gray-500 ml-2">
                    {formatTime(entry.timestamp)}
                  </span>
                </div>
                
                {/* Détails supplémentaires */}
                {entry.playerId && (
                  <p className="text-xs text-gray-600 mt-1">
                    Joueur: {entry.playerId}
                  </p>
                )}
                
                {entry.details && (
                  <div className="mt-1 text-xs text-gray-500">
                    {entry.type === 'dice' && entry.details.diceRoll && (
                      <span>
                        Détails: {entry.details.diceRoll} sur {entry.details.targetNumber}
                        {entry.details.modifiers && entry.details.modifiers !== 0 && (
                          <span> (mod: {entry.details.modifiers > 0 ? '+' : ''}{entry.details.modifiers})</span>
                        )}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pied de page */}
      <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 rounded-b-lg">
        <div className="text-xs text-gray-500 text-center">
          Les actions les plus récentes apparaissent en haut
        </div>
      </div>
    </div>
  );
}
