/**
 * Onboarding "Crée ton équipe en 60 secondes" — logique pure.
 *
 * Tout ce qui est testable sans React vit ici : décision d'affichage,
 * sélection des rosters recommandés débutants, difficulté d'apprentissage
 * par roster, validation du nom, et la clé localStorage de skip.
 *
 * Aucune dépendance React / DOM ⇒ unit-testable sans jsdom.
 */

import {
  buildStaffCostPo,
  defaultBuildBudgetK,
  defaultStaffConfig,
  type BuildStaffSelection,
  type RosterStaffConfig,
} from "@bb/game-engine";

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
  /**
   * Ligues régionales ouvertes à ce roster, à trancher à la création.
   * Optionnel : rétro-compat avec un serveur antérieur au choix de Ligue.
   */
  readonly regionalLeagueOptions?: readonly OnboardingRegionalLeague[];
  /** Budget de construction BB11 du roster (kpo, `Roster.budget`). */
  readonly budget?: number;
  /** Config staff (coûts po + plafonds) par format, servie par la base. */
  readonly staffConfigs?: Partial<Record<"bb11" | "sevens", RosterStaffConfig>>;
}

/** Option de Ligue régionale telle que renvoyée par `/api/rosters`. */
export interface OnboardingRegionalLeague {
  readonly slug: string;
  readonly name: string;
  readonly grants?: readonly string[];
  readonly grantLabels?: readonly string[];
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

/** Les 4 étapes du wizard (intro implicite dans l'étape 1). */
export type OnboardingStep = "race" | "name" | "staff" | "confirm";

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  "race",
  "name",
  "staff",
  "confirm",
];

/** Index 1-based de l'étape (pour l'affichage "Étape X / 4"). */
export function stepIndex(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step) + 1;
}

/* ------------------------------------------------------------------ */
/* Étape « Staff » — relances, apothicaire, Fans Dévoués               */
/* ------------------------------------------------------------------ */

/** Format unique de l'assistant (création BB11). */
export const ONBOARDING_FORMAT = "bb11" as const;

/** Staff du roster : config servie par la base, sinon défaut du moteur. */
export function onboardingStaffConfig(roster: OnboardingRoster): RosterStaffConfig {
  return (
    roster.staffConfigs?.[ONBOARDING_FORMAT] ??
    defaultStaffConfig(roster.slug, ONBOARDING_FORMAT)
  );
}

/** Budget de construction (kpo) — celui que le serveur appliquera. */
export function onboardingBudgetK(roster: OnboardingRoster): number {
  return defaultBuildBudgetK(roster.budget, ONBOARDING_FORMAT);
}

export interface StaffBudgetInput {
  readonly selection: BuildStaffSelection;
  readonly staff: RosterStaffConfig;
  readonly budgetK: number;
  /** Coût de la composition de départ ; `null` = inconnu (positions non chargées). */
  readonly lineupCostK: number | null;
}

export interface StaffBudgetSummary {
  /** Coût du staff choisi (kpo). */
  readonly staffCostK: number;
  /** Budget restant après joueurs + staff (kpo) ; `null` si joueurs inconnus. */
  readonly remainingK: number | null;
  readonly overBudget: boolean;
}

/** Coût du staff et budget restant — même tarif que le serveur. */
export function summarizeStaffBudget(input: StaffBudgetInput): StaffBudgetSummary {
  const staffCostK = buildStaffCostPo(input.selection, input.staff) / 1000;
  if (input.lineupCostK === null) {
    return { staffCostK, remainingK: null, overBudget: false };
  }
  const remainingK = input.budgetK - input.lineupCostK - staffCostK;
  return { staffCostK, remainingK, overBudget: remainingK < 0 };
}

/**
 * Un ajout de staff (`next`) tient-il dans le budget ? Sans coût de joueurs
 * connu, on laisse faire : le serveur reste juge (refus « Budget dépassé »).
 */
export function staffFitsBudget(
  next: BuildStaffSelection,
  input: Omit<StaffBudgetInput, "selection">,
): boolean {
  return !summarizeStaffBudget({ ...input, selection: next }).overBudget;
}

/**
 * Champs de staff envoyés à `POST /team/create-from-roster`. Rien si le
 * coach n'a rien pris : la création reste exactement l'historique.
 */
export function staffRequestFields(
  selection: BuildStaffSelection,
): Partial<BuildStaffSelection> {
  const fields: Partial<BuildStaffSelection> = {
    ...(selection.dedicatedFans > 0 ? { dedicatedFans: selection.dedicatedFans } : {}),
    ...(selection.rerolls > 0 ? { rerolls: selection.rerolls } : {}),
    ...(selection.apothecary ? { apothecary: true } : {}),
  };
  return fields;
}
