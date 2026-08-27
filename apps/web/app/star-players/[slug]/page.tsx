"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import CopyrightFooter from '../../components/CopyrightFooter';
import SkillTooltip from '../../components/SkillTooltip';
import KeywordChips from '../../components/KeywordChips';
import type { StarPlayerDefinition } from '@bb/game-engine';
import {
  DEFAULT_RULESET,
  getStarPlayerSkillSlugs,
  getStarPlayerPair,
  type Ruleset,
} from '@bb/game-engine';
import { useLanguage } from '../../contexts/LanguageContext';
import { getPlaysForRosters, toPlaysForRosters } from './plays-for';

/** Libellés des éditions (badge + lien de bascule). */
const RULESET_LABELS: Record<string, { fr: string; en: string }> = {
  season_2: { fr: 'Saison 2', en: 'Season 2' },
  season_3: { fr: 'Saison 3', en: 'Season 3' },
};

function rulesetLabel(ruleset: string, language: string): string {
  const entry = RULESET_LABELS[ruleset];
  if (!entry) return ruleset;
  return language === 'en' ? entry.en : entry.fr;
}

/**
 * Édition demandée dans l'URL (`?ruleset=season_2`). Lue côté client
 * uniquement : la page est déjà 100 % client (données chargées au montage).
 */
function readRequestedRuleset(): string | null {
  if (typeof window === 'undefined') return null;
  const value = new URLSearchParams(window.location.search).get('ruleset');
  return value && value in RULESET_LABELS ? value : null;
}

const API_URL = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8201';

/**
 * Payload servi par `GET /star-players/:slug`. `keywordsEn` est la traduction
 * des mots-clés (lignée + type) ; optionnel pour rester compatible avec un
 * serveur antérieur à la feature.
 */
type StarPlayerDetail = StarPlayerDefinition & {
  readonly keywordsEn?: string | null;
  /** Édition servie (le même slug existe en Saison 2 ET Saison 3). */
  readonly ruleset?: string;
  /** Rosters pouvant recruter, résolus par le serveur depuis la base. */
  readonly playsFor?: readonly string[];
  /** Éditions dans lesquelles ce slug existe. */
  readonly availableRulesets?: readonly string[];
};

/**
 * Libellé de repli pour un partenaire de paire que le catalogue compilé ne
 * connaît pas (star créée en admin) : le slug rendu lisible plutôt que brut.
 */
function getRosterAgnosticName(slug: string): string {
  return slug
    .split(/[_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Page de détail d'un Star Player individuel
 */
export default function StarPlayerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { language } = useLanguage();

  const [starPlayer, setStarPlayer] = useState<StarPlayerDetail | null>(null);
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
      const requested = readRequestedRuleset();
      const response = await fetch(
        `${API_URL}/star-players/${slug}${requested ? `?ruleset=${requested}` : ''}`,
      );
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
      // A16 — règles régionales Blood Bowl 2025 (S3)
      'woodland_league': 'Ligue Sylvestre',
      'chaos_clash': 'Clash du Chaos',
      'favoured_of_nurgle': 'Favoris de Nurgle',
      'favoured_of_khorne': 'Favoris de Khorne',
      'favoured_of_hashut': 'Favoris de Hashut',
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

  // Lot G — paire obligatoire : le prix de la carte est celui de LA PAIRE. Le
  // catalogue le porte sur le primaire (partenaire a 0) pour que la somme des
  // couts d'une liste reste juste ; on affiche donc le prix de la paire des
  // deux cotes, avec le nom du partenaire.
  const ruleset: Ruleset = (starPlayer.ruleset as Ruleset) ?? DEFAULT_RULESET;
  const pair = getStarPlayerPair(starPlayer.slug, ruleset);
  // Prix de paire FRAIS depuis l'API (coûts DB) quand disponible ; le
  // catalogue statique du moteur ne sert que de repli.
  const displayedCost =
    (starPlayer as { pairCost?: number | null }).pairCost ??
    (pair ? pair.pairCost : starPlayer.cost);
  // Le prix annoncé dans le bandeau et celui de la phrase « paire obligatoire »
  // doivent être LE MÊME : la phrase repartait de `pair.pairCost` (catalogue
  // compilé) pendant que le bandeau servait déjà `pairCost` de l'API — deux
  // prix de paire sur la même fiche dès qu'un coût était corrigé en admin
  // (W7 de l'audit).
  const partnerSlug =
    (starPlayer as { pairWith?: string | null }).pairWith ??
    pair?.partnerSlug ??
    null;
  const partnerLabel = partnerSlug
    ? (pair?.partnerName ?? getRosterAgnosticName(partnerSlug))
    : null;

  // Mots-clés (lignée + type) : EN si disponible, repli FR.
  const keywords =
    language === 'en'
      ? starPlayer.keywordsEn ?? starPlayer.keywords
      : starPlayer.keywords ?? starPlayer.keywordsEn;

  // « Joue pour » : équipes pouvant recruter ce Star Player. Le serveur
  // résout `playsFor` depuis les rosters EN BASE de l'édition du Star Player
  // (source de vérité) ; le calcul local sur le catalogue statique n'est
  // qu'un repli pour un serveur antérieur à la feature.
  const playsForRosters = starPlayer.playsFor
    ? toPlaysForRosters(starPlayer.playsFor)
    : getPlaysForRosters(starPlayer.hirableBy, ruleset);
  const otherRulesets = (starPlayer.availableRulesets ?? []).filter(
    (r) => r !== ruleset,
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Bouton retour */}
        <button
          onClick={() => router.push('/star-players')}
          className="mb-4 sm:mb-6 text-blue-600 hover:text-blue-800 flex items-center gap-2 text-sm sm:text-base transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Retour à la liste
        </button>

        {/* En-tête avec image */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6 sm:mb-8">
          <div className="bg-gradient-to-r from-red-800 to-red-600 text-white p-4 sm:p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-center gap-4 sm:gap-6 md:gap-8">
              {/* Image — S25.8 : `next/image` apporte lazy-load par defaut,
                  responsive sizes, et bascule automatique vers AVIF/WebP
                  selon le navigateur (cf. next.config.mjs `formats`). */}
              <div className="flex-shrink-0">
                <div className="relative w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 bg-gray-200 rounded-lg overflow-hidden shadow-lg">
                  {!imageError ? (
                    <Image
                      src={starPlayer.imageUrl?.replace('/data/Star-Players_files/', '/images/star-players/') || `/images/star-players/${slug}.jpg`}
                      alt={starPlayer.displayName}
                      fill
                      sizes="(max-width: 640px) 128px, (max-width: 768px) 160px, 192px"
                      className="object-cover"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-300">
                      <span className="text-4xl sm:text-5xl md:text-6xl">⭐</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Nom et coût */}
              <div className="flex-1 text-center md:text-left">
                <div className="flex flex-col sm:flex-row items-center md:items-start justify-center md:justify-start gap-3 sm:gap-4 mb-3 sm:mb-4">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold">{starPlayer.displayName}</h1>
                  <span
                    data-testid="star-player-ruleset-badge"
                    title={language === 'en' ? 'Rules edition of this card' : 'Édition des règles de cette fiche'}
                    className="bg-white/20 border border-white/60 text-white text-xs sm:text-sm font-semibold px-3 py-1 rounded-full whitespace-nowrap"
                  >
                    {rulesetLabel(ruleset, language)}
                  </span>
                  {starPlayer.isMegaStar && (
                    <span className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-black text-xs sm:text-sm md:text-base font-bold px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-lg border-2 border-yellow-700 whitespace-nowrap">
                      ⭐ MEGA STAR
                    </span>
                  )}
                </div>
                {keywords && (
                  <div className="flex justify-center md:justify-start mb-3 sm:mb-4">
                    <KeywordChips
                      keywords={keywords}
                      testId="star-player-keywords"
                    />
                  </div>
                )}
                <div className="flex flex-col sm:flex-row items-center md:items-start justify-center md:justify-start gap-3 sm:gap-4">
                  <span
                    className="text-xl sm:text-2xl md:text-3xl font-bold bg-yellow-400 text-black px-4 sm:px-6 py-2 sm:py-3 rounded-lg shadow-lg"
                    data-testid="star-player-cost"
                  >
                    {(displayedCost / 1000).toLocaleString()} K po
                  </span>
                  <span className="text-base sm:text-lg md:text-xl opacity-90">Star Player</span>
                </div>
                {otherRulesets.length > 0 && (
                  <p className="mt-3 text-sm opacity-90" data-testid="star-player-ruleset-switch">
                    {otherRulesets.map((other) => (
                      <a
                        key={other}
                        href={`/star-players/${starPlayer.slug}${other === DEFAULT_RULESET ? '' : `?ruleset=${other}`}`}
                        className="underline hover:no-underline mr-3"
                      >
                        {language === 'en'
                          ? `View the ${rulesetLabel(other, language)} version`
                          : `Voir la version ${rulesetLabel(other, language)}`}
                      </a>
                    ))}
                  </p>
                )}
                {partnerLabel && (
                  <p
                    className="mt-3 text-sm sm:text-base opacity-90"
                    data-testid="star-player-pair"
                  >
                    Recrutement en paire obligatoire avec {partnerLabel} —
                    {' '}{(displayedCost / 1000).toLocaleString()} K po pour la paire.
                  </p>
                )}
                {/* Carte exportable (change export-player-cards) : PNG 750×1050
                    façon carte à collectionner, rendu par /star-players/[slug]/card. */}
                <div className="mt-4 flex flex-col sm:flex-row items-center md:items-start justify-center md:justify-start gap-2 sm:gap-3">
                  <a
                    href={`/star-players/${slug}/card?lang=${language === 'en' ? 'en' : 'fr'}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="star-card-preview"
                    className="inline-flex items-center gap-2 rounded-lg border border-white/40 bg-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/25"
                  >
                    🃏 {language === 'en' ? 'View the card' : 'Voir la carte'}
                  </a>
                  <a
                    href={`/star-players/${slug}/card?lang=${language === 'en' ? 'en' : 'fr'}&download=1`}
                    data-testid="star-card-download"
                    className="inline-flex items-center gap-2 rounded-lg border border-white/40 bg-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/25"
                  >
                    ⬇️ {language === 'en' ? 'Download the PNG card' : 'Télécharger la carte PNG'}
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Contenu principal */}
          <div className="p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-8">
            {/* Caractéristiques */}
            <div>
              <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-gray-900">Caractéristiques</h2>
              <div className="grid grid-cols-5 gap-2 sm:gap-3 md:gap-4">
                <div className="bg-blue-50 p-3 sm:p-4 md:p-6 rounded-lg text-center border-2 border-blue-200 hover:shadow-md transition-shadow">
                  <div className="text-gray-600 text-xs sm:text-sm font-medium mb-1 sm:mb-2">MA</div>
                  <div className={`text-2xl sm:text-3xl md:text-4xl font-bold ${getStatColor(starPlayer.ma, 'ma')}`}>
                    {starPlayer.ma}
                  </div>
                </div>
                <div className="bg-red-50 p-3 sm:p-4 md:p-6 rounded-lg text-center border-2 border-red-200 hover:shadow-md transition-shadow">
                  <div className="text-gray-600 text-xs sm:text-sm font-medium mb-1 sm:mb-2">ST</div>
                  <div className={`text-2xl sm:text-3xl md:text-4xl font-bold ${getStatColor(starPlayer.st, 'st')}`}>
                    {starPlayer.st}
                  </div>
                </div>
                <div className="bg-green-50 p-3 sm:p-4 md:p-6 rounded-lg text-center border-2 border-green-200 hover:shadow-md transition-shadow">
                  <div className="text-gray-600 text-xs sm:text-sm font-medium mb-1 sm:mb-2">AG</div>
                  <div className={`text-2xl sm:text-3xl md:text-4xl font-bold ${getStatColor(starPlayer.ag, 'ag')}`}>
                    {starPlayer.ag}+
                  </div>
                </div>
                <div className="bg-purple-50 p-3 sm:p-4 md:p-6 rounded-lg text-center border-2 border-purple-200 hover:shadow-md transition-shadow">
                  <div className="text-gray-600 text-xs sm:text-sm font-medium mb-1 sm:mb-2">PA</div>
                  <div className={`text-2xl sm:text-3xl md:text-4xl font-bold ${starPlayer.pa ? getStatColor(starPlayer.pa, 'pa') : 'text-gray-400'}`}>
                    {starPlayer.pa ? `${starPlayer.pa}+` : '—'}
                  </div>
                </div>
                <div className="bg-orange-50 p-3 sm:p-4 md:p-6 rounded-lg text-center border-2 border-orange-200 hover:shadow-md transition-shadow">
                  <div className="text-gray-600 text-xs sm:text-sm font-medium mb-1 sm:mb-2">AV</div>
                  <div className={`text-2xl sm:text-3xl md:text-4xl font-bold ${getStatColor(starPlayer.av, 'av')}`}>
                    {starPlayer.av}+
                  </div>
                </div>
              </div>
            </div>

            {/* Compétences */}
            <div>
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-gray-900">Compétences et Traits</h2>
              <div className="bg-gray-50 rounded-lg p-3 sm:p-4 md:p-5">
                {skills.length > 0 ? (
                  <div className="flex flex-wrap gap-2 sm:gap-3">
                    {skills.map((skill, index) => (
                      <SkillTooltip
                        key={`${skill}-${index}`}
                        skillSlug={skill}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm italic">Aucune compétence spéciale</p>
                )}
              </div>
            </div>

            {/* Règle spéciale */}
            {(() => {
              const preferredRule =
                language === 'en'
                  ? starPlayer.specialRuleEn ?? starPlayer.specialRule
                  : starPlayer.specialRule ?? starPlayer.specialRuleEn;
              if (!preferredRule) return null;
              const heading = language === 'en' ? 'Special Rule' : 'Règle Spéciale';
              return (
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-gray-900 flex items-center gap-2">
                    <span className="text-2xl">⭐</span>
                    {heading}
                  </h2>
                  <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 sm:p-6">
                    <p className="text-gray-800 leading-relaxed text-sm sm:text-base">{preferredRule}</p>
                  </div>
                </div>
              );
            })()}

            {/* Joue pour — équipes pouvant recruter ce Star Player */}
            {playsForRosters.length > 0 && (
              <div data-testid="star-player-plays-for">
                <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-gray-900 flex items-center gap-2">
                  <span className="text-2xl">🏈</span>
                  Joue pour
                </h2>
                <p className="text-sm text-gray-600 mb-3">
                  {playsForRosters.length} équipe{playsForRosters.length > 1 ? 's' : ''} peu{playsForRosters.length > 1 ? 'vent' : 't'} recruter {starPlayer.displayName}.
                </p>
                <div className="bg-gray-50 rounded-lg p-3 sm:p-4 md:p-5">
                  <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                    {playsForRosters.map((roster) => (
                      <li key={roster.slug}>
                        <a
                          href={`/teams/${roster.slug}`}
                          data-testid={`star-player-roster-${roster.slug}`}
                          className="group flex items-center gap-2 bg-white text-gray-800 px-3 sm:px-4 py-2 rounded-lg font-medium border-2 border-gray-300 shadow-sm text-sm sm:text-base hover:border-blue-400 hover:shadow-md transition-all"
                        >
                          <span className="group-hover:text-blue-700 transition-colors">{roster.name}</span>
                          <span className="ml-auto text-gray-400 group-hover:translate-x-1 transition-transform" aria-hidden="true">→</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Ligues et règles régionales ouvrant le recrutement */}
            <div>
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-gray-900">Ligues et Règles Régionales</h2>
              <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
                {starPlayer.hirableBy.includes('all') ? (
                  <div className="text-center">
                    <span className="inline-block bg-green-100 text-green-800 px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-bold text-base sm:text-lg border-2 border-green-300">
                      ✅ Toutes les équipes
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 sm:gap-3">
                    {starPlayer.hirableBy.map((rule, index) => (
                      <span
                        key={index}
                        className="bg-white text-gray-800 px-3 sm:px-4 py-2 rounded-lg font-medium border-2 border-gray-300 shadow-sm text-sm sm:text-base hover:shadow-md transition-shadow"
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

        {/* Badge Mega Star */}
        {starPlayer.isMegaStar && (
          <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 border-4 border-yellow-400 rounded-xl p-4 sm:p-6 mb-6 sm:mb-8 shadow-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
              <div className="text-4xl sm:text-5xl">⭐</div>
              <div className="flex-1">
                <h3 className="text-xl sm:text-2xl font-bold text-yellow-900 mb-2">MEGA STAR</h3>
                <p className="text-yellow-800 text-sm sm:text-base">
                  Ce Star Player fait partie des légendes les plus emblématiques de Blood Bowl.
                  Les Mega Stars sont des joueurs d'exception reconnus dans tout le Vieux Monde.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Informations complémentaires */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 sm:p-6">
          <h3 className="font-bold text-base sm:text-lg mb-2 flex items-center gap-2">
            <span>ℹ️</span>
            Note
          </h3>
          <p className="text-gray-700 text-sm sm:text-base">
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

