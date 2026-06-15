/**
 * Onboarding "Crée ton équipe en 60 secondes" — logique pure.
 *
 * Tout ce qui est testable sans React vit ici : décision d'affichage,
 * sélection des rosters recommandés débutants, difficulté d'apprentissage
 * par roster, validation du nom, et la clé localStorage de skip.
 *
 * Aucune dépendance React / DOM ⇒ unit-testable sans jsdom.
 */

/** Clé localStorage dédiée pour mémoriser le skip ("Plus tard"). */
export const ONBOARDING_DISMISS_KEY = "onboarding_first_team_dismissed_v1";

/** Difficulté d'apprentissage (≠ tier compétitif renvoyé par l'API). */
export type RosterDifficulty = "easy" | "medium" | "hard";

/**
 * Rosters mis en avant pour débuter, dans l'ordre d'affichage. Ce sont
 * les équipes "bash" classiques (AV élevée, peu de finesse) qui pardonnent
 * les erreurs des nouveaux coachs.
 */
export const RECOMMENDED_BEGINNER_ROSTERS: readonly string[] = [
  "human",
  "orc",
  "dwarf",
  "lizardmen",
];

/**
 * Difficulté d'apprentissage par slug de roster. Sert d'indicateur
 * "débutant-friendly" dans la grille de sélection. Les slugs absents
 * retombent sur "medium".
 */
export const ROSTER_DIFFICULTY: Readonly<Record<string, RosterDifficulty>> = {
  // Bash, robustes, faciles à prendre en main.
  human: "easy",
  orc: "easy",
  dwarf: "easy",
  lizardmen: "easy",
  undead: "easy",
  black_orc: "easy",
  chaos_dwarf: "easy",
  norse: "easy",
  necromantic_horror: "easy",
  imperial_nobility: "easy",
  old_world_alliance: "easy",
  // Intermédiaires : demandent un peu de placement / gestion.
  skaven: "medium",
  dark_elf: "medium",
  amazon: "medium",
  chaos_chosen: "medium",
  chaos_renegade: "medium",
  nurgle: "medium",
  khorne: "medium",
  tomb_kings: "medium",
  underworld: "medium",
  slann: "medium",
  bretonnian: "medium",
  // Finesse / fragiles / stunty : à réserver aux coachs aguerris.
  wood_elf: "hard",
  high_elf: "hard",
  elven_union: "hard",
  vampire: "hard",
  goblin: "hard",
  halfling: "hard",
  ogre: "hard",
  snotling: "hard",
  gnome: "hard",
};

export function getRosterDifficulty(slug: string): RosterDifficulty {
  return ROSTER_DIFFICULTY[slug] ?? "medium";
}

/** Roster minimal tel que renvoyé par `GET /api/rosters`. */
export interface OnboardingRoster {
  readonly slug: string;
  readonly name: string;
  readonly tier?: string | number;
}

/**
 * Renvoie les rosters recommandés présents dans la liste disponible,
 * dans l'ordre canonique, plafonné à `max` (4 par défaut). Si aucun
 * recommandé n'est disponible, retombe sur les premiers rosters "easy"
 * de la liste, puis sur les premiers tout court — pour toujours proposer
 * une mise en avant.
 */
export function getRecommendedRosters(
  available: readonly OnboardingRoster[],
  max = 4,
): OnboardingRoster[] {
  const bySlug = new Map(available.map((r) => [r.slug, r] as const));
  const picked: OnboardingRoster[] = [];
  for (const slug of RECOMMENDED_BEGINNER_ROSTERS) {
    const match = bySlug.get(slug);
    if (match) picked.push(match);
    if (picked.length >= max) return picked;
  }
  if (picked.length === 0) {
    const easy = available.filter((r) => getRosterDifficulty(r.slug) === "easy");
    const fallback = easy.length > 0 ? easy : available;
    return fallback.slice(0, max);
  }
  return picked;
}

/** Set des slugs recommandés présents (pour flagger la grille). */
export function recommendedSlugSet(
  available: readonly OnboardingRoster[],
): Set<string> {
  return new Set(getRecommendedRosters(available).map((r) => r.slug));
}

export interface ShouldShowOnboardingInput {
  /** Nombre d'équipes du coach (assistant seulement si 0). */
  readonly teamsCount: number;
  /** L'utilisateur a-t-il déjà cliqué "Plus tard" ? */
  readonly dismissed: boolean;
  /** Chargement des données terminé ? On n'affiche pas en plein chargement. */
  readonly loaded: boolean;
}

/**
 * Décision pure : afficher l'assistant uniquement pour un coach sans
 * équipe qui n'a pas déjà skippé, et une fois les données chargées.
 */
export function shouldShowOnboarding({
  teamsCount,
  dismissed,
  loaded,
}: ShouldShowOnboardingInput): boolean {
  if (!loaded) return false;
  if (dismissed) return false;
  return teamsCount === 0;
}

/** Borne max du nom alignée sur le schéma serveur (`createFromRosterSchema`). */
export const TEAM_NAME_MAX_LENGTH = 100;

/** Valide un nom d'équipe : non vide une fois trimé, ≤ 100 caractères. */
export function isValidTeamName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= TEAM_NAME_MAX_LENGTH;
}

/** Les 3 étapes du wizard (intro implicite dans l'étape 1). */
export type OnboardingStep = "race" | "name" | "confirm";

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  "race",
  "name",
  "confirm",
];

/** Index 1-based de l'étape (pour l'affichage "Étape X / 3"). */
export function stepIndex(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step) + 1;
}
