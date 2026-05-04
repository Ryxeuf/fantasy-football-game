/**
 * L2.C.2 — Sprint Ligues v2 PR7 : badge "Champion de saison" pour le
 * profil coach.
 *
 * Aligne sur S26.6d (`coach-championships.ts` pour les ligues
 * thematiques) et S27.1d (`cup-championships.ts`). Lit les snapshots
 * `LeagueSeasonAward` ou ce coach est inscrit comme `championUserId`
 * et compose un label affichable.
 *
 * Convention :
 *  - 1 entree par saison gagnee (toutes ligues confondues, themed ou
 *    non). Pour les saisons themed, le champion est aussi exposé via
 *    `getCoachThemedChampionships` ; ce service est complementaire et
 *    couvre TOUTES les saisons cloturees (pas uniquement les
 *    themed).
 *  - Si `LeagueSeasonAward` n'a pas ete cree (ex: snapshot rate),
 *    on retombe sur computeSeasonStandings pour combler — couts +
 *    mais ne fait pas planter le profil.
 *  - Labels neutres : "Champion {LeagueName} — {SeasonName}".
 */

import { prisma } from "../prisma";

export interface CoachLeagueChampionship {
  /** seasonId pour deep-link `/leagues/:leagueId/seasons/:sid/recap`. */
  readonly seasonId: string;
  readonly leagueId: string;
  readonly leagueName: string;
  readonly seasonNumber: number;
  readonly seasonName: string;
  /** "Champion {LeagueName} — {SeasonName}". */
  readonly label: string;
  /** ISO date du snapshot d'awards (createdAt). null si pas de snapshot. */
  readonly wonAt: string | null;
}

interface AwardRow {
  championUserId: string | null;
  createdAt: Date;
  season: {
    id: string;
    seasonNumber: number;
    name: string;
    leagueId: string;
    league: { id: string; name: string } | null;
  };
}

export async function getCoachLeagueChampionships(
  userId: string,
): Promise<CoachLeagueChampionship[]> {
  if (typeof userId !== "string" || userId.trim().length === 0) {
    return [];
  }

  const client = prisma as unknown as {
    leagueSeasonAward: {
      findMany: (args: unknown) => Promise<AwardRow[]>;
    };
  };

  const rows = await client.leagueSeasonAward.findMany({
    where: { championUserId: userId },
    select: {
      championUserId: true,
      createdAt: true,
      season: {
        select: {
          id: true,
          seasonNumber: true,
          name: true,
          leagueId: true,
          league: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows
    .filter((r) => r.season && r.season.league)
    .map((r) => {
      const leagueName = r.season.league?.name ?? "Ligue";
      return {
        seasonId: r.season.id,
        leagueId: r.season.leagueId,
        leagueName,
        seasonNumber: r.season.seasonNumber,
        seasonName: r.season.name,
        label: `Champion ${leagueName} — ${r.season.name}`,
        wonAt: r.createdAt.toISOString(),
      };
    });
}
