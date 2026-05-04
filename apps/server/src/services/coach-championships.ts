/**
 * S26.6d — Service "Champion {Theme} {YYYY}" pour le profil coach.
 *
 * Foundation du badge profil decerne au coach finissant 1er d'une
 * saison thematique completee. Lecture pure : aucun stockage dedie,
 * la verite vient de la cloture de saison + des standings calcules
 * a la demande (cf. `computeSeasonStandings`).
 *
 * Convention :
 *  - On considere "champion" le 1er coach du `computeSeasonStandings`
 *    (deja trie : points DESC, diff TD DESC, TD pour DESC, ELO DESC,
 *    nom ASC). En cas d'egalite parfaite, le tri deterministe arbitre.
 *  - On ignore les saisons dont le slug n'est pas dans le catalogue
 *    canonique (forward-compat avec d'eventuels themes deprecies).
 *  - Le label est format "Champion {Theme} {YYYY}" via
 *    `formatLeagueThemeChampionLabel`.
 */

import { prisma } from "../prisma";
import { computeSeasonStandings } from "./league";
import {
  formatLeagueThemeChampionLabel,
  isLeagueThemeSlug,
  type LeagueThemeSlug,
} from "./league-themes";

export interface CoachThemedChampionship {
  seasonId: string;
  theme: LeagueThemeSlug;
  themeYear: number;
  /** "Champion {Theme} {YYYY}". */
  label: string;
  leagueId: string;
  leagueName: string;
}

interface ThemedSeasonRow {
  id: string;
  theme: string | null;
  themeYear: number | null;
  leagueId: string;
  league: { id: string; name: string } | null;
}

export async function getCoachThemedChampionships(
  userId: string,
): Promise<CoachThemedChampionship[]> {
  if (typeof userId !== "string" || userId.trim().length === 0) {
    return [];
  }

  const seasons = (await (prisma as unknown as {
    leagueSeason: {
      findMany: (args: unknown) => Promise<ThemedSeasonRow[]>;
    };
  }).leagueSeason.findMany({
    where: {
      status: "completed",
      theme: { not: null },
      themeYear: { not: null },
    },
    select: {
      id: true,
      theme: true,
      themeYear: true,
      leagueId: true,
      league: { select: { id: true, name: true } },
    },
  })) as ThemedSeasonRow[];

  const result: CoachThemedChampionship[] = [];
  for (const s of seasons) {
    if (!s.theme || !isLeagueThemeSlug(s.theme)) continue;
    if (s.themeYear === null) continue;

    const standings = await computeSeasonStandings(s.id);
    if (standings.length === 0) continue;
    if (standings[0].ownerId !== userId) continue;

    const label = formatLeagueThemeChampionLabel(
      s.theme as LeagueThemeSlug,
      s.themeYear,
    );
    if (!label) continue;

    result.push({
      seasonId: s.id,
      theme: s.theme as LeagueThemeSlug,
      themeYear: s.themeYear,
      label,
      leagueId: s.leagueId,
      leagueName: s.league?.name ?? "",
    });
  }

  result.sort((a, b) => {
    if (b.themeYear !== a.themeYear) return b.themeYear - a.themeYear;
    return a.theme.localeCompare(b.theme);
  });

  return result;
}
