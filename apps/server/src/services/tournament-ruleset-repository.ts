/**
 * Accès aux règlements de tournoi : la BASE est la source de vérité, le
 * registre `@bb/game-engine` le repli.
 *
 * Même posture que `Roster.regionalRules` / `effectiveRegionalRules` : ce que
 * l'admin a saisi prime, mais l'application reste servie si la table est vide
 * (avant le premier seed), illisible, ou si une ligne porte un JSON devenu
 * invalide. Un règlement corrompu ne fait jamais tomber une création
 * d'équipe : on sert la version du moteur et on journalise.
 *
 * Le registre du moteur reste par ailleurs la référence des tests purs et le
 * point de départ du seed.
 */

import {
  TOURNAMENT_RULESETS,
  type TournamentRulesetDefinition,
} from "@bb/game-engine";
import { prisma } from "../prisma";
import { parseDefinition } from "../schemas/tournament-ruleset.schemas";
import { serverLog } from "../utils/server-log";

/** D'où vient la définition servie — exposé pour l'admin et les tests. */
export type TournamentRulesetSource = "db" | "engine";

export interface ResolvedTournamentRuleset {
  readonly slug: string;
  /** `false` = retiré des listes de création (les compétitions existantes gardent le leur). */
  readonly enabled: boolean;
  readonly definition: TournamentRulesetDefinition;
  readonly source: TournamentRulesetSource;
}

/**
 * Cache en process. Les règlements changent rarement (édition admin) et sont
 * lus à chaque création d'équipe / feuille de match. Hors production le TTL
 * est nul pour que les tests et les éditions locales se voient tout de suite.
 */
const TTL_MS = process.env.NODE_ENV === "production" ? 5 * 60 * 1000 : 0;

let cache: { value: ResolvedTournamentRuleset[]; expiresAt: number } | null =
  null;

/** À appeler après toute écriture admin. */
export function invalidateTournamentRulesetCache(): void {
  cache = null;
}

/** Définitions du registre du moteur, indexées par slug. */
function engineDefinitions(): Map<string, TournamentRulesetDefinition> {
  return new Map(Object.entries(TOURNAMENT_RULESETS));
}

/**
 * Toutes les définitions résolues (base d'abord, moteur en repli), y compris
 * les règlements désactivés. Résultat mis en cache.
 */
async function loadAll(): Promise<ResolvedTournamentRuleset[]> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  const fromEngine = engineDefinitions();
  const out = new Map<string, ResolvedTournamentRuleset>();

  try {
    const rows = (await prisma.tournamentRuleset.findMany({
      select: { slug: true, enabled: true, definition: true },
      orderBy: { slug: "asc" },
    })) as Array<{ slug: string; enabled: boolean; definition: unknown }>;

    for (const row of rows) {
      const parsed = parseDefinition(row.definition);
      if (!parsed.ok) {
        // Ligne corrompue : on ne la sert PAS. Le moteur prend le relais si
        // le slug y existe, sinon le règlement est simplement absent.
        serverLog.error(
          `[tournament-rulesets] définition invalide en base pour « ${row.slug} » : ` +
            parsed.issues
              .map((i) => `${i.path || "(racine)"} — ${i.message}`)
              .join(" ; "),
        );
        continue;
      }
      out.set(row.slug, {
        slug: row.slug,
        enabled: row.enabled,
        // Le slug de la ligne fait foi : pas de dérive possible entre la
        // colonne référencée par les équipes et le JSON.
        definition: { ...parsed.definition, slug: row.slug },
        source: "db",
      });
    }
  } catch (e: unknown) {
    // Table absente (avant migration) ou base indisponible : on sert le
    // registre du moteur plutôt que de casser la création d'équipe.
    serverLog.error("[tournament-rulesets] lecture en base impossible", e);
  }

  for (const [slug, definition] of fromEngine) {
    if (out.has(slug)) continue;
    out.set(slug, { slug, enabled: true, definition, source: "engine" });
  }

  const value = [...out.values()].sort((a, b) => a.slug.localeCompare(b.slug));
  cache = { value, expiresAt: Date.now() + TTL_MS };
  return value;
}

/**
 * Règlements proposables à la création. Les désactivés sont exclus par
 * défaut — ils restent résolvables par slug pour les équipes déjà créées.
 */
export async function listTournamentRulesets(
  options: { includeDisabled?: boolean } = {},
): Promise<ResolvedTournamentRuleset[]> {
  const all = await loadAll();
  return options.includeDisabled ? all : all.filter((r) => r.enabled);
}

/**
 * Définition d'un règlement, désactivé compris : une équipe créée sous un
 * règlement retiré des listes doit continuer à être validée avec.
 * `null` = slug inconnu.
 */
export async function getTournamentRulesetDefinition(
  slug: string | null | undefined,
): Promise<TournamentRulesetDefinition | null> {
  if (!slug) return null;
  const all = await loadAll();
  return all.find((r) => r.slug === slug)?.definition ?? null;
}

/** Le slug désigne-t-il un règlement connu (désactivé compris) ? */
export async function isKnownTournamentRuleset(slug: string): Promise<boolean> {
  return (await getTournamentRulesetDefinition(slug)) !== null;
}

/** Libellé court d'un règlement, repli sur le slug (affichage). */
export async function tournamentRulesetShortLabel(
  slug: string | null | undefined,
): Promise<string | null> {
  if (!slug) return null;
  const def = await getTournamentRulesetDefinition(slug);
  return def?.shortLabel ?? slug;
}
