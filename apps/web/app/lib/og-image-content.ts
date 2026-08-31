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

import type { TeamOgLogo } from "./og-team-logo";
import { OG_SUBTITLE_MAX, truncateOnWordBoundary } from "./roster-share-text";

export type OgAccent =
  | "team"
  | "star"
  | "skill"
  | "match"
  | "gazette"
  /** Carte par defaut du site (accueil, pages sans image dediee). */
  | "brand";

export interface OgContent {
  /** Titre principal affiche en grand. */
  title: string;
  /** Sous-titre / accroche secondaire. */
  subtitle: string;
  /** Pillules / badges de contexte (chiffres cles). */
  badges: string[];
  /** Identifiant de palette accent ("team" / "star" / "skill"). */
  accent: OgAccent;
  /**
   * Logo affiche a droite de la carte, dans une boite CARREE. Une image y
   * est posee en `objectFit: contain` : ses proportions d'origine sont donc
   * preservees, quelles qu'elles soient. Absent => carte texte seul
   * (comportement historique). Voir `og-team-logo.ts` pour la resolution
   * (logo uploade ou embleme du roster).
   */
  logo?: TeamOgLogo;
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

/**
 * Sprint O (Lot O.D) — entrees pour generer les OG images des pages
 * Pro League : matchs et editions Gazette.
 */
export interface ProLeagueMatchOgInput {
  /** Nom court de la home team (ex: "Snow Ogres"). */
  homeName: string;
  /** Nom court de l'away team. */
  awayName: string;
  /** Race / city pour ligne secondaire (ex: "Buffalo · Ogre"). */
  homeMeta?: string;
  awayMeta?: string;
  /** Score si match completed/in-progress. Null si scheduled. */
  scoreHome: number | null;
  scoreAway: number | null;
  /** Numero de la journee (ex: 5). */
  roundNumber: number;
  /** "scheduled" | "in_progress" | "completed" | "failed". */
  status: string;
}

export interface ProLeagueGazetteOgInput {
  /** Date editions au format ISO (YYYY-MM-DD). */
  date: string;
  /** Titre du premier article. */
  headline: string;
  /** Persona generation (ex: "Cynic", "Orc Enthusiast", "Statistician"). */
  persona?: string;
  /** Nombre d'articles dans l'edition. */
  articleCount: number;
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

export interface RosterShareOgInput {
  teamName: string;
  raceName: string;
  /** Valeur d'équipe en pièces d'or. */
  teamValue: number;
  playerCount: number;
  starPlayerNames: string[];
  ruleset: "season_2" | "season_3" | string;
  /**
   * Fluff saisi par le coach (`Team.description`). Quand il existe, il
   * prend la place du sous-titre « Avec <Star Players> » : le texte du
   * coach dit mieux ce qu'est son équipe qu'une liste de mercenaires.
   */
  description?: string | null;
  /** Logo resolu par `resolveTeamOgLogo`. */
  logo?: TeamOgLogo;
}

export function buildRosterShareOgContent(input: RosterShareOgInput): OgContent {
  const players = clampNonNegative(input.playerCount);
  const stars = input.starPlayerNames.filter(Boolean).slice(0, 2);
  const own = input.description?.trim();
  const subtitle = own
    ? truncateOnWordBoundary(own, OG_SUBTITLE_MAX)
    : stars.length
      ? `Avec ${stars.join(", ")}`
      : "Équipe Blood Bowl";
  return {
    title: input.teamName,
    subtitle,
    badges: [
      input.raceName,
      `VE ${formatBudget(input.teamValue)}${NBSP}po`,
      `${players}${NBSP}joueurs`,
      formatRuleset(input.ruleset),
    ],
    accent: "team",
    ...(input.logo ? { logo: input.logo } : {}),
  };
}

export interface SiteOgInput {
  /** Logo du site, resolu par l'appelant (data URI ou URL absolue). */
  logoUrl?: string;
}


/**
 * Carte par defaut du site — celle que reçoivent l'accueil et toutes les
 * pages sans image dediee.
 *
 * Elle remplace l'ancien `og:image = /images/logo.png`, qui declarait
 * 1200x630 pour un fichier CARRE de 1024x1024 : les scrapers etiraient
 * donc le logo dans la boite 1,91:1 annoncee. Ici les dimensions sont
 * celles reellement generees, et le logo est pose en `contain`.
 */
export function buildSiteOgContent(input: SiteOgInput = {}): OgContent {
  return {
    title: "Nuffle Arena",
    subtitle: "Gestionnaire d'équipes Blood Bowl — Saison 3 (2025)",
    badges: [
      "31 rosters officiels",
      "60+ Star Players",
      "130+ compétences",
      "100 % gratuit",
    ],
    accent: "brand",
    ...(input.logoUrl ? { logo: { kind: "image" as const, src: input.logoUrl } } : {}),
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

/**
 * Sprint O (Lot O.D) — OG image pour un match Pro League. Affiche
 * "Home vs Away" en gros, score si disponible, journee + status.
 */
export function buildProLeagueMatchOgContent(
  input: ProLeagueMatchOgInput,
): OgContent {
  const hasScore =
    input.scoreHome !== null && input.scoreAway !== null;
  const scorePart = hasScore
    ? `${input.scoreHome}${NBSP}–${NBSP}${input.scoreAway}`
    : "vs";
  const title = `${input.homeName} ${scorePart} ${input.awayName}`;

  const statusLabel = (() => {
    switch (input.status) {
      case "completed":
        return "Terminé";
      case "in_progress":
        return "EN DIRECT";
      case "scheduled":
        return "À venir";
      case "ready":
        return "Prêt";
      default:
        return input.status;
    }
  })();

  const badges: string[] = [`R${input.roundNumber}`, statusLabel];
  if (input.homeMeta) badges.push(input.homeMeta);
  if (input.awayMeta) badges.push(input.awayMeta);

  return {
    title,
    subtitle: "Pro League · Old World League — Nuffle Arena",
    badges,
    accent: "match",
  };
}

/**
 * Sprint O (Lot O.D) — OG image pour une edition de la Gazette.
 */
export function buildProLeagueGazetteOgContent(
  input: ProLeagueGazetteOgInput,
): OgContent {
  const niceDate = formatGazetteDate(input.date);
  const badges: string[] = [niceDate, `${input.articleCount} articles`];
  if (input.persona) badges.push(input.persona);
  return {
    title: input.headline,
    subtitle: `Nuffle Gazette · ${niceDate}`,
    badges,
    accent: "gazette",
  };
}

function formatGazetteDate(iso: string): string {
  // Tolerant ISO YYYY-MM-DD.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}
