/**
 * Règles pures de l'allocateur d'améliorations « au build ».
 *
 * Le builder laisse dépenser un pool de PSP en compétences AVANT la création
 * de l'équipe. Ce module concentre tout ce qui se raisonne sans React, pour
 * que l'UI ne fasse qu'afficher — et pour que les règles soient testables :
 *
 *  - accès Principale/Secondaire de la position (CSV « G,A,S » ; alias F→S) ;
 *  - compétences déjà possédées par le poste (interdites) ;
 *  - doublon sur un même joueur (interdit) ;
 *  - compétences retirées de la sélection (`excludedFromSelection`) ;
 *  - barème PSP : standard BB2025 (6/8 principale, 10/12 secondaire) ou celui
 *    du **règlement de tournoi** quand il y en a un, surcoût Élite compris ;
 *  - surcoût de Valeur d'Équipe (+20k / +40k, +10k de plus si Élite) ;
 *  - quota de joueurs autorisés à cumuler 2 compétences (règlement).
 *
 * Le serveur re-valide tout (`validateTournamentSkillPlan`,
 * `applyCupBuildAdvancements`) : ces règles sont là pour que l'UI n'offre
 * jamais un choix qui serait refusé.
 */

import {
  ELITE_SKILL_SURCHARGE,
  SURCHARGE_PER_ADVANCEMENT,
  maxTwoSkillPlayers,
  tournamentSkillCost,
  type TournamentRosterRules,
  type TournamentRulesetDefinition,
} from "@bb/game-engine";

/** Type d'amélioration achetable au build (les 2 seuls types autorisés). */
export type BuildAdvancementType = "primary" | "secondary";

export interface BuildAdvancement {
  positionSlug: string;
  ordinal: number;
  type: BuildAdvancementType;
  skillSlug: string;
}

/** Compétence du catalogue `/api/skills`. */
export interface SkillCatalogItem {
  slug: string;
  nameFr: string;
  nameEn?: string;
  category: string;
  description?: string;
  descriptionEn?: string;
  /** Compétence Élite : +10 000 po de Valeur d'Équipe en plus. */
  isElite?: boolean;
  /** Valide si déjà possédée, mais non sélectionnable en nouveauté. */
  excludedFromSelection?: boolean;
}

/** Poste du roster, tel que servi par `/api/rosters`. */
export interface AllocatorPosition {
  slug: string;
  displayName: string;
  /** Compétences de départ du poste (CSV de slugs). */
  skills?: string | null;
  primarySkills?: string | null;
  secondarySkills?: string | null;
}

/** E10 — 2 améliorations maximum par joueur au build. */
export const MAX_ADVANCEMENTS_PER_PLAYER = 2;

/** Nom de catégorie du catalogue → code canonique BB. */
export const CATEGORY_CODE: Readonly<Record<string, string>> = {
  General: "G",
  Agility: "A",
  Strength: "S",
  Passing: "P",
  Mutation: "M",
  "Scélérates": "K",
};

/** Code catégorie → libellé affiché. */
export const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  G: "Générales",
  A: "Agilité",
  S: "Force",
  P: "Passe",
  M: "Mutation",
  K: "Scélérates",
};

/** Ordre canonique d'affichage des catégories. */
export const CATEGORY_ORDER = ["G", "A", "S", "P", "M", "K"] as const;

/** Barème BB2025 standard : coût des 2 premiers paliers, par type. */
const STANDARD_TIER_COSTS: Readonly<
  Record<BuildAdvancementType, readonly [number, number]>
> = {
  primary: [6, 8],
  secondary: [10, 12],
};

/**
 * Parse un CSV/chaîne d'accès (« G,S », « GS ») en codes de catégorie.
 * `F` (Force en français) est un alias de `S`.
 */
export function parseAccessCodes(raw: string | null | undefined): Set<string> {
  const out = new Set<string>();
  if (!raw) return out;
  for (const ch of raw.toUpperCase()) {
    if (ch === "F") out.add("S");
    else if ("GASPMK".includes(ch)) out.add(ch);
  }
  return out;
}

/** Parse un CSV de slugs de compétences (compétences de base d'un poste). */
export function parseSkillSlugs(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\s]+/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Contexte de coût : règlement de tournoi éventuel. */
export interface BuildCostContext {
  /** Règlement de tournoi retenu (null = barème BB standard). */
  readonly pack?: TournamentRulesetDefinition | null;
  /** Règles du règlement pour CE roster (quota de cumul). */
  readonly packRules?: TournamentRosterRules | null;
}

/**
 * Coût en PSP de la (slot+1)-ième compétence d'un joueur. Avec un règlement,
 * on applique STRICTEMENT le même barème que le serveur
 * (`tournamentSkillCost`), surcoût Élite du règlement compris.
 */
export function skillSppCost(
  slot: number,
  type: BuildAdvancementType,
  skillSlug: string | undefined,
  ctx: BuildCostContext = {},
): number {
  const taken = Math.max(0, slot);
  if (ctx.pack) return tournamentSkillCost(ctx.pack, taken, type, skillSlug);
  return STANDARD_TIER_COSTS[type][Math.min(taken, 1)];
}

/**
 * La compétence est-elle Élite **au sens du barème PSP** ? Seul un règlement
 * de tournoi fait payer l'Élite en PSP, et uniquement pour les compétences
 * qu'il désigne (`pack.eliteSkills`). En jeu standard, l'Élite se paie en
 * Valeur d'Équipe (cf. `veSurchargeFor`).
 */
export function hasPackEliteSurcharge(
  skillSlug: string | undefined,
  ctx: BuildCostContext = {},
): boolean {
  if (!ctx.pack || !skillSlug) return false;
  return ctx.pack.eliteSkills.includes(skillSlug);
}

/** Surcoût PSP Élite du règlement (0 hors règlement / hors liste). */
export function packEliteSurcharge(ctx: BuildCostContext = {}): number {
  return ctx.pack?.skillCosts.eliteSurcharge ?? 0;
}

/**
 * Surcoût de Valeur d'Équipe (po) d'une compétence achetée : +20 000 en
 * Principale, +40 000 en Secondaire, plus 10 000 si la compétence est Élite.
 */
export function veSurchargeFor(
  type: BuildAdvancementType,
  isElite: boolean,
): number {
  return SURCHARGE_PER_ADVANCEMENT[type] + (isElite ? ELITE_SKILL_SURCHARGE : 0);
}

/** Clé stable d'une instance de joueur (poste + rang). */
export function playerKey(positionSlug: string, ordinal: number): string {
  return `${positionSlug}#${ordinal}`;
}

/** Améliorations d'une instance, dans l'ordre d'achat. */
export function advancementsFor(
  value: readonly BuildAdvancement[],
  positionSlug: string,
  ordinal: number,
): BuildAdvancement[] {
  return value.filter(
    (a) => a.positionSlug === positionSlug && a.ordinal === ordinal,
  );
}

/** Coût PSP total d'un plan (barème croissant par joueur). */
export function planSppTotal(
  value: readonly BuildAdvancement[],
  ctx: BuildCostContext = {},
): number {
  const taken = new Map<string, number>();
  let total = 0;
  for (const adv of value) {
    const key = playerKey(adv.positionSlug, adv.ordinal);
    const slot = taken.get(key) ?? 0;
    total += skillSppCost(slot, adv.type, adv.skillSlug, ctx);
    taken.set(key, slot + 1);
  }
  return total;
}

/** Surcoût de Valeur d'Équipe (po) de l'ensemble du plan. */
export function planVeSurcharge(
  value: readonly BuildAdvancement[],
  eliteSlugs: ReadonlySet<string>,
): number {
  return value.reduce(
    (sum, a) => sum + veSurchargeFor(a.type, eliteSlugs.has(a.skillSlug)),
    0,
  );
}

/**
 * Nombre de joueurs cumulant 2 compétences, et plafond imposé par le
 * règlement. `max` vaut `Infinity` hors règlement (règles standard : le seul
 * plafond est `MAX_ADVANCEMENTS_PER_PLAYER` par joueur).
 */
export function stackingUsage(
  value: readonly BuildAdvancement[],
  ctx: BuildCostContext = {},
): { used: number; max: number } {
  const perPlayer = new Map<string, number>();
  for (const adv of value) {
    const key = playerKey(adv.positionSlug, adv.ordinal);
    perPlayer.set(key, (perPlayer.get(key) ?? 0) + 1);
  }
  const used = [...perPlayer.values()].filter((n) => n >= 2).length;
  const max =
    ctx.pack && ctx.packRules
      ? maxTwoSkillPlayers(ctx.packRules.skillStacking)
      : Number.POSITIVE_INFINITY;
  return { used, max };
}

/** Raison pour laquelle une compétence n'est pas sélectionnable. */
export type SkillBlockReason = "owned" | "picked" | "excluded";

/** Une compétence proposée dans le sélecteur, avec son statut. */
export interface SkillOption {
  readonly skill: SkillCatalogItem;
  /** Code de catégorie canonique (G/A/S/P/M/K). */
  readonly category: string;
  /** Coût PSP de cette compétence sur ce slot (surcoût Élite compris). */
  readonly cost: number;
  /** Compétence Élite au catalogue (+10 000 po de VE). */
  readonly isElite: boolean;
  /** `null` = sélectionnable. */
  readonly blocked: SkillBlockReason | null;
}

export interface SkillOptionsInput {
  readonly catalog: readonly SkillCatalogItem[];
  readonly position: AllocatorPosition;
  readonly type: BuildAdvancementType;
  /** Rang de la compétence achetée (0 = 1re, 1 = 2e). */
  readonly slot: number;
  /** Compétences déjà choisies pour CE joueur (autres slots). */
  readonly pickedSlugs: readonly string[];
  readonly ctx?: BuildCostContext;
}

/**
 * Compétences proposables pour un joueur, dans la catégorie d'accès du type
 * demandé. Les compétences déjà possédées par le poste, déjà choisies sur ce
 * joueur ou retirées de la sélection sont RENVOYÉES mais marquées `blocked` :
 * l'UI les affiche grisées avec la raison, plutôt que de les faire
 * disparaître sans explication.
 */
export function skillOptionsFor({
  catalog,
  position,
  type,
  slot,
  pickedSlugs,
  ctx = {},
}: SkillOptionsInput): SkillOption[] {
  const access = parseAccessCodes(
    type === "primary" ? position.primarySkills : position.secondarySkills,
  );
  const owned = new Set(parseSkillSlugs(position.skills));
  const picked = new Set(pickedSlugs.filter((s) => s.length > 0));

  const seen = new Set<string>();
  const out: SkillOption[] = [];
  for (const skill of catalog) {
    const code = CATEGORY_CODE[skill.category];
    if (!code) continue;
    // Accès non renseigné (ex. Saison 2) : toutes les catégories ouvertes.
    if (access.size > 0 && !access.has(code)) continue;
    if (seen.has(skill.slug)) continue;
    seen.add(skill.slug);

    const blocked: SkillBlockReason | null = owned.has(skill.slug)
      ? "owned"
      : picked.has(skill.slug)
        ? "picked"
        : skill.excludedFromSelection
          ? "excluded"
          : null;

    out.push({
      skill,
      category: code,
      cost: skillSppCost(slot, type, skill.slug, ctx),
      isElite: Boolean(skill.isElite),
      blocked,
    });
  }
  return out.sort((a, b) => a.skill.nameFr.localeCompare(b.skill.nameFr, "fr"));
}

/** Filtre de recherche plein texte (nom FR/EN + slug), insensible à la casse. */
export function matchesSearch(option: SkillOption, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    option.skill.nameFr,
    option.skill.nameEn ?? "",
    option.skill.slug,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

/** Groupe des options par catégorie, dans l'ordre canonique. */
export function groupByCategory(
  options: readonly SkillOption[],
): Array<{ code: string; label: string; options: SkillOption[] }> {
  const groups = new Map<string, SkillOption[]>();
  for (const option of options) {
    const list = groups.get(option.category);
    if (list) list.push(option);
    else groups.set(option.category, [option]);
  }
  return CATEGORY_ORDER.filter((code) => groups.has(code)).map((code) => ({
    code,
    label: CATEGORY_LABELS[code],
    options: groups.get(code) as SkillOption[],
  }));
}
