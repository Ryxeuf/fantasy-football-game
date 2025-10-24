"use client";

import React, { useState, useEffect } from 'react';
import StarPlayerCard from './StarPlayerCard';

const API_URL = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8201';

interface StarPlayer {
  id?: string;
  slug: string;
  displayName: string;
  cost: number;
  hiredAt?: string;
  ma: number;
  st: number;
  ag: number;
  pa: number | null;
  av: number;
  skills: string;
  specialRule?: string;
  isHired?: boolean;
  canHire?: boolean;
  needsPair?: boolean;
  pairStatus?: {
    slug: string;
    name: string;
    hired: boolean;
    cost: number;
  };
}

interface TeamStarPlayersManagerProps {
  teamId: string;
  token: string;
}

export default function TeamStarPlayersManager({ teamId, token }: TeamStarPlayersManagerProps) {
  const [hiredStarPlayers, setHiredStarPlayers] = useState<StarPlayer[]>([]);
  const [availableStarPlayers, setAvailableStarPlayers] = useState<StarPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRecruitModal, setShowRecruitModal] = useState(false);
  const [recruiting, setRecruiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Budget info
  const [budgetInfo, setBudgetInfo] = useState({
    availableBudget: 0,
    totalBudget: 0,
    currentPlayerCount: 0,
    currentStarPlayerCount: 0,
    totalPlayers: 0,
    maxPlayers: 16
  });

  useEffect(() => {
    loadStarPlayers();
  }, [teamId, token]);

  const loadStarPlayers = async () => {
    try {
      setLoading(true);
      setError(null);

      // Charger les Star Players recrutés
      const hiredRes = await fetch(`${API_URL}/team/${teamId}/star-players`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!hiredRes.ok) {
        throw new Error('Erreur lors du chargement des Star Players recrutés');
      }

      const hiredData = await hiredRes.json();
      setHiredStarPlayers(hiredData.starPlayers || []);

      // Charger les Star Players disponibles
      const availableRes = await fetch(`${API_URL}/team/${teamId}/available-star-players`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!availableRes.ok) {
        throw new Error('Erreur lors du chargement des Star Players disponibles');
      }

      const availableData = await availableRes.json();
      setAvailableStarPlayers(availableData.availableStarPlayers || []);
      setBudgetInfo({
        availableBudget: availableData.availableBudget || 0,
        totalBudget: availableData.totalBudget || 0,
        currentPlayerCount: availableData.currentPlayerCount || 0,
        currentStarPlayerCount: availableData.currentStarPlayerCount || 0,
        totalPlayers: availableData.totalPlayers || 0,
        maxPlayers: availableData.maxPlayers || 16
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRecruit = async (starPlayerSlug: string) => {
    try {
      setRecruiting(true);
      setError(null);
      setSuccessMessage(null);

      const res = await fetch(`${API_URL}/team/${teamId}/star-players`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ starPlayerSlug })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors du recrutement');
      }

      setSuccessMessage(data.message);
      setShowRecruitModal(false);
      
      // Recharger les données
      await loadStarPlayers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRecruiting(false);
    }
  };

  const handleRemove = async (starPlayerId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir retirer ce Star Player ?')) {
      return;
    }

    try {
      setError(null);
      setSuccessMessage(null);

      const res = await fetch(`${API_URL}/team/${teamId}/star-players/${starPlayerId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors du retrait');
      }

      setSuccessMessage(data.message);
      
      // Recharger les données
      await loadStarPlayers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Messages */}
      {error && (
        <div className="bg-red-100 border-2 border-red-500 text-red-700 px-4 py-3 rounded relative">
          <strong className="font-bold">Erreur : </strong>
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="absolute top-0 bottom-0 right-0 px-4"
          >
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-100 border-2 border-green-500 text-green-700 px-4 py-3 rounded relative">
          <span>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="absolute top-0 bottom-0 right-0 px-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Budget Info */}
      <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-sm text-gray-600">Budget disponible</div>
            <div className="text-2xl font-bold text-blue-600">
              {budgetInfo.availableBudget.toLocaleString()} K
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Budget total</div>
            <div className="text-2xl font-bold">
              {budgetInfo.totalBudget.toLocaleString()} K
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Joueurs</div>
            <div className="text-2xl font-bold">
              {budgetInfo.totalPlayers} / {budgetInfo.maxPlayers}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Star Players</div>
            <div className="text-2xl font-bold text-purple-600">
              {budgetInfo.currentStarPlayerCount}
            </div>
          </div>
        </div>
      </div>

      {/* Star Players recrutés */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Star Players recrutés</h2>
          <button
            onClick={() => setShowRecruitModal(true)}
            disabled={budgetInfo.totalPlayers >= budgetInfo.maxPlayers}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            ➕ Recruter un Star Player
          </button>
        </div>

        {hiredStarPlayers.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <p className="text-gray-600 text-lg">
              Aucun Star Player recruté
            </p>
            <p className="text-gray-500 text-sm mt-2">
              Recrutez des mercenaires légendaires pour renforcer votre équipe !
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hiredStarPlayers.map((sp) => (
              <div key={sp.id} className="relative">
                <StarPlayerCard starPlayer={sp} />
                <button
                  onClick={() => sp.id && handleRemove(sp.id)}
                  className="absolute top-2 right-2 bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-sm font-semibold"
                >
                  ✕ Retirer
                </button>
                <div className="mt-2 text-xs text-gray-500 text-center">
                  Recruté le {new Date(sp.hiredAt || '').toLocaleDateString('fr-FR')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de recrutement */}
      {showRecruitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b-2 border-gray-200 p-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold">Recruter un Star Player</h2>
              <button
                onClick={() => setShowRecruitModal(false)}
                className="text-gray-600 hover:text-gray-800 text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              {/* Filtres */}
              <div className="mb-6 flex gap-4">
                <input
                  type="text"
                  placeholder="Rechercher un Star Player..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded"
                />
                <select className="px-4 py-2 border border-gray-300 rounded">
                  <option value="all">Tous les Star Players</option>
                  <option value="available">Disponibles uniquement</option>
                  <option value="affordable">Dans mon budget</option>
                </select>
              </div>

              {/* Liste des Star Players disponibles */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableStarPlayers
                  .filter(sp => !sp.isHired)
                  .map((sp) => (
                    <div key={sp.slug} className="relative">
                      <StarPlayerCard starPlayer={sp} />
                      
                      {/* Informations de paire */}
                      {sp.needsPair && sp.pairStatus && !sp.pairStatus.hired && (
                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-300 rounded text-sm">
                          <strong>⚠️ Paire obligatoire :</strong>
                          <div>
                            {sp.pairStatus.name} sera recruté automatiquement
                            {sp.pairStatus.cost > 0 && (
                              <span> ({(sp.pairStatus.cost / 1000).toLocaleString()} K po)</span>
                            )}
                          </div>
                          <div className="font-bold mt-1">
                            Coût total : {((sp.cost + sp.pairStatus.cost) / 1000).toLocaleString()} K po
                          </div>
                        </div>
                      )}

                      {/* Bouton de recrutement */}
                      <button
                        onClick={() => handleRecruit(sp.slug)}
                        disabled={!sp.canHire || recruiting}
                        className={`
                          w-full mt-3 py-2 px-4 rounded font-semibold transition-colors
                          ${sp.canHire 
                            ? 'bg-green-600 text-white hover:bg-green-700' 
                            : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                          }
                          ${recruiting ? 'opacity-50 cursor-wait' : ''}
                        `}
                      >
                        {recruiting ? '⏳ Recrutement...' : 
                         sp.canHire ? `Recruter (${(sp.cost / 1000).toLocaleString()} K po)` : 
                         'Indisponible'}
                      </button>

                      {/* Raisons d'indisponibilité */}
                      {!sp.canHire && (
                        <div className="mt-2 text-xs text-red-600 text-center">
                          {sp.cost > budgetInfo.availableBudget * 1000 && '💰 Budget insuffisant'}
                          {budgetInfo.totalPlayers >= budgetInfo.maxPlayers && '👥 Limite de joueurs atteinte'}
                        </div>
                      )}
                    </div>
                  ))}
              </div>

              {availableStarPlayers.filter(sp => !sp.isHired).length === 0 && (
                <div className="text-center py-12 text-gray-600">
                  Tous les Star Players disponibles sont déjà recrutés !
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

