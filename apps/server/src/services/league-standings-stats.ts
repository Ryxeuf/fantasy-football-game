/**
 * F1 — Statistiques etendues du classement de ligue.
 *
 * Retour coach (Ombrelame, 07/2026) : le classement n'exposait que
 * Pts / MJ / V / N / D / TD / Sorties. Les coachs veulent aussi les
 * colonnes derivees de la feuille de match :
 *   - For   : points retires a cause des forfaits ;
 *   - P     : passes reussies ;
 *   - Agr   : agressions ;
 *   - SP    : sorties infligees par le public (crowd surge) ;
 *   - Exclu : expulsions.
 *
 * Ces donnees existent deja : le journal `LeagueMatchEvent` (feuille de
 * match v2, Lot G) porte les kinds `pass_complete` / `aggression` /
 * `crowd_surge` / `expulsion`, et les forfaits sont materialises par le
 * `status` du `LeaguePairing` (`forfeit_home` / `forfeit_away`).
 *
 * On les agrege ici plutot que d'ajouter des compteurs materialises sur
 * `LeagueParticipant` : pas de migration ni de backfill, et les
 * corrections ex-post du commissaire sur la feuille de match sont
 * refletees immediatement dans le classement.
 *
 * Le pliage est PUR (`foldSeasonExtraStats`) donc testable sans DB. La
 * partie Prisma se limite a un `findMany` sur les pairings + un
 * `groupBy` sur les events — pas de N+1 (cf. CLAUDE.md).
 */

import { prisma } from "../prisma";

export interface SeasonExtraStats {
  /** Nombre de forfaits ou ce participant etait le forfaitaire. */
  readonly forfeits: number;
  /** Passes reussies (`pass_complete`). */
  readonly passes: number;
  /** Interceptions reussies (`interception`) — classements par equipe. */
  readonly interceptions: number;
  /** Agressions commises (`aggression`). */
  readonly aggressions: number;
  /** Sorties infligees par le public (`crowd_surge`). */
  readonly crowdSurges: number;
  /** Expulsions subies (`expulsion`). */
  readonly expulsions: number;
}

export const EMPTY_EXTRA_STATS: SeasonExtraStats = {
  forfeits: 0,
  passes: 0,
  interceptions: 0,
  aggressions: 0,
  crowdSurges: 0,
  expulsions: 0,
};

/** Pairing minimal necessaire au pliage (forfaits + lien feuille). */
export interface StandingsPairingRow {
  readonly status: string;
  readonly homeParticipantId: string;
  readonly awayParticipantId: string;
  /** Id de la feuille de match, null si aucune feuille saisie. */
  readonly matchSheetId: string | null;
}

/** Resultat d'un `groupBy` events, normalise. */
export interface StandingsEventCount {
  readonly matchSheetId: string;
  readonly kind: string;
  /** "home" | "away" — null/inconnu => event ignore. */
  readonly team: string | null;
  readonly count: number;
}

type CountableField = Exclude<keyof SeasonExtraStats, "forfeits">;

/**
 * Kinds d'events comptabilises, et colonne du classement associee.
 *
 * Convention de `team` heritee du summarizer (`league-match-summary`) :
 * `team` designe l'equipe a l'origine de l'event. Donc `crowd_surge`
 * est credite a l'equipe qui beneficie de la sortie, `expulsion` a
 * l'equipe dont le joueur est expulse.
 */
const KIND_TO_FIELD: Readonly<Record<string, CountableField>> = {
  pass_complete: "passes",
  interception: "interceptions",
  aggression: "aggressions",
  crowd_surge: "crowdSurges",
  expulsion: "expulsions",
};

/** Liste blanche passee au `where` du groupBy. */
export const TRACKED_EVENT_KINDS: readonly string[] =
  Object.keys(KIND_TO_FIELD);

type MutableExtraStats = { -readonly [K in keyof SeasonExtraStats]: number };

/**
 * PUR — plie les pairings d'une saison + les comptes d'events par
 * feuille en un cumul par participant.
 *
 * Tous les participants apparaissant dans un pairing obtiennent une
 * entree (a zero si aucun event), ce qui evite au caller de distinguer
 * "pas de donnee" de "zero".
 */
export function foldSeasonExtraStats(
  pairings: readonly StandingsPairingRow[],
  eventCounts: readonly StandingsEventCount[],
): Map<string, SeasonExtraStats> {
  const acc = new Map<string, MutableExtraStats>();
  const ensure = (participantId: string): MutableExtraStats => {
    let line = acc.get(participantId);
    if (!line) {
      line = { ...EMPTY_EXTRA_STATS };
      acc.set(participantId, line);
    }
    return line;
  };

  const sidesByMatchSheetId = new Map<
    string,
    { home: string; away: string }
  >();

  for (const pairing of pairings) {
    ensure(pairing.homeParticipantId);
    ensure(pairing.awayParticipantId);

    if (pairing.status === "forfeit_home") {
      ensure(pairing.homeParticipantId).forfeits += 1;
    } else if (pairing.status === "forfeit_away") {
      ensure(pairing.awayParticipantId).forfeits += 1;
    }

    if (pairing.matchSheetId) {
      sidesByMatchSheetId.set(pairing.matchSheetId, {
        home: pairing.homeParticipantId,
        away: pairing.awayParticipantId,
      });
    }
  }

  for (const entry of eventCounts) {
    const field = KIND_TO_FIELD[entry.kind];
    if (!field) continue;
    const sides = sidesByMatchSheetId.get(entry.matchSheetId);
    if (!sides) continue;
    const participantId =
      entry.team === "home"
        ? sides.home
        : entry.team === "away"
          ? sides.away
          : null;
    if (!participantId) continue;
    if (!Number.isFinite(entry.count) || entry.count <= 0) continue;
    ensure(participantId)[field] += entry.count;
  }

  const result = new Map<string, SeasonExtraStats>();
  for (const [participantId, line] of acc) {
    result.set(participantId, { ...line });
  }
  return result;
}

interface GroupedEventRow {
  matchSheetId: string;
  kind: string;
  team: string | null;
  _count: { _all: number } | null;
}

/**
 * Agrege les stats etendues d'une saison. Deux requetes au total,
 * quel que soit le nombre de rencontres.
 */
export async function aggregateSeasonExtraStats(
  seasonId: string,
): Promise<Map<string, SeasonExtraStats>> {
  const pairings = (await prisma.leaguePairing.findMany({
    where: { round: { seasonId } },
    select: {
      status: true,
      homeParticipantId: true,
      awayParticipantId: true,
      matchSheet: { select: { id: true } },
    },
  })) as Array<{
    status: string;
    homeParticipantId: string;
    awayParticipantId: string;
    matchSheet: { id: string } | null;
  }>;

  const rows: StandingsPairingRow[] = pairings.map((p) => ({
    status: p.status,
    homeParticipantId: p.homeParticipantId,
    awayParticipantId: p.awayParticipantId,
    matchSheetId: p.matchSheet?.id ?? null,
  }));

  const matchSheetIds = rows
    .map((r) => r.matchSheetId)
    .filter((id): id is string => id !== null);

  if (matchSheetIds.length === 0) {
    return foldSeasonExtraStats(rows, []);
  }

  const grouped = (await prisma.leagueMatchEvent.groupBy({
    by: ["matchSheetId", "kind", "team"],
    where: {
      matchSheetId: { in: matchSheetIds },
      kind: { in: [...TRACKED_EVENT_KINDS] },
    },
    _count: { _all: true },
  })) as unknown as GroupedEventRow[];

  const counts: StandingsEventCount[] = grouped.map((g) => ({
    matchSheetId: g.matchSheetId,
    kind: g.kind,
    team: g.team,
    count: g._count?._all ?? 0,
  }));

  return foldSeasonExtraStats(rows, counts);
}
