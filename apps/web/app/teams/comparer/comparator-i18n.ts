/**
 * Dictionnaire i18n local au comparateur (fr + en, parité garantie en un seul
 * endroit). Les pages SSR rendent en français ; le comparateur interactif
 * bascule via `useLanguage()`.
 */

import type { Lang } from "../roster-meta";

export interface ComparatorStrings {
  readonly pageTitle: string;
  readonly pageIntro: string;
  readonly pick: string;
  readonly pickHint: string;
  readonly add: string;
  readonly remove: string;
  readonly compareCta: string;
  readonly clear: string;
  readonly search: string;
  readonly emptyState: string;
  readonly minSelection: string;
  readonly maxReached: string;
  readonly tier: string;
  readonly budget: string;
  readonly positions: string;
  readonly difficulty: string;
  readonly playStyle: string;
  readonly starPlayers: string;
  readonly summary: string;
  readonly noStars: string;
  readonly viewDetail: string;
  readonly shareableLink: string;
  readonly nafApproved: string;
  readonly official: string;
  readonly backToTeams: string;
  readonly tierList: string;
}

export const COMPARATOR_I18N: Record<Lang, ComparatorStrings> = {
  fr: {
    pageTitle: "Comparateur d'équipes Blood Bowl",
    pageIntro:
      "Sélectionnez 2 ou 3 rosters pour les comparer côte à côte : tier, budget, positions, difficulté, style de jeu et Star Players emblématiques.",
    pick: "Choisir les équipes",
    pickHint: "Sélectionnez de 2 à 3 équipes à comparer.",
    add: "Ajouter",
    remove: "Retirer",
    compareCta: "Comparer",
    clear: "Tout effacer",
    search: "Rechercher une équipe…",
    emptyState: "Aucune équipe ne correspond à votre recherche.",
    minSelection: "Sélectionnez au moins 2 équipes pour lancer la comparaison.",
    maxReached: "Maximum 3 équipes comparées à la fois.",
    tier: "Tier",
    budget: "Budget",
    positions: "Positions",
    difficulty: "Difficulté",
    playStyle: "Style de jeu",
    starPlayers: "Star Players emblématiques",
    summary: "En bref",
    noStars: "—",
    viewDetail: "Voir le roster",
    shareableLink: "Lien partageable de cette comparaison",
    nafApproved: "NAF",
    official: "Officielle",
    backToTeams: "Toutes les équipes",
    tierList: "Tier list",
  },
  en: {
    pageTitle: "Blood Bowl team comparator",
    pageIntro:
      "Pick 2 or 3 rosters to compare them side by side: tier, budget, positions, difficulty, play style and iconic Star Players.",
    pick: "Choose teams",
    pickHint: "Select between 2 and 3 teams to compare.",
    add: "Add",
    remove: "Remove",
    compareCta: "Compare",
    clear: "Clear all",
    search: "Search a team…",
    emptyState: "No team matches your search.",
    minSelection: "Select at least 2 teams to run the comparison.",
    maxReached: "Up to 3 teams compared at once.",
    tier: "Tier",
    budget: "Budget",
    positions: "Positions",
    difficulty: "Difficulty",
    playStyle: "Play style",
    starPlayers: "Iconic Star Players",
    summary: "In short",
    noStars: "—",
    viewDetail: "View roster",
    shareableLink: "Shareable link for this comparison",
    nafApproved: "NAF",
    official: "Official",
    backToTeams: "All teams",
    tierList: "Tier list",
  },
};
