/**
 * S26.6f — Cloture des saisons thematiques.
 *
 * Hook idempotent appele par `league-match-result.ts` quand une saison
 * passe en `status='completed'`. Concu comme un point d'extension : la
 * version actuelle calcule juste le champion et retourne ses metadata,
 * pour servir de fondation a de futures integrations sans toucher au
 * pipeline de scoring (push notification "vous etes champion", trophee
 * specifique, archivage, etc.).
 *
 * Pourquoi ne pas y mettre directement ces effets ? Parce qu'ils ont
 * chacun leur propre cycle (preferences user, gestion d'echec, retry)
 * et meritent d'etre branches independamment via leurs propres
 * services. Ce hook se contente de fournir l'information autoritaire
 * "qui est champion" + "quelle saison vient de cloturer".
 *
 * Idempotence : la fonction relit la saison a chaque appel et retourne
 * un resultat deterministe (le champion ne change pas une fois la
 * saison cloturee). Pas d'effet de bord persistant ici.
 */

import { prisma } from "../prisma";
import { computeSeasonStandings } from "./league";
import {
  formatLeagueThemeChampionLabel,
  isLeagueThemeSlug,
  type LeagueThemeSlug,
} from "./league-themes";

export type ThemedSeasonClosureResult =
  | {
      readonly skipped: true;
      readonly reason:
        | "season_not_found"
        | "not_themed"
        | "not_completed"
        | "unknown_theme"
        | "no_standings"
        | "invalid_label";
    }
  | {
      readonly skipped: false;
      readonly seasonId: string;
      readonly championUserId: string;
      readonly championTeamId: string;
      readonly championTeamName: string;
      readonly theme: LeagueThemeSlug;
      readonly themeYear: number;
      readonly label: string;
    };

interface SeasonRow {
  id: string;
  status: string;
  theme: string | null;
  themeYear: number | null;
}

export async function applyThemedSeasonClosure(
  seasonId: string,
): Promise<ThemedSeasonClosureResult> {
  const season = (await (prisma as unknown as {
    leagueSeason: { findUnique: (args: unknown) => Promise<SeasonRow | null> };
  }).leagueSeason.findUnique({
    where: { id: seasonId },
    select: { id: true, status: true, theme: true, themeYear: true },
  })) as SeasonRow | null;

  if (!season) {
    return { skipped: true, reason: "season_not_found" };
  }
  if (!season.theme || season.themeYear === null) {
    return { skipped: true, reason: "not_themed" };
  }
  if (season.status !== "completed") {
    return { skipped: true, reason: "not_completed" };
  }
  if (!isLeagueThemeSlug(season.theme)) {
    return { skipped: true, reason: "unknown_theme" };
  }

  const standings = await computeSeasonStandings(season.id);
  if (standings.length === 0) {
    return { skipped: true, reason: "no_standings" };
  }

  const champion = standings[0];
  const label = formatLeagueThemeChampionLabel(
    season.theme as LeagueThemeSlug,
    season.themeYear,
  );
  if (!label) {
    return { skipped: true, reason: "invalid_label" };
  }

  return {
    skipped: false,
    seasonId: season.id,
    championUserId: champion.ownerId,
    championTeamId: champion.teamId,
    championTeamName: champion.teamName,
    theme: season.theme as LeagueThemeSlug,
    themeYear: season.themeYear,
    label,
  };
}
