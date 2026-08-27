"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import StarPlayerCard, { type StarPlayerWithKeywords } from '../components/StarPlayerCard';
import CopyrightFooter from '../components/CopyrightFooter';
import {
  isStarPlayerHirableByRoster,
  type StarPlayerDefinition,
} from '@bb/game-engine';
import { useLanguage } from '../contexts/LanguageContext';
import { collectKeywordOptions, filterByKeywords } from '../lib/keyword-filter';
import { UMAMI_EVENTS, trackUmamiEvent } from '../lib/umami-events';
import {
  ALL_TEAMS_OPTION,
  buildTeamFilterOptions,
  type ApiRosterRow,
  type TeamFilterOption,
} from './team-filter-options';

const API_URL = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8201';

/**
 * Page de listing des Star Players
 */
export default function StarPlayersPage() {
  const { t, language } = useLanguage();
  const [starPlayers, setStarPlayers] = useState<StarPlayerWithKeywords[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<StarPlayerWithKeywords[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filtres
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoster, setSelectedRoster] = useState<string>(ALL_TEAMS_OPTION);
  // Équipes proposées par le filtre : servies par `/api/rosters` pour la
  // saison sélectionnée (repli catalogue engine si l'API est indisponible).
  const [teamOptions, setTeamOptions] = useState<TeamFilterOption[]>([]);
  const [minCost, setMinCost] = useState<number>(0);
  const [maxCost, setMaxCost] = useState<number>(400000);
  const [selectedSkill, setSelectedSkill] = useState<string>('');
  // Mots-clés actifs (lignée + type). Sélection multiple = ET logique,
  // même sémantique que le filtre des positions (`PositionKeywordBrowser`).
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [selectedRuleset, setSelectedRuleset] = useState<'season_2' | 'season_3'>('season_3');

  // Navigation
  const router = useRouter();

  // Charger tous les star players au montage du composant et quand le ruleset change
  useEffect(() => {
    loadStarPlayers();
  }, [selectedRuleset]);

  // Liste des équipes du filtre : elle suit la saison (une édition n'a pas le
  // même parc d'équipes) et la langue (noms localisés servis par l'API).
  // Chargement indépendant des Star Players : un échec ici ne doit pas
  // masquer la liste, il fait juste retomber le filtre sur le catalogue.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let rows: ApiRosterRow[] = [];
      try {
        const response = await fetch(
          `${API_URL}/api/rosters?lang=${language}&ruleset=${selectedRuleset}`,
        );
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data?.rosters)) rows = data.rosters;
        }
      } catch {
        // Repli silencieux : `buildTeamFilterOptions([])` sert le catalogue.
      }
      if (cancelled) return;
      const options = buildTeamFilterOptions(rows, selectedRuleset, language);
      setTeamOptions(options);
      // L'équipe sélectionnée peut ne pas exister dans la nouvelle édition
      // (ex: Bretonniens en saison 2) : on ne laisse pas un filtre fantôme
      // vider la liste sans que l'utilisateur puisse le voir.
      setSelectedRoster((current) =>
        current === ALL_TEAMS_OPTION ||
        options.some((option) => option.slug === current)
          ? current
          : ALL_TEAMS_OPTION,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedRuleset, language]);

  // Appliquer les filtres
  useEffect(() => {
    applyFilters();
  }, [starPlayers, searchQuery, selectedRoster, selectedRuleset, minCost, maxCost, selectedSkill, selectedKeywords, language]);

  // Les mots-clés proposés se recalculent sur la liste chargée (le catalogue
  // change avec le ruleset) et sur la langue (libellés FR ou EN).
  const keywordOptions = React.useMemo(
    () => collectKeywordOptions(starPlayers, language),
    [starPlayers, language],
  );

  const toggleKeyword = (keyword: string) => {
    setSelectedKeywords((current) =>
      current.includes(keyword)
        ? current.filter((k) => k !== keyword)
        : [...current, keyword],
    );
  };

  const loadStarPlayers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/star-players?ruleset=${selectedRuleset}`);
      const data = await response.json();

      if (data.success) {
        // Garde-fou : dédupliquer par slug si le serveur renvoie plusieurs rulesets.
        const uniqueBySlug = Array.from(
          new Map<string, StarPlayerWithKeywords>(
            data.data.map((p: StarPlayerWithKeywords) => [p.slug, p])
          ).values()
        );
        setStarPlayers(uniqueBySlug);
        setFilteredPlayers(uniqueBySlug);
      } else {
        setError(t.starPlayers.error);
      }
    } catch (err) {
      setError(t.starPlayers.serverError);
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

    // Filtre par roster : le predicat vit dans le game-engine
    // (`isStarPlayerHirableByRoster`, pur et teste), qui resout les deux
    // formes de `hirableBy` remontees par l'API — slug de Ligue regionale et
    // slug de roster brut — POUR L'EDITION SELECTIONNEE (les Ligues 2025
    // n'existent pas en saison 2). C'est le meme referentiel que la rubrique
    // « Joue pour » des fiches, donc les deux ne peuvent pas diverger.
    if (selectedRoster !== ALL_TEAMS_OPTION) {
      filtered = filtered.filter((sp) =>
        isStarPlayerHirableByRoster(sp.hirableBy, selectedRoster, selectedRuleset),
      );
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

    // Filtre par mots-clés (lignée + type) : ET logique sur la sélection.
    filtered = filterByKeywords(filtered, selectedKeywords, language);

    setFilteredPlayers(filtered);
  };

  const handlePlayerClick = (player: StarPlayerDefinition) => {
    trackUmamiEvent(UMAMI_EVENTS.STAR_PLAYER_HIRE, {
      slug: player.slug,
      cost: player.cost,
    });
    router.push(`/star-players/${player.slug}`);
  };

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
            {t.starPlayers.retry}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* En-tête */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">{t.starPlayers.title}</h1>
          <p className="text-sm sm:text-base text-gray-600">
            {filteredPlayers.length} {filteredPlayers.length === 1 ? t.starPlayers.available : t.starPlayers.availablePlural}
          </p>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl font-bold mb-4">{t.starPlayers.filters}</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Ruleset */}
            <div>
              <label className="block text-sm font-medium mb-2">{t.starPlayers.ruleset}</label>
              <select
                value={selectedRuleset}
                onChange={(e) => setSelectedRuleset(e.target.value as 'season_2' | 'season_3')}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              >
                <option value="season_3">{t.starPlayers.rulesetSeason3}</option>
                <option value="season_2">{t.starPlayers.rulesetSeason2}</option>
              </select>
            </div>

            {/* Recherche */}
            <div>
              <label className="block text-sm font-medium mb-2">{t.starPlayers.search}</label>
              <input
                type="text"
                placeholder={t.starPlayers.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Roster */}
            <div>
              <label className="block text-sm font-medium mb-2">{t.starPlayers.team}</label>
              <select
                value={selectedRoster}
                onChange={(e) => setSelectedRoster(e.target.value)}
                data-testid="star-player-team-filter"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              >
                <option value={ALL_TEAMS_OPTION}>{t.starPlayers.allTeams}</option>
                {teamOptions.map((option) => (
                  <option key={option.slug} value={option.slug}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Coût minimum */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {t.starPlayers.minCost}: {(minCost / 1000).toLocaleString()} K
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
                {t.starPlayers.maxCost}: {(maxCost / 1000).toLocaleString()} K
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
            <label className="block text-sm font-medium mb-2">{t.starPlayers.skill}</label>
            <input
              type="text"
              placeholder="block, dodge, mighty-blow..."
              value={selectedSkill}
              onChange={(e) => setSelectedSkill(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Mots-clés (lignée + type) */}
          {keywordOptions.length > 0 && (
            <div className="mt-4" data-testid="star-player-keyword-filter">
              <label className="block text-sm font-medium mb-2">{t.starPlayers.keywords}</label>
              <div className="flex flex-wrap gap-2">
                {keywordOptions.map((keyword) => {
                  const active = selectedKeywords.includes(keyword);
                  return (
                    <button
                      key={keyword}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleKeyword(keyword)}
                      className={`px-2 py-1 rounded text-xs font-medium uppercase tracking-wide border transition-colors ${
                        active
                          ? 'bg-blue-600 text-white border-blue-700'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {keyword}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bouton reset */}
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedRoster(ALL_TEAMS_OPTION);
              setMinCost(0);
              setMaxCost(400000);
              setSelectedSkill('');
              setSelectedKeywords([]);
            }}
            className="mt-4 bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
          >
            {t.starPlayers.resetFilters}
          </button>
        </div>

        {/* Information */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-2">ℹ️ {t.starPlayers.info}</h2>
          <p className="text-gray-700">
            {t.starPlayers.infoText}
          </p>
        </div>

        {/* Grille de cartes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {filteredPlayers.map(player => (
            <StarPlayerCard
              key={player.slug}
              starPlayer={player}
              onClick={handlePlayerClick}
            />
          ))}
        </div>

        {/* Message si aucun résultat */}
        {filteredPlayers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-xl text-gray-600">
              {t.starPlayers.noResults}
            </p>
          </div>
        )}
      </div>
      
      <CopyrightFooter />
    </div>
  );
}

