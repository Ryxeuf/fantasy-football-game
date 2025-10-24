"use client";

import React, { useState, useEffect } from 'react';
import StarPlayerCard from '../components/StarPlayerCard';
import type { StarPlayerDefinition } from '@bb/game-engine';

const API_URL = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8201';

/**
 * Page de listing des Star Players
 */
export default function StarPlayersPage() {
  const [starPlayers, setStarPlayers] = useState<StarPlayerDefinition[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<StarPlayerDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filtres
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoster, setSelectedRoster] = useState<string>('all');
  const [minCost, setMinCost] = useState<number>(0);
  const [maxCost, setMaxCost] = useState<number>(400000);
  const [selectedSkill, setSelectedSkill] = useState<string>('');
  
  // Star players sélectionnés
  const [selectedPlayers, setSelectedPlayers] = useState<StarPlayerDefinition[]>([]);

  // Charger tous les star players au montage du composant
  useEffect(() => {
    loadStarPlayers();
  }, []);

  // Appliquer les filtres
  useEffect(() => {
    applyFilters();
  }, [starPlayers, searchQuery, selectedRoster, minCost, maxCost, selectedSkill]);

  const loadStarPlayers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/star-players`);
      const data = await response.json();
      
      if (data.success) {
        setStarPlayers(data.data);
        setFilteredPlayers(data.data);
      } else {
        setError('Erreur lors du chargement des star players');
      }
    } catch (err) {
      setError('Impossible de se connecter au serveur');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...starPlayers];

    // Filtre par recherche textuelle
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(sp => 
        sp.displayName.toLowerCase().includes(query) ||
        sp.slug.toLowerCase().includes(query)
      );
    }

    // Filtre par roster
    if (selectedRoster !== 'all') {
      // TODO: Implémenter le filtrage par roster via l'API
      // Pour l'instant, on garde tous les joueurs
    }

    // Filtre par coût
    filtered = filtered.filter(sp => 
      sp.cost >= minCost && sp.cost <= maxCost
    );

    // Filtre par compétence
    if (selectedSkill) {
      filtered = filtered.filter(sp => 
        sp.skills.toLowerCase().includes(selectedSkill.toLowerCase())
      );
    }

    setFilteredPlayers(filtered);
  };

  const handleSelectPlayer = (player: StarPlayerDefinition) => {
    const isSelected = selectedPlayers.some(p => p.slug === player.slug);
    
    if (isSelected) {
      setSelectedPlayers(selectedPlayers.filter(p => p.slug !== player.slug));
    } else {
      setSelectedPlayers([...selectedPlayers, player]);
    }
  };

  const totalCost = selectedPlayers.reduce((sum, p) => sum + p.cost, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des star players...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-red-600">
          <p className="text-xl mb-2">❌ {error}</p>
          <button
            onClick={loadStarPlayers}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* En-tête */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Star Players Blood Bowl</h1>
          <p className="text-gray-600">
            {filteredPlayers.length} mercenaire{filteredPlayers.length > 1 ? 's' : ''} légendaire{filteredPlayers.length > 1 ? 's' : ''} disponible{filteredPlayers.length > 1 ? 's' : ''}
          </p>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">Filtres</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Recherche */}
            <div>
              <label className="block text-sm font-medium mb-2">Recherche</label>
              <input
                type="text"
                placeholder="Nom du joueur..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Roster */}
            <div>
              <label className="block text-sm font-medium mb-2">Équipe</label>
              <select
                value={selectedRoster}
                onChange={(e) => setSelectedRoster(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Toutes les équipes</option>
                <option value="skaven">Skavens</option>
                <option value="wood_elf">Elfes Sylvains</option>
                <option value="dwarf">Nains</option>
                <option value="orc">Orcs</option>
                <option value="human">Humains</option>
              </select>
            </div>

            {/* Coût minimum */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Coût min: {(minCost / 1000).toLocaleString()} K
              </label>
              <input
                type="range"
                min="0"
                max="400000"
                step="10000"
                value={minCost}
                onChange={(e) => setMinCost(Number(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Coût maximum */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Coût max: {(maxCost / 1000).toLocaleString()} K
              </label>
              <input
                type="range"
                min="0"
                max="400000"
                step="10000"
                value={maxCost}
                onChange={(e) => setMaxCost(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          {/* Compétence */}
          <div className="mt-4">
            <label className="block text-sm font-medium mb-2">Compétence</label>
            <input
              type="text"
              placeholder="block, dodge, mighty-blow..."
              value={selectedSkill}
              onChange={(e) => setSelectedSkill(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Bouton reset */}
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedRoster('all');
              setMinCost(0);
              setMaxCost(400000);
              setSelectedSkill('');
            }}
            className="mt-4 bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
          >
            Réinitialiser les filtres
          </button>
        </div>

        {/* Sélection actuelle */}
        {selectedPlayers.length > 0 && (
          <div className="bg-blue-100 border-2 border-blue-500 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-2">Sélection actuelle</h2>
            <p className="mb-2">
              {selectedPlayers.length} star player{selectedPlayers.length > 1 ? 's' : ''} sélectionné{selectedPlayers.length > 1 ? 's' : ''}
            </p>
            <p className="text-2xl font-bold">
              Coût total: {(totalCost / 1000).toLocaleString()} K po
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedPlayers.map(player => (
                <span
                  key={player.slug}
                  className="bg-white px-3 py-1 rounded-full text-sm font-medium"
                >
                  {player.displayName}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Grille de cartes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredPlayers.map(player => (
            <StarPlayerCard
              key={player.slug}
              starPlayer={player}
              onSelect={handleSelectPlayer}
              selected={selectedPlayers.some(p => p.slug === player.slug)}
            />
          ))}
        </div>

        {/* Message si aucun résultat */}
        {filteredPlayers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-xl text-gray-600">
              Aucun star player ne correspond aux critères de recherche.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

