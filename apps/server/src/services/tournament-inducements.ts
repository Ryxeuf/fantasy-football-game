/**
 * Coups de pouce sous RÈGLEMENT DE TOURNOI.
 *
 * Un règlement publie une liste FERMÉE de coups de pouce avec ses propres
 * prix et quantités : le NAF World Cup 2027 vend la Mascotte 25 000 po, les
 * Fûts de Bloodweiser 50 000 (2 max) et les Pots-de-vin 100 000, et rien
 * d'autre. Le catalogue du moteur, lui, sert les prix officiels BB2025.
 *
 * Sans cette résolution, une ligue ou une coupe jouée sous règlement
 * proposait tout le catalogue, aux prix du livre : la feuille de match ne
 * reflétait pas le tournoi joué.
 *
 * 100 % pur ⇒ testable en unit (`tournament-inducements.test.ts`).
 */

import type { TournamentRulesetDefinition } from "@bb/game-engine";

/** Forme minimale d'une option de coup de pouce (cf. `league-match-sheet`). */
export interface InducementOptionLike {
  readonly slug: string;
  readonly name: string;
  readonly cost: number;
  readonly maxQuantity: number;
  readonly description: string;
  readonly variableCost?: boolean;
}

/** Star Player : jamais filtré ici (dépend du roster et des Ligues). */
const STAR_PLAYER_SLUG = "star_player";

/**
 * Slugs réellement achetables : liste fermée du règlement quand il y en a un,
 * intersectée avec l'allowlist de la ligue si elle en pose une. `null` =
 * aucune restriction (comportement historique).
 */
export function effectiveInducementAllowlist(
  leagueAllowlist: readonly string[] | null,
  pack: TournamentRulesetDefinition | null,
): string[] | null {
  const packSlugs = pack
    ? pack.allowedInducements.map((rule) => rule.slug)
    : null;
  if (!packSlugs) return leagueAllowlist ? [...leagueAllowlist] : null;
  if (!leagueAllowlist) return packSlugs;
  const league = new Set(leagueAllowlist);
  return packSlugs.filter((slug) => league.has(slug));
}

/**
 * Liste de coups de pouce d'une compétition, RÉSOLUE : ce qui se vend, et ce
 * que la compétition AJOUTE au règlement (vendu au prix du catalogue).
 */
export interface CompetitionInducementList {
  /** Slugs vendus (`null` = tout le catalogue accessible au roster). */
  readonly allowed: readonly string[] | null;
  /** Slugs hors règlement que la compétition autorise : prix du catalogue. */
  readonly extras: readonly string[];
}

/** Garde de type : une résolution, pas une allowlist brute (tableau). */
export function isCompetitionInducementList(
  value: unknown,
): value is CompetitionInducementList {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "allowed" in value &&
    "extras" in value
  );
}

/**
 * COUPE — la liste du commissaire FAIT FOI, règlement compris :
 *  - `null` : liste par défaut, celle du règlement, sinon tout le catalogue ;
 *  - `[...]` : exactement ces coups de pouce. Sous règlement, ceux qu'il ne
 *    liste pas sont des AJOUTS, vendus au prix du catalogue ;
 *  - `[]` : aucun coup de pouce.
 *
 * Les ligues gardent l'intersection d'`effectiveInducementAllowlist` : leur
 * liste ne fait que restreindre celle du règlement.
 */
export function resolveCupInducementList(
  cupList: readonly string[] | null,
  pack: TournamentRulesetDefinition | null,
): CompetitionInducementList {
  const packSlugs = pack
    ? pack.allowedInducements.map((rule) => rule.slug)
    : null;
  if (cupList === null) return { allowed: packSlugs, extras: [] };
  const allowed = cupList.filter((slug) => slug !== STAR_PLAYER_SLUG);
  const inPack = new Set(packSlugs ?? []);
  const extras = packSlugs ? allowed.filter((slug) => !inPack.has(slug)) : [];
  return { allowed, extras };
}

/** LIGUE — l'intersection historique, sous la forme d'une résolution. */
export function resolveLeagueInducementList(
  leagueAllowlist: readonly string[] | null,
  pack: TournamentRulesetDefinition | null,
): CompetitionInducementList {
  return {
    allowed: effectiveInducementAllowlist(leagueAllowlist, pack),
    extras: [],
  };
}

/**
 * Ce que le règlement doit savoir de l'équipe pour fixer prix et plafonds.
 * Absent = équipe sans remise ni Star Player à Arme Secrète.
 */
export interface PackTeamContext {
  /**
   * L'équipe a-t-elle droit à la remise que le CATALOGUE attache à ce coup
   * de pouce (cf. `qualifiesForInducementDiscount`) ? Le règlement en fixe
   * le montant, jamais les bénéficiaires.
   */
  readonly qualifiesForDiscount?: (slug: string) => boolean;
  /** L'équipe recrute-t-elle un Star Player portant Arme Secrète ? */
  readonly hasSecretWeaponStar?: boolean;
}

/** Compétence « Arme Secrète » (slug du catalogue de compétences). */
export const SECRET_WEAPON_SKILL = "secret-weapon";

/** Un Star Player porte-t-il Arme Secrète (CSV de slugs de compétences) ? */
export function hasSecretWeapon(skillsCsv: string | null | undefined): boolean {
  return (skillsCsv ?? "")
    .split(",")
    .map((s) => s.trim())
    .includes(SECRET_WEAPON_SKILL);
}

/**
 * Applique les prix, quantités et précisions du règlement aux options du
 * catalogue. Une option absente de la liste du règlement est RETIRÉE (liste
 * fermée), sauf si la compétition l'AJOUTE (`extras`, coupe) : elle est alors
 * servie au prix et au plafond du catalogue. Les Star Players sont laissés
 * tels quels.
 *
 * Prix : celui du règlement, ou son prix réduit pour une équipe qui a droit
 * à la remise du catalogue. Plafond : celui du règlement, sinon celui de
 * l'option (catalogue, déjà ajusté par les règles spéciales — 6 Pots-de-vin
 * pour Chantage et Corruption), abaissé au plafond « Arme Secrète » quand
 * l'équipe recrute un tel Star Player.
 */
export function applyPackInducementRules(
  options: readonly InducementOptionLike[],
  pack: TournamentRulesetDefinition | null,
  team: PackTeamContext = {},
  extras: readonly string[] = [],
): InducementOptionLike[] {
  if (!pack) return [...options];
  const bySlug = new Map(
    pack.allowedInducements.map((rule) => [rule.slug, rule]),
  );
  const added = new Set(extras);
  const out: InducementOptionLike[] = [];
  for (const option of options) {
    if (option.slug === STAR_PLAYER_SLUG) {
      out.push(option);
      continue;
    }
    const rule = bySlug.get(option.slug);
    if (!rule) {
      if (added.has(option.slug)) out.push(option);
      continue;
    }
    const discounted =
      rule.discountCost !== undefined &&
      (team.qualifiesForDiscount?.(option.slug) ?? false);
    const baseMax = rule.max ?? option.maxQuantity;
    const maxQuantity =
      team.hasSecretWeaponStar && rule.maxWithSecretWeaponStar !== undefined
        ? Math.min(baseMax, rule.maxWithSecretWeaponStar)
        : baseMax;
    out.push({
      ...option,
      cost: discounted ? (rule.discountCost as number) : rule.cost,
      maxQuantity,
      // La précision du règlement (coût réduit conditionnel, restriction de
      // roster) complète la description officielle, elle ne la remplace pas.
      description: rule.noteFr
        ? `${option.description} — ${pack.shortLabel} : ${rule.noteFr}`
        : option.description,
    });
  }
  return out;
}
