/**
 * S26 DoD — Seeder de ligue thematique active.
 *
 * Pre-requis pour le release sprint 26 : "1 ligue thematique active dans
 * le calendrier au moment du release". S26.6 a livre tout le code
 * (catalogue + endpoints + UI), il manquait juste un seed pret a tirer
 * en prod.
 *
 * Contrats :
 * - Idempotent : relancer le seeder ne duplique ni la ligue ni la saison
 *   thematique. La saison est uniquement identifiee par son couple
 *   (theme, themeYear) — donc si une saison thematique du meme theme et
 *   de la meme annee existe deja, on la reutilise.
 * - Si aucune ligue conteneur n'existe, on cree une ligue dediee
 *   `DEFAULT_THEMED_LEAGUE_NAME` configurable. Sinon on attache la
 *   nouvelle saison thematique a cette ligue existante.
 * - La saison est creee en `status='scheduled'` (pas `'draft'`) pour
 *   apparaitre immediatement dans le calendrier `/leagues/seasons`.
 * - Pas d'enrolement automatique d'equipes : les coachs s'inscrivent
 *   eux-memes via l'UI / les routes API existantes (S26.6 deja livre).
 */

import { prisma } from "../prisma";
import {
  getLeagueThemeBySlug,
  getLeagueThemeForMonth,
  listLeagueThemes,
  type LeagueTheme,
  type LeagueThemeSlug,
} from "../services/league-themes";

export const DEFAULT_THEMED_LEAGUE_NAME = "Themed Seasons";

export interface SeedThemedLeagueInput {
  creatorId: string;
  theme: LeagueThemeSlug;
  themeYear: number;
  /**
   * Optionnel : nombre de rounds a pre-creer. Default 4 (round-robin
   * minimal pour 4 equipes). Les inscriptions ulterieures pourront
   * regenerer le calendrier via le scheduler.
   */
  participantCount?: number;
  /**
   * Optionnel : nom de la ligue conteneur. Default
   * `DEFAULT_THEMED_LEAGUE_NAME`.
   */
  leagueName?: string;
}

export interface SeedThemedLeagueResult {
  created: boolean;
  league: { id: string; name: string };
  season: {
    id: string;
    seasonNumber: number;
    theme: string;
    themeYear: number;
    status: string;
  };
}

/**
 * Resoud un theme par defaut a partir d'un mois de calendrier (1-12).
 * Si aucun theme n'est associe a ce mois (le catalogue ne couvre que
 * mars/avril/mai), on retombe sur le 1er theme du catalogue trie par
 * mois croissant pour rester deterministe.
 */
export function resolveDefaultThemeForMonth(month: number): LeagueTheme {
  const fromMonth = getLeagueThemeForMonth(month);
  if (fromMonth) return fromMonth;
  const all = listLeagueThemes();
  if (all.length === 0) {
    throw new Error("Catalogue de themes vide");
  }
  return all[0];
}

export async function seedThemedLeagueSeason(
  input: SeedThemedLeagueInput,
): Promise<SeedThemedLeagueResult> {
  const theme = getLeagueThemeBySlug(input.theme);
  if (!theme) {
    throw new Error(
      `theme inconnu: ${String(input.theme)} (slugs valides: ${listLeagueThemes()
        .map((t) => t.slug)
        .join(", ")})`,
    );
  }
  if (
    !Number.isInteger(input.themeYear) ||
    input.themeYear <= 0 ||
    input.themeYear > 9999
  ) {
    throw new Error("themeYear doit etre un entier dans [1, 9999]");
  }
  const leagueName = (input.leagueName ?? DEFAULT_THEMED_LEAGUE_NAME).trim();
  if (leagueName.length === 0) {
    throw new Error("leagueName ne peut pas etre vide");
  }

  const existingLeague = await prisma.league.findFirst({
    where: { name: leagueName },
  });
  let leagueId: string;
  if (existingLeague) {
    leagueId = existingLeague.id;
  } else {
    const created = await prisma.league.create({
      data: {
        creatorId: input.creatorId,
        name: leagueName,
        description:
          "Ligue conteneur des saisons thematiques (Skaven Cup, Nordic Challenge, Underworld Open). Chaque saison correspond a une edition mensuelle.",
        ruleset: "season_3",
        status: "open",
        isPublic: true,
        maxParticipants: 16,
        winPoints: 3,
        drawPoints: 1,
        lossPoints: 0,
        forfeitPoints: -1,
      },
    });
    leagueId = created.id;
  }

  const existingSeason = (await prisma.leagueSeason.findFirst({
    where: {
      leagueId,
      // theme + themeYear : couple unique de fait (catalogue + annee).
      // Pas de @@unique sur Prisma car la colonne est nullable
      // (compatible avec les saisons non thematiques).
      theme: theme.slug,
      themeYear: input.themeYear,
    } as unknown as Record<string, unknown>,
  })) as {
    id: string;
    leagueId: string;
    seasonNumber: number;
    theme: string | null;
    themeYear: number | null;
    status: string;
  } | null;

  if (existingSeason) {
    await ensureRoundsExist(
      existingSeason.id,
      input.participantCount ?? 4,
    );
    return {
      created: false,
      league: { id: leagueId, name: leagueName },
      season: {
        id: existingSeason.id,
        seasonNumber: existingSeason.seasonNumber,
        theme: existingSeason.theme ?? theme.slug,
        themeYear: existingSeason.themeYear ?? input.themeYear,
        status: existingSeason.status,
      },
    };
  }

  const latest = await prisma.leagueSeason.findFirst({
    where: { leagueId },
    orderBy: { seasonNumber: "desc" },
    select: { seasonNumber: true },
  });
  const seasonNumber = (latest?.seasonNumber ?? 0) + 1;

  const created = (await prisma.leagueSeason.create({
    data: {
      leagueId,
      seasonNumber,
      name: `${theme.title} ${input.themeYear}`,
      // Status `scheduled` (pas `draft`) pour qu'elle apparaisse dans le
      // calendrier publique des saisons thematiques.
      status: "scheduled",
      theme: theme.slug,
      themeYear: input.themeYear,
    } as unknown as Record<string, unknown>,
  })) as {
    id: string;
    leagueId: string;
    seasonNumber: number;
    theme: string;
    themeYear: number;
    status: string;
  };

  await ensureRoundsExist(created.id, input.participantCount ?? 4);

  return {
    created: true,
    league: { id: leagueId, name: leagueName },
    season: {
      id: created.id,
      seasonNumber: created.seasonNumber,
      theme: created.theme,
      themeYear: created.themeYear,
      status: created.status,
    },
  };
}

async function ensureRoundsExist(
  seasonId: string,
  participantCount: number,
): Promise<void> {
  const safeCount = Math.max(2, Math.min(16, participantCount));
  const existing = await prisma.leagueRound.findMany({
    where: { seasonId },
    select: { roundNumber: true },
  });
  const present = new Set(
    existing.map((r: { roundNumber: number }) => r.roundNumber),
  );
  const toCreate: Array<{
    seasonId: string;
    roundNumber: number;
    name: string;
    status: string;
  }> = [];
  for (let n = 1; n <= safeCount; n += 1) {
    if (present.has(n)) continue;
    toCreate.push({
      seasonId,
      roundNumber: n,
      name: `Journee ${n}`,
      status: "pending",
    });
  }
  if (toCreate.length === 0) return;
  await prisma.leagueRound.createMany({ data: toCreate });
}
