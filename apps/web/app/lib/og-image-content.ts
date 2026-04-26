/**
 * Builders d'`OgImageContent` pour les Open Graph images dynamiques
 * (Q.14 — Sprint 23).
 *
 * Chaque page profonde appelle un builder pour transformer son entite
 * metier (roster, star player, etc.) en une structure stable consommee
 * par `ImageResponse` Next.js. La separation builder / renderer permet
 * de tester la couche pure sans depender de satori/wasm.
 */

export type OgCategory = "team" | "star-player" | "skills";

export interface OgImageContent {
  title: string;
  subtitle: string;
  /** Liste de badges courts a afficher en bas (max 5 conseille). */
  badges: string[];
  category: OgCategory;
  /** Couleur d'accent (hex) pour l'arriere-plan / les badges. */
  accent: string;
}

const ACCENT_BY_CATEGORY: Record<OgCategory, string> = {
  team: "#7C2D12", // bordeaux
  "star-player": "#B45309", // doré
  skills: "#1E3A8A", // bleu nuit
};

export interface TeamRosterInput {
  name: string;
  tier?: string;
  budget?: number;
  positions: Array<{ slug: string }>;
}

export function buildTeamOgContent(roster: TeamRosterInput): OgImageContent {
  const badges: string[] = [];
  if (roster.tier) badges.push(`Tier ${roster.tier}`);
  if (typeof roster.budget === "number") {
    badges.push(`${roster.budget} kpo`);
  }
  badges.push(`${roster.positions.length} positions`);
  badges.push("Saison 3");
  return {
    title: roster.name,
    subtitle: "Roster Blood Bowl - Nuffle Arena",
    badges,
    category: "team",
    accent: ACCENT_BY_CATEGORY.team,
  };
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

export function buildStarPlayerOgContent(
  star: StarPlayerOgInput,
): OgImageContent {
  const badges: string[] = [
    `MA ${star.ma}`,
    `ST ${star.st}`,
    `AG ${star.ag}+`,
    `PA ${star.pa === null ? "-" : `${star.pa}+`}`,
    `AV ${star.av}+`,
    `${star.cost} kpo`,
  ];
  if (star.isMegaStar) {
    badges.unshift("MEGA STAR");
  }
  return {
    title: star.displayName,
    subtitle: "Star Player Blood Bowl - Nuffle Arena",
    badges,
    category: "star-player",
    accent: ACCENT_BY_CATEGORY["star-player"],
  };
}

export interface SkillsOgInput {
  skillCount: number;
}

export function buildSkillsOgContent(input: SkillsOgInput): OgImageContent {
  return {
    title: "Compétences Blood Bowl",
    subtitle: "Skills, Mutations & Traits - Nuffle Arena",
    badges: [
      `${input.skillCount} entries`,
      "General",
      "Agility / Strength / Passing",
      "Mutation",
      "Trait",
    ],
    category: "skills",
    accent: ACCENT_BY_CATEGORY.skills,
  };
}
