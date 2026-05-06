/**
 * Pro League — sprint Pro League lot 1.A.1 seeder.
 *
 * Amorce la `ProLeague` "Old World League" et ses 16 `ProTeam` officielles.
 * Source de verite des profils tactiques + TVs : `PRO_LEAGUE_TEAMS` dans
 * `packages/sim-engine/src/tactics/race-profiles.ts`. La DB ne stocke que
 * les meta d'affichage (city, race, NFL flavor, branding) ; le TV est
 * materialise pour lectures rapides.
 *
 * Contrats :
 * - Idempotent : relancer `pnpm db:seed` ne duplique pas la ligue ni les
 *   equipes ; les TVs et flavors sont mis a jour si la source change.
 * - Le slug `old-world-league` est la cle naturelle de la singleton ligue.
 * - Les slugs ProTeam matchent exactement `PRO_LEAGUE_TEAMS[i].id` pour
 *   permettre au sim-engine de remonter le profil tactique a partir d'un
 *   record DB.
 *
 * Le roster joueur (ProTeamRoster) reste vide au seed — sera populé par
 * la generation procedurale post-MVP (lot 1.E.6 rookie pipeline).
 */

import { PRO_LEAGUE_TEAMS } from "@bb/sim-engine";

import { prisma } from "../prisma";

export const OLD_WORLD_LEAGUE_SLUG = "old-world-league";
export const OLD_WORLD_LEAGUE_NAME = "Old World League";

interface ProTeamBranding {
  primaryColor: string;
  secondaryColor: string;
}

/**
 * Palettes inspirees des homages NFL × races BB du sprint. Les couleurs
 * restent generiques (pas de marque NFL utilisee) ; cf. SPRINT-pro-league.md
 * section "Statut juridique".
 */
const TEAM_BRANDING: Record<string, ProTeamBranding> = {
  "pit-smashers": { primaryColor: "#000000", secondaryColor: "#FFB612" },
  "dal-vipers": { primaryColor: "#003594", secondaryColor: "#869397" },
  "kc-soaring-hawks": { primaryColor: "#E31837", secondaryColor: "#FFB81C" },
  "ne-cold-tacticians": { primaryColor: "#002244", secondaryColor: "#C60C30" },
  "sf-gold-rush": { primaryColor: "#AA0000", secondaryColor: "#B3995D" },
  "car-jungle-queens": { primaryColor: "#0085CA", secondaryColor: "#101820" },
  "lv-outlaws": { primaryColor: "#000000", secondaryColor: "#A5ACAF" },
  "no-voodoo-saints": { primaryColor: "#D3BC8D", secondaryColor: "#101820" },
  "chi-iron-bears": { primaryColor: "#0B162A", secondaryColor: "#C83803" },
  "phi-storm-eagles": { primaryColor: "#004C54", secondaryColor: "#A5ACAF" },
  "phx-tomb-cardinals": { primaryColor: "#97233F", secondaryColor: "#000000" },
  "min-frostraiders": { primaryColor: "#4F2683", secondaryColor: "#FFC62F" },
  "gb-cheese-halflings": { primaryColor: "#203731", secondaryColor: "#FFB612" },
  "jax-swamp-lizards": { primaryColor: "#101820", secondaryColor: "#D7A22A" },
  "den-mile-high-centaurs": { primaryColor: "#FB4F14", secondaryColor: "#002244" },
  "buf-snow-ogres": { primaryColor: "#00338D", secondaryColor: "#C60C30" },
};

export async function seedProLeague(): Promise<void> {
  const league = await prisma.proLeague.upsert({
    where: { slug: OLD_WORLD_LEAGUE_SLUG },
    create: {
      slug: OLD_WORLD_LEAGUE_SLUG,
      name: OLD_WORLD_LEAGUE_NAME,
      description:
        "Ligue simulee a 16 equipes (homages NFL × races Blood Bowl). " +
        "15 journees round-robin, mardi 21h, simulation engine BB-like.",
      branding: { motto: "Where Legends Are Smashed" },
    },
    update: {
      name: OLD_WORLD_LEAGUE_NAME,
    },
  });

  for (const team of PRO_LEAGUE_TEAMS) {
    const branding = TEAM_BRANDING[team.id];
    await prisma.proTeam.upsert({
      where: { slug: team.id },
      create: {
        leagueId: league.id,
        slug: team.id,
        city: team.city,
        name: team.name,
        race: team.race,
        nflFlavor: team.nflFlavor,
        primaryColor: branding?.primaryColor,
        secondaryColor: branding?.secondaryColor,
        baseTv: team.tv,
      },
      update: {
        city: team.city,
        name: team.name,
        race: team.race,
        nflFlavor: team.nflFlavor,
        primaryColor: branding?.primaryColor,
        secondaryColor: branding?.secondaryColor,
        baseTv: team.tv,
      },
    });
  }
}
