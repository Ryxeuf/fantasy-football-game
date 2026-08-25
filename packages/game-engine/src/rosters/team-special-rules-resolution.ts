/**
 * Règles spéciales EFFECTIVES d'une équipe (roster + Ligue régionale choisie).
 *
 * Les règles spéciales d'une équipe viennent de deux sources :
 *  - le roster lui-même (`Roster.specialRules` en base, `specialRules` dans le
 *    catalogue du moteur) : Bagarreurs Brutaux, Capitaine, Déferlement… ;
 *  - la **Ligue régionale retenue à la création**, pour les alignements
 *    « Favori de… » (`favoured_of_*`). Les Nordiques, par exemple, ne sont
 *    Favoris de Khorne que s'ils rejoignent le Clash du Chaos
 *    (`CONDITIONAL_GRANTS` dans `regional-league-choice.ts`).
 *
 * Le bug corrigé ici : la fiche d'équipe n'affichait que la 1re source. Une
 * équipe Nordique inscrite au Clash du Chaos annonçait donc « Aucune » règle
 * spéciale alors que son alignement Favori de Khorne conditionne, lui, le
 * recrutement de Star Players.
 *
 * 100 % pur ⇒ testable en unit (`team-special-rules-resolution.test.ts`).
 */

import { DEFAULT_RULESET, type Ruleset } from "./positions";
import { resolveTeamRegionalRules } from "./regional-league-choice";
import {
  TEAM_SPECIAL_RULES_BY_SLUG,
  getSpecialRulesForTeam,
} from "./team-special-rules";

/** Slug de la règle spéciale « Favori de… » dans `TEAM_SPECIAL_RULES`. */
export const FAVOURED_OF_RULE_SLUG = "favori_de";

/** Préfixe des règles régionales d'alignement chaotique. */
const FAVOURED_OF_PREFIX = "favoured_of";

/**
 * Dieux du Chaos adressables par un alignement `favoured_of_*`. Le slug nu
 * (`favoured_of`, sans dieu) désigne l'alignement générique « Chaos
 * Universel » du livre.
 */
const CHAOS_GODS: Readonly<Record<string, { fr: string; en: string }>> = {
  "": { fr: "Chaos Universel", en: "Universal Chaos" },
  hashut: { fr: "Hashut", en: "Hashut" },
  khorne: { fr: "Khorne", en: "Khorne" },
  nurgle: { fr: "Nurgle", en: "Nurgle" },
  slaanesh: { fr: "Slaanesh", en: "Slaanesh" },
  tzeentch: { fr: "Tzeentch", en: "Tzeentch" },
};

/** Le slug désigne-t-il un alignement « Favori de… » ? */
export function isFavouredOfSlug(slug: string): boolean {
  return slug === FAVOURED_OF_PREFIX || slug.startsWith(`${FAVOURED_OF_PREFIX}_`);
}

/**
 * Libellé complet d'un alignement (« Favori de Khorne » / « Favoured of
 * Khorne »). Un dieu inconnu retombe sur son suffixe capitalisé plutôt que
 * sur le slug brut.
 */
export function favouredOfLabel(slug: string, isEnglish = false): string {
  const god = slug.slice(FAVOURED_OF_PREFIX.length).replace(/^_/, "");
  const known = CHAOS_GODS[god];
  const name = known
    ? isEnglish
      ? known.en
      : known.fr
    : god.charAt(0).toUpperCase() + god.slice(1);
  return isEnglish ? `Favoured of ${name}` : `Favori de ${name}`;
}

/** Une règle spéciale effective, avec son alignement quand il y en a un. */
export interface ResolvedTeamSpecialRule {
  /** Slug du catalogue `TEAM_SPECIAL_RULES`. */
  readonly slug: string;
  /**
   * Slug de l'alignement (`favoured_of_khorne`…) quand `slug` vaut
   * `favori_de`. Absent sinon.
   */
  readonly alignment?: string;
}

export interface ResolveTeamSpecialRulesInput {
  readonly rosterSlug: string;
  readonly ruleset?: Ruleset;
  /** Ligue régionale CHOISIE par l'équipe (`Team.regionalLeague`). */
  readonly regionalLeague?: string | null;
  /**
   * Règles spéciales déclarées par le roster (`Roster.specialRules`, CSV ou
   * liste). Absent ⇒ catalogue du moteur.
   */
  readonly rosterSpecialRules?: string | readonly string[] | null;
  /** Ligues déclarées par le roster (`Roster.regionalRules`). */
  readonly declaredRegionalRules?: readonly string[] | null;
}

/** Découpe une valeur CSV/liste en slugs propres. */
function toSlugs(raw: string | readonly string[] | null | undefined): string[] {
  if (raw == null) return [];
  const parts = Array.isArray(raw) ? raw : String(raw).split(/[,\s]+/g);
  return parts.map((s) => String(s).trim()).filter((s) => s.length > 0);
}

/**
 * Règles spéciales effectives d'une équipe : celles du roster, plus
 * l'alignement « Favori de… » apporté par la Ligue régionale retenue.
 *
 * L'ordre suit le catalogue du roster ; « Favori de… » est ajouté en fin de
 * liste s'il n'y figurait pas déjà. Les slugs inconnus du catalogue (ex. la
 * sentinelle « NONE ») sont ignorés.
 */
export function resolveTeamSpecialRules({
  rosterSlug,
  ruleset = DEFAULT_RULESET,
  regionalLeague,
  rosterSpecialRules,
  declaredRegionalRules,
}: ResolveTeamSpecialRulesInput): ResolvedTeamSpecialRule[] {
  const declared =
    rosterSpecialRules == null
      ? getSpecialRulesForTeam(rosterSlug, ruleset)
      : toSlugs(rosterSpecialRules);

  const out: ResolvedTeamSpecialRule[] = [];
  const seen = new Set<string>();
  for (const slug of declared) {
    if (seen.has(slug)) continue;
    if (!TEAM_SPECIAL_RULES_BY_SLUG[slug]) continue;
    seen.add(slug);
    out.push({ slug });
  }

  // Alignement apporté par la Ligue retenue (Nordiques + Clash du Chaos ⇒
  // Favori de Khorne). Sans choix enregistré, `resolveTeamRegionalRules`
  // retombe sur l'union historique du roster — même repli que le
  // recrutement de Star Players, pour rester cohérent.
  const alignment = resolveTeamRegionalRules(
    rosterSlug,
    ruleset,
    regionalLeague ?? null,
    declaredRegionalRules,
  ).find(isFavouredOfSlug);

  if (!alignment) return out;

  const existing = out.findIndex((r) => r.slug === FAVOURED_OF_RULE_SLUG);
  if (existing >= 0) {
    out[existing] = { slug: FAVOURED_OF_RULE_SLUG, alignment };
    return out;
  }
  if (!TEAM_SPECIAL_RULES_BY_SLUG[FAVOURED_OF_RULE_SLUG]) return out;
  return [...out, { slug: FAVOURED_OF_RULE_SLUG, alignment }];
}
