/**
 * L2.C.1 — Sprint Ligues v2 PR7 : awards de fin de saison.
 *
 * Pendant symetrique de `cupScoring.ts` pour les ligues. La saison
 * fournit deja par `LeagueParticipant` les compteurs materialises
 * (wins/draws/losses/points/touchdownsFor/touchdownsAgainst/casualtiesFor/
 * casualtiesAgainst), il suffit de les agreger en awards et de
 * persister un snapshot dans `LeagueSeasonAward` au moment de la
 * cloture de saison.
 *
 * Catalogue d'awards :
 *   - topScorer        : meilleure attaque (TD pour, max)
 *   - bestDefense      : meilleure defense (TD encaisses, min)
 *   - basher           : equipe qui a inflige le plus de sorties
 *   - mostFans         : equipe qui encaisse le plus (martyrs)
 *   - cleanestSheet    : equipe qui a subi le moins de sorties
 *   - longestStreak    : conservateur — non implemente (necessiterait
 *                        de lire les matchs un par un, hors scope PR7).
 *
 * Champion = participant trie par `computeSeasonStandings` en 1ere
 * position (les regles de tie-break existantes sont reutilisees).
 *
 * Idempotence : snapshot persiste avec `seasonId @unique`. Si un
 * award existe deja pour la saison, on le renvoie tel quel sans
 * recalculer (sauf appel `recompute` explicite, hors scope ici).
 */

import { prisma } from "../prisma";
import { computeSeasonStandings, type StandingRow } from "./league";
import { serverLog } from "../utils/server-log";

export interface SeasonAwardEntry {
  /** TeamId du laureat. */
  readonly teamId: string;
  /** Nom de l'equipe (snapshot, garde la valeur a la cloture). */
  readonly teamName: string;
  /** Roster de l'equipe (snapshot). */
  readonly roster: string;
  /** UserId du proprietaire (pour deep-linker /coach/:slug). */
  readonly ownerId: string;
  /** coachName du proprietaire (snapshot, "—" si null). */
  readonly coachName: string;
  /** Valeur de la metrique. */
  readonly value: number;
}

export interface SeasonAwardsCatalogue {
  /** TD inflige le plus haut. */
  readonly topScorer: SeasonAwardEntry[];
  /** TD encaisse le plus bas. */
  readonly bestDefense: SeasonAwardEntry[];
  /** Sorties infligees le plus haut. */
  readonly basher: SeasonAwardEntry[];
  /** Sorties subies le plus haut. */
  readonly martyrs: SeasonAwardEntry[];
  /** Sorties subies le plus bas. */
  readonly cleanestSheet: SeasonAwardEntry[];
  /** Plus de victoires. */
  readonly mostWins: SeasonAwardEntry[];
}

export interface SeasonRecap {
  readonly seasonId: string;
  readonly championUserId: string | null;
  readonly championTeamId: string | null;
  readonly championLabel: string | null;
  readonly awards: SeasonAwardsCatalogue;
  readonly standings: StandingRow[];
}

const EMPTY_AWARDS: SeasonAwardsCatalogue = {
  topScorer: [],
  bestDefense: [],
  basher: [],
  martyrs: [],
  cleanestSheet: [],
  mostWins: [],
};

interface ComputeOptions {
  /**
   * Si true, ignore les participants `withdrawn` dans le calcul des
   * awards (mais les standings les conservent pour transparence).
   */
  readonly excludeWithdrawn?: boolean;
}

/**
 * Calcule les awards d'une saison a partir des compteurs
 * materialises sur `LeagueParticipant`. Pure (sauf lecture DB) :
 * appelable a la demande pour la page recap meme avant la cloture.
 *
 * En cas de saison vide (aucun participant ou aucun match joue),
 * renvoie des awards vides + champion=null.
 */
export async function computeSeasonRecap(
  seasonId: string,
  options: ComputeOptions = {},
): Promise<SeasonRecap> {
  const standings = await computeSeasonStandings(seasonId);

  const eligible = options.excludeWithdrawn
    ? standings.filter((s) => s.status !== "withdrawn")
    : standings;

  const champion = eligible[0] ?? null;

  if (!champion || champion.played === 0) {
    // Aucun match joue -> aucun award decerne.
    return {
      seasonId,
      championUserId: null,
      championTeamId: null,
      championLabel: null,
      awards: EMPTY_AWARDS,
      standings,
    };
  }

  const awards: SeasonAwardsCatalogue = {
    topScorer: pickTop(eligible, (s) => s.touchdownsFor),
    bestDefense: pickTop(eligible, (s) => s.touchdownsAgainst, {
      reverse: true,
    }),
    basher: pickTop(eligible, (s) => s.casualtiesFor),
    martyrs: pickTop(eligible, (s) => s.casualtiesAgainst),
    cleanestSheet: pickTop(eligible, (s) => s.casualtiesAgainst, {
      reverse: true,
    }),
    mostWins: pickTop(eligible, (s) => s.wins),
  };

  return {
    seasonId,
    championUserId: champion.ownerId,
    championTeamId: champion.teamId,
    championLabel: champion.coachName ?? null,
    awards,
    standings,
  };
}

/**
 * Selectionne le podium d'un award (toutes les equipes ex-aequo en
 * tete). En `reverse=true` : on prend le minimum (defense, cleanest
 * sheet). Les ties sont conserves.
 *
 * Filtre : si la valeur du leader est 0 (ou indeterminee) on retourne
 * un tableau vide — un award sans champion concret n'a pas d'interet.
 */
interface PickTopOptions {
  readonly reverse?: boolean;
}

function pickTop(
  rows: readonly StandingRow[],
  pick: (row: StandingRow) => number,
  options: PickTopOptions = {},
): SeasonAwardEntry[] {
  if (rows.length === 0) return [];
  const sorted = [...rows].sort(
    (a, b) =>
      (options.reverse ? pick(a) - pick(b) : pick(b) - pick(a)) ||
      a.teamName.localeCompare(b.teamName),
  );
  const topValue = pick(sorted[0]);
  // En "reverse" (= minimum), 0 reste un score legitime (ex:
  // cleanestSheet = subir 0 sortie). En non-reverse (= maximum), 0
  // = personne n'a marque de TD/cas, on n'attribue pas l'award.
  if (!options.reverse && topValue === 0) {
    return [];
  }
  const result: SeasonAwardEntry[] = [];
  for (const row of sorted) {
    const value = pick(row);
    if (value !== topValue) break;
    result.push({
      teamId: row.teamId,
      teamName: row.teamName,
      roster: row.roster,
      ownerId: row.ownerId,
      coachName: row.coachName ?? "—",
      value,
    });
  }
  return result;
}

interface PrismaWithAwards {
  leagueSeasonAward: {
    findUnique: (args: unknown) => Promise<unknown>;
    create: (args: unknown) => Promise<unknown>;
  };
}

/**
 * Persiste le snapshot des awards dans `LeagueSeasonAward`. Idempotent :
 * si un row existe deja pour `seasonId`, on le renvoie tel quel.
 */
export async function persistSeasonAwards(
  seasonId: string,
): Promise<{
  created: boolean;
  awardId: string | null;
  recap: SeasonRecap;
}> {
  const recap = await computeSeasonRecap(seasonId);

  const client = prisma as unknown as PrismaWithAwards;
  const existing = (await client.leagueSeasonAward.findUnique({
    where: { seasonId },
    select: { id: true },
  })) as { id: string } | null;
  if (existing) {
    return { created: false, awardId: existing.id, recap };
  }

  if (!recap.championUserId || !recap.championTeamId) {
    // Saison sans champion (vide) : on ne cree pas d'award.
    return { created: false, awardId: null, recap };
  }

  const row = (await client.leagueSeasonAward.create({
    data: {
      seasonId,
      championUserId: recap.championUserId,
      championTeamId: recap.championTeamId,
      awards: JSON.stringify(recap.awards),
    },
    select: { id: true },
  })) as { id: string };

  serverLog.info(
    `[league-scoring] season=${seasonId} award persisted, champion=${recap.championUserId} teamId=${recap.championTeamId}`,
  );

  return { created: true, awardId: row.id, recap };
}

/**
 * Lit le snapshot persiste d'awards d'une saison. Renvoie null si
 * non encore calcule (saison non cloturee ou sans champion).
 */
export interface PersistedSeasonAward {
  readonly id: string;
  readonly seasonId: string;
  readonly championUserId: string | null;
  readonly championTeamId: string | null;
  readonly awards: SeasonAwardsCatalogue;
  readonly createdAt: Date;
}

export async function getPersistedSeasonAward(
  seasonId: string,
): Promise<PersistedSeasonAward | null> {
  const client = prisma as unknown as {
    leagueSeasonAward: {
      findUnique: (args: unknown) => Promise<unknown>;
    };
  };
  const row = (await client.leagueSeasonAward.findUnique({
    where: { seasonId },
  })) as
    | {
        id: string;
        seasonId: string;
        championUserId: string | null;
        championTeamId: string | null;
        awards: string;
        createdAt: Date;
      }
    | null;
  if (!row) return null;
  let parsed: SeasonAwardsCatalogue = EMPTY_AWARDS;
  try {
    const json = JSON.parse(row.awards) as Partial<SeasonAwardsCatalogue>;
    parsed = {
      topScorer: Array.isArray(json.topScorer) ? json.topScorer : [],
      bestDefense: Array.isArray(json.bestDefense) ? json.bestDefense : [],
      basher: Array.isArray(json.basher) ? json.basher : [],
      martyrs: Array.isArray(json.martyrs) ? json.martyrs : [],
      cleanestSheet: Array.isArray(json.cleanestSheet)
        ? json.cleanestSheet
        : [],
      mostWins: Array.isArray(json.mostWins) ? json.mostWins : [],
    };
  } catch {
    parsed = EMPTY_AWARDS;
  }
  return {
    id: row.id,
    seasonId: row.seasonId,
    championUserId: row.championUserId,
    championTeamId: row.championTeamId,
    awards: parsed,
    createdAt: row.createdAt,
  };
}
