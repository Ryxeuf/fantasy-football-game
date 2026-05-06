/**
 * 16 profils raciaux Pro League — sprint Pro League 0.B.3.
 *
 * Mapping NFL × race BB issu du tableau "Mapping 16 equipes" du sprint.
 * Chaque profil est paramétré pour refléter l'identité tactique de
 * l'équipe (par exemple Pittsburgh Smashers / Orcs : bash 85, pace
 * mesurée). Les valeurs partent du `DEFAULT_TACTICAL_PROFILE` (50) et
 * ne sortent du baseline que sur les dimensions identitaires — l'idée
 * étant que la tuning loop (lot 0.E.1) viendra calibrer plus finement
 * via le bench harness FUMBBL (lot 0.D.2).
 *
 * Légende juridique
 * -----------------
 * Aucun nom, logo ou marque NFL n'est utilisé. Les équipes sont des
 * **clins d'œil** identifiables par les fans (ville, couleurs,
 * archétype) sans citation directe (cf. analyse "Risques" du sprint).
 */

import {
  DEFAULT_TACTICAL_PROFILE,
  type TacticalProfile,
} from './tactical-profile';

export interface ProTeamProfile {
  /** Stable slug — `<city3>-<name-slug>`. Used as a foreign key by the
   *  Prisma `ProTeam` table (lot 1.A.1). */
  id: string;
  /** City flavor — "Pittsburgh", "Kansas City", etc. */
  city: string;
  /** Team display name — "Smashers", "Soaring Hawks", etc. */
  name: string;
  /** BB race id (Orcs, Wood Elves, Skaven, …). Free-form for now ; will
   *  be aligned with `@bb/game-engine` roster ids in lot 1.A.1. */
  race: string;
  /** Free-text NFL homage hint for the Gazette (1.E.1) and the team page
   *  (1.C.2). Never exposes a real franchise mark — flavor only. */
  nflFlavor: string;
  /** Tunable tactical fingerprint validated by `tacticalProfileSchema`. */
  tactics: TacticalProfile;
  /** Team Value (gold pieces) — used by the underdog variance boost
   *  (lot 0.C.3) and the bench harness upset rate metric (lot 0.D.3 / C2).
   *  Values reflect typical BB2020 roster cost archetypes :
   *    - Halflings / Goblins / Ogres ~ 800-900 (cheap, high TV gap = underdog)
   *    - Most rosters baseline ~ 1000
   *    - Elf rosters (Wood / Dark / Pro / High) ~ 1100 (premium positionals)
   *  Tunable in next iteration loops. */
  tv: number;
}

/** Helper: tune a baseline profile with a small set of overrides. Keeps
 *  each declaration short and the diffs vs default obvious. */
function tune(overrides: Partial<TacticalProfile>): TacticalProfile {
  return { ...DEFAULT_TACTICAL_PROFILE, ...overrides };
}

export const PRO_LEAGUE_TEAMS: readonly ProTeamProfile[] = Object.freeze([
  // 1. Pittsburgh Smashers — Orcs / Steelers (blue-collar bash).
  {
    id: 'pit-smashers',
    city: 'Pittsburgh',
    name: 'Smashers',
    race: 'Orc',
    nflFlavor: 'Blue-collar industrial defense, smashmouth identity',
    tactics: tune({
      bashIndex: 85,
      passingFrequency: 25,
      pace: 45,
      cageAffinity: 70,
      pressingDefense: 70,
      patience: 55,
      foulFrequency: 55,
    }),
    tv: 1050,
  },
  // 2. Dallas Vipers — Dark Elves / Cowboys (rich, agile, prima donnas).
  {
    id: 'dal-vipers',
    city: 'Dallas',
    name: 'Vipers',
    race: 'Dark Elf',
    nflFlavor: 'Star-loaded prima donnas, agility-first',
    tactics: tune({
      bashIndex: 35,
      passingFrequency: 65,
      riskAppetite: 70,
      breakawayInstinct: 75,
      pace: 70,
      blitzPriority: 65,
      patience: 45,
    }),
    tv: 1100,
  },
  // 3. Kansas City Soaring Hawks — Wood Elves / Chiefs (aerial Mahomes-flavor).
  {
    id: 'kc-soaring-hawks',
    city: 'Kansas City',
    name: 'Soaring Hawks',
    race: 'Wood Elf',
    nflFlavor: 'Aerial offense, deep balls, gunslinger',
    tactics: tune({
      bashIndex: 25,
      passingFrequency: 80,
      riskAppetite: 75,
      breakawayInstinct: 80,
      pace: 75,
      blitzPriority: 55,
      cageAffinity: 30,
      patience: 40,
    }),
    tv: 1100,
  },
  // 4. New England Cold Tacticians — Lizardmen / Patriots (cold dynasty).
  {
    id: 'ne-cold-tacticians',
    city: 'New England',
    name: 'Cold Tacticians',
    race: 'Lizardmen',
    nflFlavor: 'Methodical dynasty, low risk, high discipline',
    tactics: tune({
      bashIndex: 65,
      passingFrequency: 35,
      riskAppetite: 25,
      pace: 50,
      patience: 85,
      stallTendency: 70,
      rerollUsage: 35,
      pressingDefense: 60,
    }),
    tv: 1050,
  },
  // 5. San Francisco Gold Rush — Skaven / 49ers (scrappy west-coast speed).
  {
    id: 'sf-gold-rush',
    city: 'San Francisco',
    name: 'Gold Rush',
    race: 'Skaven',
    nflFlavor: 'Scrappy speed, west-coast quick strikes',
    tactics: tune({
      bashIndex: 30,
      passingFrequency: 60,
      riskAppetite: 70,
      breakawayInstinct: 90,
      pace: 90,
      gfiTolerance: 80,
      blitzPriority: 70,
      patience: 30,
      foulFrequency: 60,
    }),
    tv: 1000,
  },
  // 6. Carolina Jungle Queens — Amazons / Panthers (tribal, defensive).
  {
    id: 'car-jungle-queens',
    city: 'Carolina',
    name: 'Jungle Queens',
    race: 'Amazon',
    nflFlavor: 'Tribal defense, jungle aggression',
    tactics: tune({
      bashIndex: 55,
      passingFrequency: 40,
      pressingDefense: 80,
      screenAffinity: 75,
      patience: 65,
      blitzPriority: 60,
      pace: 55,
    }),
    tv: 950,
  },
  // 7. Las Vegas Outlaws — Norse / Raiders (pirate, brutal).
  {
    id: 'lv-outlaws',
    city: 'Las Vegas',
    name: 'Outlaws',
    race: 'Norse',
    nflFlavor: 'Pirate identity, brutal attitude',
    tactics: tune({
      bashIndex: 75,
      passingFrequency: 35,
      foulFrequency: 80,
      blitzPriority: 70,
      pace: 60,
      patience: 40,
      riskAppetite: 65,
    }),
    tv: 1000,
  },
  // 8. New Orleans Voodoo Saints — Undead / Saints (slow Big Easy grind).
  {
    id: 'no-voodoo-saints',
    city: 'New Orleans',
    name: 'Voodoo Saints',
    race: 'Undead',
    nflFlavor: 'Big-Easy slow grind, voodoo flavor',
    tactics: tune({
      bashIndex: 75,
      passingFrequency: 25,
      pace: 30,
      cageAffinity: 75,
      patience: 80,
      stallTendency: 75,
      pressingDefense: 65,
    }),
    tv: 1050,
  },
  // 9. Chicago Iron Bears — Dwarves / Bears (rugged tank).
  {
    id: 'chi-iron-bears',
    city: 'Chicago',
    name: 'Iron Bears',
    race: 'Dwarf',
    nflFlavor: 'Rugged smashmouth, tank defense',
    tactics: tune({
      bashIndex: 90,
      passingFrequency: 15,
      pace: 25,
      cageAffinity: 85,
      patience: 80,
      stallTendency: 75,
      rerollUsage: 30,
      pressingDefense: 80,
      gfiTolerance: 20,
    }),
    tv: 1050,
  },
  // 10. Philadelphia Storm Eagles — Pro Elves / Eagles (balanced).
  {
    id: 'phi-storm-eagles',
    city: 'Philadelphia',
    name: 'Storm Eagles',
    race: 'Pro Elf',
    nflFlavor: 'Balanced flying offense, storm identity',
    tactics: tune({
      bashIndex: 50,
      passingFrequency: 60,
      riskAppetite: 55,
      breakawayInstinct: 60,
      pace: 60,
      patience: 60,
      pressingDefense: 55,
      cageAffinity: 50,
    }),
    tv: 1050,
  },
  // 11. Phoenix Tomb Cardinals — Tomb Kings (Khemri) / Cardinals (desert slow).
  {
    id: 'phx-tomb-cardinals',
    city: 'Phoenix',
    name: 'Tomb Cardinals',
    race: 'Tomb Kings',
    nflFlavor: 'Desert ancient grind, ultra-slow',
    tactics: tune({
      bashIndex: 80,
      passingFrequency: 15,
      pace: 20,
      cageAffinity: 75,
      patience: 90,
      stallTendency: 80,
      gfiTolerance: 15,
      rerollUsage: 25,
    }),
    tv: 1050,
  },
  // 12. Minneapolis Frostraiders — Norse alt / Vikings (raids).
  {
    id: 'min-frostraiders',
    city: 'Minneapolis',
    name: 'Frostraiders',
    race: 'Norse',
    nflFlavor: 'Northern raids, purple steel',
    tactics: tune({
      bashIndex: 75,
      passingFrequency: 40,
      foulFrequency: 70,
      blitzPriority: 80,
      pace: 65,
      pressingDefense: 70,
      riskAppetite: 60,
    }),
    tv: 1000,
  },
  // 13. Green Bay Cheese Halflings — Halflings / Packers (cheesy underdog).
  {
    id: 'gb-cheese-halflings',
    city: 'Green Bay',
    name: 'Cheese Halflings',
    race: 'Halfling',
    nflFlavor: 'Cheese-headed underdogs, blue-collar fans',
    tactics: tune({
      bashIndex: 15,
      passingFrequency: 35,
      riskAppetite: 90,
      gfiTolerance: 90,
      pace: 55,
      patience: 30,
      foulFrequency: 70,
      breakawayInstinct: 65,
    }),
    tv: 700,
  },
  // 14. Jacksonville Swamp Lizards — Lizardmen alt / Jaguars (Florida jungle).
  {
    id: 'jax-swamp-lizards',
    city: 'Jacksonville',
    name: 'Swamp Lizards',
    race: 'Lizardmen',
    nflFlavor: 'Florida swamp, ambush style',
    tactics: tune({
      bashIndex: 70,
      passingFrequency: 35,
      pace: 60,
      blitzPriority: 70,
      pressingDefense: 65,
      patience: 60,
      breakawayInstinct: 55,
    }),
    tv: 1050,
  },
  // 15. Denver Mile High Centaurs — Beastmen / Chaos / Broncos (wild).
  {
    id: 'den-mile-high-centaurs',
    city: 'Denver',
    name: 'Mile High Centaurs',
    race: 'Beastmen',
    nflFlavor: 'Wild West, mile-high raids',
    tactics: tune({
      bashIndex: 70,
      passingFrequency: 30,
      foulFrequency: 75,
      riskAppetite: 70,
      blitzPriority: 70,
      pace: 65,
      patience: 35,
    }),
    tv: 1050,
  },
  // 16. Buffalo Snow Ogres — Ogres / Bills (Buffalo snow brutality).
  {
    id: 'buf-snow-ogres',
    city: 'Buffalo',
    name: 'Snow Ogres',
    race: 'Ogre',
    nflFlavor: 'Buffalo snow brutality, blue-collar might',
    tactics: tune({
      bashIndex: 95,
      passingFrequency: 10,
      pace: 30,
      foulFrequency: 70,
      cageAffinity: 70,
      patience: 65,
      stallTendency: 60,
      rerollUsage: 30,
      gfiTolerance: 20,
    }),
    tv: 1100,
  },
] as const) as readonly ProTeamProfile[];

export type ProTeamId = (typeof PRO_LEAGUE_TEAMS)[number]['id'];

/** Lookup helper — keyed by `ProTeamProfile.id`. Frozen at module load. */
export const PRO_LEAGUE_TEAM_BY_ID: Readonly<Record<string, ProTeamProfile>> = Object.freeze(
  Object.fromEntries(PRO_LEAGUE_TEAMS.map((t) => [t.id, t]))
);
