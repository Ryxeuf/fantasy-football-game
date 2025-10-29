"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CopyrightFooter from '../../components/CopyrightFooter';
import SkillTooltip from '../../components/SkillTooltip';
import type { StarPlayerDefinition } from '@bb/game-engine';
import { getStarPlayerSkillSlugs } from '@bb/game-engine';

const API_URL = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8201';

/**
 * Page de détail d'un Star Player individuel
 */
export default function StarPlayerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  
  const [starPlayer, setStarPlayer] = useState<StarPlayerDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (slug) {
      loadStarPlayer();
    }
  }, [slug]);

  const loadStarPlayer = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/star-players/${slug}`);
      const data = await response.json();
      
      if (data.success) {
        setStarPlayer(data.data);
      } else {
        setError('Star Player introuvable');
      }
    } catch (err) {
      setError('Erreur lors du chargement');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getRegionalRuleLabel = (rule: string): string => {
    const labels: Record<string, string> = {
      'all': 'Toutes les équipes',
      'badlands_brawl': 'Bagarre des Terres Arides',
      'elven_kingdoms_league': 'Ligue des Royaumes Elfiques',
      'halfling_thimble_cup': 'Coupe du Dé à Coudre Halfling',
      'lustrian_superleague': 'Super-ligue de Lustrie',
      'old_world_classic': 'Classique du Vieux Monde',
      'sylvanian_spotlight': 'Spot de Sylvanie',
      'underworld_challenge': 'Défi des Bas-fonds',
      'worlds_edge_superleague': 'Super-ligue du Bout du Monde',
      'favoured_of': 'Favoris de...',
    };
    return labels[rule] || rule;
  };

  const getStatColor = (value: number, stat: 'ma' | 'st' | 'ag' | 'pa' | 'av'): string => {
    // Couleurs basées sur les valeurs typiques
    if (stat === 'ma') {
      if (value >= 8) return 'text-green-600 font-bold';
      if (value <= 4) return 'text-red-600';
      return 'text-gray-700';
    }
    if (stat === 'st') {
      if (value >= 5) return 'text-green-600 font-bold';
      if (value <= 2) return 'text-red-600';
      return 'text-gray-700';
    }
    if (stat === 'ag' || stat === 'pa') {
      if (value <= 2) return 'text-green-600 font-bold';
      if (value >= 5) return 'text-red-600';
      return 'text-gray-700';
    }
    if (stat === 'av') {
      if (value <= 8) return 'text-green-600 font-bold';
      if (value >= 11) return 'text-red-600';
      return 'text-gray-700';
    }
    return 'text-gray-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (error || !starPlayer) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-red-600 mb-4">❌</h1>
          <p className="text-xl text-gray-600 mb-4">{error || 'Star Player introuvable'}</p>
          <button
            onClick={() => router.push('/star-players')}
            className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700"
          >
            Retour à la liste
          </button>
        </div>
      </div>
    );
  }

  // Utiliser la fonction centralisée pour parser les compétences
  const skills = getStarPlayerSkillSlugs(starPlayer);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-8">
        {/* Bouton retour */}
        <button
          onClick={() => router.push('/star-players')}
          className="mb-6 text-blue-600 hover:text-blue-800 flex items-center gap-2"
        >
          ← Retour à la liste
        </button>

        {/* En-tête avec image */}
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-red-800 to-red-600 text-white p-8">
            <div className="flex flex-col md:flex-row items-center gap-8">
              {/* Image */}
              <div className="flex-shrink-0">
                <div className="w-48 h-48 bg-gray-200 rounded-lg overflow-hidden shadow-lg">
                  {!imageError ? (
                    <img
                      src={starPlayer.imageUrl?.replace('/data/Star-Players_files/', '/images/star-players/') || `/images/star-players/${slug}.jpg`}
                      alt={starPlayer.displayName}
                      className="w-full h-full object-cover"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-300">
                      <span className="text-6xl">⭐</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Nom et coût */}
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-5xl font-bold mb-4">{starPlayer.displayName}</h1>
                <div className="flex items-center justify-center md:justify-start gap-4">
                  <span className="text-3xl font-bold bg-yellow-400 text-black px-6 py-3 rounded-lg shadow-lg">
                    {(starPlayer.cost / 1000).toLocaleString()} K po
                  </span>
                  <span className="text-xl opacity-90">Star Player</span>
                </div>
              </div>
            </div>
          </div>

          {/* Caractéristiques */}
          <div className="p-8">
            <h2 className="text-2xl font-bold mb-6">Caractéristiques</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <div className="bg-blue-50 p-6 rounded-lg text-center border-2 border-blue-200">
                <div className="text-gray-600 text-sm font-medium mb-2">MA</div>
                <div className={`text-4xl font-bold ${getStatColor(starPlayer.ma, 'ma')}`}>
                  {starPlayer.ma}
                </div>
              </div>
              <div className="bg-red-50 p-6 rounded-lg text-center border-2 border-red-200">
                <div className="text-gray-600 text-sm font-medium mb-2">ST</div>
                <div className={`text-4xl font-bold ${getStatColor(starPlayer.st, 'st')}`}>
                  {starPlayer.st}
                </div>
              </div>
              <div className="bg-green-50 p-6 rounded-lg text-center border-2 border-green-200">
                <div className="text-gray-600 text-sm font-medium mb-2">AG</div>
                <div className={`text-4xl font-bold ${getStatColor(starPlayer.ag, 'ag')}`}>
                  {starPlayer.ag}+
                </div>
              </div>
              <div className="bg-purple-50 p-6 rounded-lg text-center border-2 border-purple-200">
                <div className="text-gray-600 text-sm font-medium mb-2">PA</div>
                <div className={`text-4xl font-bold ${starPlayer.pa ? getStatColor(starPlayer.pa, 'pa') : 'text-gray-400'}`}>
                  {starPlayer.pa ? `${starPlayer.pa}+` : '—'}
                </div>
              </div>
              <div className="bg-orange-50 p-6 rounded-lg text-center border-2 border-orange-200">
                <div className="text-gray-600 text-sm font-medium mb-2">AV</div>
                <div className={`text-4xl font-bold ${getStatColor(starPlayer.av, 'av')}`}>
                  {starPlayer.av}+
                </div>
              </div>
            </div>

            {/* Compétences */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-4">Compétences et Traits</h2>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill, index) => (
                  <SkillTooltip
                    key={index}
                    skillSlug={skill}
                  />
                ))}
              </div>
            </div>

            {/* Règle spéciale */}
            {starPlayer.specialRule && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4">⭐ Règle Spéciale</h2>
                <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6">
                  <p className="text-gray-800 leading-relaxed">{starPlayer.specialRule}</p>
                </div>
              </div>
            )}

            {/* Équipes éligibles */}
            <div>
              <h2 className="text-2xl font-bold mb-4">Équipes Éligibles</h2>
              <div className="bg-gray-50 rounded-lg p-6">
                {starPlayer.hirableBy.includes('all') ? (
                  <div className="text-center">
                    <span className="inline-block bg-green-100 text-green-800 px-6 py-3 rounded-lg font-bold text-lg border-2 border-green-300">
                      ✅ Toutes les équipes
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {starPlayer.hirableBy.map((rule, index) => (
                      <span
                        key={index}
                        className="bg-white text-gray-800 px-4 py-2 rounded-lg font-medium border-2 border-gray-300 shadow-sm"
                      >
                        {getRegionalRuleLabel(rule)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Informations complémentaires */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
          <h3 className="font-bold text-lg mb-2">ℹ️ Note</h3>
          <p className="text-gray-700">
            Les Star Players sont des mercenaires légendaires qui peuvent être recrutés temporairement.
            Ils apportent des compétences exceptionnelles mais coûtent cher et ne peuvent être utilisés
            qu'une fois par match.
          </p>
        </div>
      </div>
      
      <CopyrightFooter />
    </div>
  );
}

