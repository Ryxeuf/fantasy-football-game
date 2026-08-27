/**
 * Catalogue des RÈGLES SPÉCIALES d'équipe et des LIGUES RÉGIONALES —
 * servi par la base (lot 6.5).
 *
 * Les deux tables (`TeamSpecialRule`, `RegionalLeague`) existaient depuis la
 * transcription Saison 3 mais n'étaient JAMAIS lues : tout le produit
 * (fiches de roster, fiche d'équipe, commissaire, création) affichait les
 * libellés compilés dans `@bb/game-engine`. Corriger une description en base
 * n'avait donc aucun effet visible.
 *
 * Même posture que `tournament-ruleset-repository` : la base fait foi, le
 * catalogue du moteur est le REPLI journalisé (table vide avant le premier
 * seed, base indisponible, miroir SQLite réduit) et la source du seed. Un
 * cache court évite de relire deux petites tables à chaque fiche servie.
 *
 * Le catalogue est un OBJET DE DONNÉES passé aux résolveurs purs : ceux-ci
 * restent synchrones et testables sans Prisma, seul l'appelant est
 * asynchrone.
 */

import {
  DEFAULT_RULESET,
  REGIONAL_LEAGUES,
  TEAM_SPECIAL_RULES,
  type Ruleset,
} from "@bb/game-engine";
import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";

/** Libellé localisable d'une règle spéciale ou d'une Ligue régionale. */
export interface RuleLabel {
  readonly slug: string;
  readonly nameFr: string;
  readonly nameEn: string;
  readonly description: string;
  readonly descriptionEn?: string;
}

/** Résolution slug → libellé, pour les deux catalogues. */
export interface TeamRulesCatalogue {
  specialRule(slug: string): RuleLabel | null;
  regionalLeague(slug: string): RuleLabel | null;
  /** Toutes les règles spéciales connues, ordre du catalogue. */
  listSpecialRules(): readonly RuleLabel[];
  /** Toutes les Ligues régionales connues, ordre du catalogue. */
  listRegionalLeagues(): readonly RuleLabel[];
}

function toCatalogue(
  specialRules: readonly RuleLabel[],
  regionalLeagues: readonly RuleLabel[],
): TeamRulesCatalogue {
  const bySpecial = new Map(specialRules.map((r) => [r.slug, r]));
  const byLeague = new Map(regionalLeagues.map((r) => [r.slug, r]));
  return {
    specialRule: (slug) => bySpecial.get(slug) ?? null,
    regionalLeague: (slug) => byLeague.get(slug) ?? null,
    listSpecialRules: () => specialRules,
    listRegionalLeagues: () => regionalLeagues,
  };
}

function normalize(row: {
  slug: string;
  nameFr: string;
  nameEn: string;
  description: string;
  descriptionEn?: string | null;
}): RuleLabel {
  return {
    slug: row.slug,
    nameFr: row.nameFr,
    nameEn: row.nameEn,
    description: row.description,
    ...(row.descriptionEn ? { descriptionEn: row.descriptionEn } : {}),
  };
}

/**
 * Repli COMPILÉ : le catalogue du moteur. Exporté pour les résolveurs purs
 * dont l'appelant n'a pas (encore) chargé la base — leur comportement reste
 * alors exactement celui d'avant le lot 6.
 */
export const ENGINE_TEAM_RULES_CATALOGUE: TeamRulesCatalogue = toCatalogue(
  TEAM_SPECIAL_RULES.map(normalize),
  REGIONAL_LEAGUES.map(normalize),
);

const TTL_MS = process.env.NODE_ENV === "production" ? 5 * 60 * 1000 : 0;

const cache = new Map<string, { value: TeamRulesCatalogue; expiresAt: number }>();

/** À appeler après toute écriture admin sur l'un des deux catalogues. */
export function invalidateTeamRulesCatalogueCache(): void {
  cache.clear();
}

/**
 * Fusionne base et catalogue compilé : une ligne en base PRIME sur son
 * homologue compilé, un slug absent de la base reste servi par le moteur.
 * On ne perd donc jamais une règle tant que le seed n'a pas tourné, et une
 * règle créée en admin est immédiatement affichée.
 */
function merge(
  fromDb: readonly RuleLabel[],
  fromEngine: readonly RuleLabel[],
): readonly RuleLabel[] {
  const out = new Map(fromEngine.map((r) => [r.slug, r]));
  for (const row of fromDb) out.set(row.slug, row);
  return [...out.values()];
}

const SELECT = {
  slug: true,
  nameFr: true,
  nameEn: true,
  description: true,
  descriptionEn: true,
} as const;

/**
 * Catalogue résolu pour une édition. Tolérant de bout en bout : toute
 * lecture en échec dégrade vers le catalogue compilé plutôt que de faire
 * tomber la fiche servie.
 */
export async function loadTeamRulesCatalogue(
  ruleset: Ruleset = DEFAULT_RULESET,
): Promise<TeamRulesCatalogue> {
  const cached = cache.get(ruleset);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let specialRules = ENGINE_TEAM_RULES_CATALOGUE.listSpecialRules();
  let regionalLeagues = ENGINE_TEAM_RULES_CATALOGUE.listRegionalLeagues();

  try {
    const [ruleRows, leagueRows] = await Promise.all([
      prisma.teamSpecialRule.findMany({
        where: { ruleset },
        select: SELECT,
        orderBy: { nameFr: "asc" },
      }),
      prisma.regionalLeague.findMany({
        where: { ruleset },
        select: SELECT,
        orderBy: { nameFr: "asc" },
      }),
    ]);
    if (Array.isArray(ruleRows) && ruleRows.length > 0) {
      specialRules = merge(ruleRows.map(normalize), specialRules);
    } else {
      serverLog.warn(
        `[team-rules] TeamSpecialRule vide pour ${ruleset} — repli catalogue compilé`,
      );
    }
    if (Array.isArray(leagueRows) && leagueRows.length > 0) {
      regionalLeagues = merge(leagueRows.map(normalize), regionalLeagues);
    } else {
      serverLog.warn(
        `[team-rules] RegionalLeague vide pour ${ruleset} — repli catalogue compilé`,
      );
    }
  } catch (e: unknown) {
    serverLog.error(
      `[team-rules] lecture en base impossible (${ruleset}) — repli catalogue compilé`,
      e,
    );
  }

  const value = toCatalogue(specialRules, regionalLeagues);
  cache.set(ruleset, { value, expiresAt: Date.now() + TTL_MS });
  return value;
}
