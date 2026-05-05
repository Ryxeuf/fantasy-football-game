/**
 * S26 DoD — Script CLI pour amorcer une saison thematique active.
 *
 * Usage :
 *   pnpm --filter @bb/server db:seed:themed-league
 *
 * Variables d'environnement supportees :
 *   - THEMED_LEAGUE_THEME : slug du theme (default = mois courant
 *     resolu via `resolveDefaultThemeForMonth`).
 *   - THEMED_LEAGUE_YEAR  : annee canonique 4 chiffres (default =
 *     annee courante).
 *   - THEMED_LEAGUE_PARTICIPANTS : nombre de rounds initiaux (default
 *     4).
 *   - THEMED_LEAGUE_NAME  : nom de la ligue conteneur (default
 *     `Themed Seasons`).
 *
 * L'admin par defaut (`admin@example.com`) est utilise comme
 * `creatorId` (cf. `seed.ts`). Si l'admin n'existe pas, on echoue
 * proprement avec un message explicite.
 */

import { prisma } from "./prisma";
import { serverLog } from "./utils/server-log";
import {
  DEFAULT_THEMED_LEAGUE_NAME,
  resolveDefaultThemeForMonth,
  seedThemedLeagueSeason,
} from "./seeders/themed-league";
import {
  getLeagueThemeBySlug,
  isLeagueThemeSlug,
  type LeagueThemeSlug,
} from "./services/league-themes";

async function main(): Promise<void> {
  const admin = await prisma.user.findUnique({
    where: { email: "admin@example.com" },
    select: { id: true },
  });
  if (!admin) {
    throw new Error(
      "Admin introuvable (email=admin@example.com). Lancez d'abord `pnpm db:seed`.",
    );
  }

  const now = new Date();
  const themeSlug = resolveThemeSlug(now);
  const themeYear = resolveThemeYear(now);
  const participants = resolveParticipantCount();
  const leagueName = (
    process.env.THEMED_LEAGUE_NAME ?? DEFAULT_THEMED_LEAGUE_NAME
  ).trim();

  const theme = getLeagueThemeBySlug(themeSlug);
  if (!theme) {
    throw new Error(`Theme inconnu: ${themeSlug}`);
  }

  serverLog.log(
    `🏟️  Seed ligue thematique : ${theme.title} ${themeYear} (rounds=${participants}, ligue="${leagueName}")`,
  );

  const out = await seedThemedLeagueSeason({
    creatorId: admin.id,
    theme: themeSlug,
    themeYear,
    participantCount: participants,
    leagueName,
  });

  if (out.created) {
    serverLog.log(
      `   ✅ Saison creee : ${out.season.theme} ${out.season.themeYear} (id=${out.season.id}, status=${out.season.status})`,
    );
  } else {
    serverLog.log(
      `   ✅ Saison deja presente : ${out.season.theme} ${out.season.themeYear} (id=${out.season.id}). Idempotence OK.`,
    );
  }
  serverLog.log(`   ↳ Ligue conteneur : ${out.league.name} (id=${out.league.id})`);
}

function resolveThemeSlug(now: Date): LeagueThemeSlug {
  const fromEnv = process.env.THEMED_LEAGUE_THEME?.trim();
  if (fromEnv && fromEnv.length > 0) {
    if (!isLeagueThemeSlug(fromEnv)) {
      throw new Error(
        `THEMED_LEAGUE_THEME invalide : "${fromEnv}". Slugs valides : skaven_cup, nordic_challenge, underworld_open`,
      );
    }
    return fromEnv;
  }
  return resolveDefaultThemeForMonth(now.getMonth() + 1).slug;
}

function resolveThemeYear(now: Date): number {
  const fromEnv = process.env.THEMED_LEAGUE_YEAR?.trim();
  if (!fromEnv || fromEnv.length === 0) {
    return now.getUTCFullYear();
  }
  const parsed = Number.parseInt(fromEnv, 10);
  if (
    !Number.isInteger(parsed) ||
    parsed <= 0 ||
    parsed > 9999 ||
    String(parsed) !== fromEnv
  ) {
    throw new Error(
      `THEMED_LEAGUE_YEAR invalide : "${fromEnv}". Attendu un entier dans [1, 9999].`,
    );
  }
  return parsed;
}

function resolveParticipantCount(): number {
  const fromEnv = process.env.THEMED_LEAGUE_PARTICIPANTS?.trim();
  if (!fromEnv || fromEnv.length === 0) return 4;
  const parsed = Number.parseInt(fromEnv, 10);
  if (
    !Number.isInteger(parsed) ||
    parsed < 2 ||
    parsed > 16 ||
    String(parsed) !== fromEnv
  ) {
    throw new Error(
      `THEMED_LEAGUE_PARTICIPANTS invalide : "${fromEnv}". Attendu un entier dans [2, 16].`,
    );
  }
  return parsed;
}

main()
  .then(async () => {
    await prisma.$disconnect();
    serverLog.log("🎉 Seed ligue thematique termine avec succes !");
  })
  .catch(async (e) => {
    serverLog.error("❌ Erreur seed ligue thematique :", e);
    await prisma.$disconnect();
    process.exit(1);
  });
