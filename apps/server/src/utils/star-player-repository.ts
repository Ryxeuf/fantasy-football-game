import { prisma } from "../prisma";
import {
  getStarPlayerPairs,
  STAR_PLAYER_PAIR_PARTNERS,
  type Ruleset,
  type StarPlayerDefinition,
  type StarPlayerPair,
} from "@bb/game-engine";
import { serverLog } from "./server-log";

/**
 * Le schéma SQLite (utilisé en CI/E2E) n'incluait pas le modèle StarPlayer —
 * cf. `apps/server/prisma/sqlite/schema.prisma`. Accès défensif partagé avec
 * `routes/star-players.ts` pour ne jamais crasher si un environnement réduit
 * ne l'a pas (encore) généré.
 */
export function getStarPlayerModel(): any | null {
  const model = (prisma as unknown as { starPlayer?: any }).starPlayer;
  return model ?? null;
}

/**
 * Remap DB -> StarPlayerDefinition, identique au mapper `transformStarPlayer`
 * de `routes/star-players.ts` (garder les deux synchronisés). Contrairement à
 * cette route, pas de fallback statique sur `keywords` : le reseed complet a
 * peuplé la colonne pour toutes les lignes existantes, et cette validation
 * n'affiche/ne consomme pas ce champ (juste displayName/cost pour le
 * recrutement) — inutile de dépendre d'un lookup statique supplémentaire ici.
 */
function mapStarPlayerRowToDefinition(sp: any): StarPlayerDefinition {
  const pairWith = resolvePairPartnerSlug(sp);
  return {
    ...(pairWith ? { pairWith } : {}),
    slug: sp.slug,
    displayName: sp.displayName,
    cost: sp.cost,
    ma: sp.ma,
    st: sp.st,
    ag: sp.ag,
    pa: sp.pa,
    av: sp.av,
    skills: sp.skills.map((sps: any) => sps.skill.slug).join(","),
    hirableBy: sp.hirableBy.map((h: any) => h.roster?.slug || h.rule),
    specialRule: sp.specialRule ?? undefined,
    imageUrl: sp.imageUrl ?? undefined,
    isMegaStar: sp.isMegaStar,
    keywords: sp.keywords ?? undefined,
  };
}

const STAR_PLAYER_INCLUDE = {
  skills: { include: { skill: true } },
  hirableBy: { include: { roster: true } },
} as const;

/**
 * Source de vérité DB pour le recrutement/coût/validation — remplace les
 * lookups statiques `getStarPlayerBySlug`/`getAvailableStarPlayers` de
 * `@bb/game-engine` côté serveur. Un edit admin sur `StarPlayer` se
 * répercute immédiatement ici (pas de resync nécessaire).
 */
export async function getStarPlayerBySlugDb(
  slug: string,
  ruleset: Ruleset,
): Promise<StarPlayerDefinition | null> {
  const model = getStarPlayerModel();
  if (!model) return null;

  const row = await model.findUnique({
    where: { slug_ruleset: { slug, ruleset } },
    include: STAR_PLAYER_INCLUDE,
  });
  return row ? mapStarPlayerRowToDefinition(row) : null;
}

/**
 * Équivalent DB de `getAvailableStarPlayers` : un Star Player est
 * disponible pour un roster si `hirableBy` contient "all", OU une règle
 * régionale du roster, OU le slug du roster lui-même (matching 3-voies —
 * même logique que `routes/star-players.ts:/available/:roster`, à garder
 * synchronisée avec cette route plutôt que réinventée).
 */
export async function getAvailableStarPlayersDb(
  teamRoster: string,
  regionalRules: string[],
  ruleset: Ruleset,
): Promise<StarPlayerDefinition[]> {
  const model = getStarPlayerModel();
  if (!model) return [];

  const rows = await model.findMany({
    where: {
      ruleset,
      OR: [
        { hirableBy: { some: { rule: "all" } } },
        { hirableBy: { some: { roster: { slug: teamRoster } } } },
        ...(regionalRules.length
          ? regionalRules.map((rule) => ({ hirableBy: { some: { rule } } }))
          : []),
      ],
    },
    include: STAR_PLAYER_INCLUDE,
    orderBy: { displayName: "asc" },
  });

  // A9 — dédup par slug : un star éligible par plusieurs critères OR peut
  // remonter plusieurs fois (même logique que la route publique).
  const seenSlugs = new Set<string>();
  return rows
    .filter((r: any) => {
      if (seenSlugs.has(r.slug)) return false;
      seenSlugs.add(r.slug);
      return true;
    })
    .map(mapStarPlayerRowToDefinition);
}


/**
 * Partenaire OBLIGATOIRE d'un Star Player — lot 6.3.
 *
 * `StarPlayer.pairWithSlug` (base, éditable en admin) fait foi ; la table
 * compilée `STAR_PLAYER_PAIR_PARTNERS` reste le repli tant que la colonne
 * n'est pas renseignée (posée sans backfill par `prisma db push`).
 */
export function resolvePairPartnerSlug(row: {
  slug: string;
  pairWithSlug?: string | null;
}): string | null {
  const fromDb = row.pairWithSlug?.trim();
  if (fromDb) return fromDb;
  return STAR_PLAYER_PAIR_PARTNERS[row.slug] ?? null;
}

/**
 * Toutes les paires obligatoires d'un ruleset, servies par la BASE.
 *
 * Le prix de la paire est DÉRIVÉ (somme des deux `cost` en base) : le
 * partenaire garde `cost = 0` comme aujourd'hui, donc corriger un prix en
 * admin corrige aussi le prix de la paire — ce que le catalogue compilé, avec
 * son `pairCost` figé, ne savait pas faire.
 *
 * Repli intégral sur le catalogue du moteur si la table est absente (miroir
 * SQLite réduit) ou illisible : une feuille d'équipe ne doit jamais tomber
 * parce que la relation de paire n'a pas pu être relue.
 */
export async function getStarPlayerPairsDb(
  ruleset: Ruleset,
): Promise<Record<string, StarPlayerPair>> {
  const model = getStarPlayerModel();
  if (!model) return getStarPlayerPairs(ruleset);

  let rows: Array<{
    slug: string;
    displayName: string;
    cost: number;
    pairWithSlug?: string | null;
  }> | undefined;
  try {
    rows = await model.findMany({
      where: { ruleset },
      select: {
        slug: true,
        displayName: true,
        cost: true,
        pairWithSlug: true,
      },
    });
  } catch (e: unknown) {
    serverLog.error(
      `[star-players] paires illisibles pour ${ruleset} — repli catalogue`,
      e,
    );
    return getStarPlayerPairs(ruleset);
  }

  // Table vide (avant seed) ou client réduit (mock étroit, miroir SQLite) :
  // repli catalogue plutôt qu'une liste de paires vide, qui laisserait passer
  // une star « demi-paire ».
  if (!Array.isArray(rows) || rows.length === 0) {
    return getStarPlayerPairs(ruleset);
  }

  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const out: Record<string, StarPlayerPair> = {};
  for (const row of rows) {
    const partnerSlug = resolvePairPartnerSlug(row);
    if (!partnerSlug) continue;
    const partner = bySlug.get(partnerSlug);
    out[row.slug] = {
      partnerSlug,
      partnerName: partner?.displayName ?? partnerSlug,
      pairCost: row.cost + (partner?.cost ?? 0),
    };
  }
  return out;
}

/** Paire obligatoire d'un Star Player donné (base d'abord). */
export async function getStarPlayerPairDb(
  slug: string,
  ruleset: Ruleset,
): Promise<StarPlayerPair | null> {
  return (await getStarPlayerPairsDb(ruleset))[slug] ?? null;
}
