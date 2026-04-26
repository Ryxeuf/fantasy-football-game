/**
 * Pure builders for Open Graph image content (Q.14 — Sprint 23).
 *
 * Avant Q.14 : toutes les pages exposaient `og:image = logo.png`
 * (image statique). Avec Q.14 : chaque page profonde (teams, star
 * players, skills) genere son propre OG contextualise via
 * Next.js `ImageResponse` (satori).
 *
 * Architecture en 2 niveaux :
 *   1. ce fichier : builders purs sans dependance React/satori,
 *      100 % testables (validation du contenu / des badges sans
 *      generer de PNG)
 *   2. og-image-template.tsx : template visuel React rendu par
 *      ImageResponse (uniquement flexbox, pas de grid : satori ne
 *      supporte pas grid)
 */

export type OgAccent = "team" | "star" | "skill";

export interface OgContent {
  /** Titre principal affiche en grand. */
  title: string;
  /** Sous-titre / accroche secondaire. */
  subtitle: string;
  /** Pillules / badges de contexte (chiffres cles). */
  badges: string[];
  /** Identifiant de palette accent ("team" / "star" / "skill"). */
  accent: OgAccent;
}

export interface TeamOgInput {
  name: string;
  tier?: string;
  budget: number;
  positionCount: number;
  ruleset: "season_2" | "season_3" | string;
}

export interface StarPlayerOgInput {
  displayName: string;
  cost: number;
  ma: number;
  st: number;
  ag: number;
  pa: number | null;
  av: number;
  isMegaStar?: boolean;
}

export interface SkillsOgInput {
  skillCount: number;
}

const NBSP = " ";

function clampNonNegative(value: number): number {
  return value < 0 ? 0 : Math.floor(value);
}

function formatBudget(value: number): string {
  // 1150000 -> "1 150 000" (format FR avec espaces fines)
  const v = clampNonNegative(value);
  return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

function formatRuleset(ruleset: string): string {
  if (ruleset === "season_3") return "Saison 3";
  if (ruleset === "season_2") return "Saison 2";
  return ruleset;
}

export function buildTeamOgContent(input: TeamOgInput): OgContent {
  const positions = clampNonNegative(input.positionCount);
  const tierLabel = input.tier ? `Tier ${input.tier}` : "Tier inconnu";
  return {
    title: input.name,
    subtitle: "Roster Blood Bowl",
    badges: [
      tierLabel,
      `Budget ${formatBudget(input.budget)}${NBSP}po`,
      `${positions}${NBSP}positions`,
      formatRuleset(input.ruleset),
    ],
    accent: "team",
  };
}

export function buildStarPlayerOgContent(input: StarPlayerOgInput): OgContent {
  const badges: string[] = [
    `MA ${input.ma}`,
    `ST ${input.st}`,
    `AG ${input.ag}+`,
  ];
  if (input.pa !== null && input.pa !== undefined) {
    badges.push(`PA ${input.pa}+`);
  }
  badges.push(`AV ${input.av}+`);
  badges.push(`Cost ${formatBudget(input.cost)}${NBSP}po`);

  const subtitle = input.isMegaStar
    ? "MEGA STAR — Star Player Blood Bowl"
    : "Star Player Blood Bowl";

  return {
    title: input.displayName,
    subtitle,
    badges,
    accent: "star",
  };
}

export function buildSkillsOgContent(input: SkillsOgInput): OgContent {
  const count = clampNonNegative(input.skillCount);
  return {
    title: "Compétences Blood Bowl",
    subtitle: "Catalogue complet FR / EN",
    badges: [
      `${count} compétences`,
      "Général · Agilité · Force",
      "Passe · Mutations · Traits",
    ],
    accent: "skill",
  };
}
