/**
 * Générateur de noms d'équipe Blood Bowl par roster (tâche O.8a — Sprint 22+).
 *
 * Approche : chaque roster est mappé sur une "famille" thématique
 * (ex: imperial_nobility → human, black_orc → orc) qui possède une banque
 * de préfixes (adjectifs / lieux) et de suffixes (substantifs). Le nom
 * généré est `${préfixe} ${suffixe}`.
 *
 * Les choix sont tirés via un RNG :
 *   - injectable (`opts.rng`) pour les tests déterministes
 *   - sinon dérivé d'une seed (`opts.seed`, défaut : aléatoire) via
 *     `makeRNG` du game-engine — jamais `Math.random()` en code métier.
 *
 * Pour un roster inconnu, on retombe sur la famille `generic` (vocabulaire
 * neutre fantasy) plutôt que de jeter — utile si un nouveau slug arrive.
 */

import { randomBytes } from "crypto";
import { makeRNG } from "@bb/game-engine";

export interface NameFamily {
  prefixes: string[];
  suffixes: string[];
}

/** Banques de mots par famille thématique. */
export const TEAM_NAME_FAMILIES: Record<string, NameFamily> = {
  skaven: {
    prefixes: [
      "Skavenblight",
      "Clan Pestilens",
      "Hellpit",
      "Underempire",
      "Warp",
      "Pestilent",
      "Plague",
      "Verminous",
      "Sneaky",
      "Deathmaster",
    ],
    suffixes: [
      "Rats",
      "Vermin",
      "Skitters",
      "Plague Bringers",
      "Warpstone Runners",
      "Gutter Stalkers",
      "Stormvermin",
      "Pestilens",
      "Nightrunners",
      "Tail-Twitchers",
    ],
  },

  lizardmen: {
    prefixes: [
      "Hexoatl",
      "Itza",
      "Tlaxtlan",
      "Xlanhuapec",
      "Sotek",
      "Spawning",
      "Sun-Bathed",
      "Old Ones",
      "Saurus",
      "Chameleon",
    ],
    suffixes: [
      "Saurus",
      "Skinks",
      "Kroxigors",
      "Coatls",
      "Cold Ones",
      "Temple Guards",
      "Predators",
      "Chameleons",
      "Sun-Heralds",
      "Spawnings",
    ],
  },

  dwarf: {
    prefixes: [
      "Karak",
      "Zhufbar",
      "Karaz-a-Karak",
      "Kraka",
      "Iron",
      "Stout",
      "Grumbling",
      "Throng of",
      "Beard-Braiders",
      "Stonebound",
    ],
    suffixes: [
      "Forgehammers",
      "Axe-Wielders",
      "Stonebeards",
      "Hold-Defenders",
      "Anvil-Smiths",
      "Slayers",
      "Longbeards",
      "Ironbreakers",
      "Deathrollers",
      "Gromril Knights",
    ],
  },

  elf: {
    prefixes: [
      "Athel",
      "Avelorn",
      "Naggaroth",
      "Caledor",
      "Loren",
      "Eternal",
      "Moonlit",
      "Silver",
      "Twilight",
      "Starwood",
    ],
    suffixes: [
      "Wardancers",
      "Swiftarrows",
      "Catchers",
      "Spellweavers",
      "Treesingers",
      "Phoenixes",
      "Silver Helms",
      "Shadow Blades",
      "Druchii",
      "Asur",
    ],
  },

  human: {
    prefixes: [
      "Reikland",
      "Altdorf",
      "Middenheim",
      "Talabheim",
      "Nuln",
      "Empire",
      "Bretonnian",
      "Marienburg",
      "Ostland",
      "Stirland",
    ],
    suffixes: [
      "Reavers",
      "Marauders",
      "Hammers",
      "Halberdiers",
      "Crusaders",
      "Gallants",
      "Knights",
      "Sentinels",
      "Wardens",
      "Stalwarts",
    ],
  },

  orc: {
    prefixes: [
      "Da",
      "Iron",
      "Bloodied",
      "Krushers",
      "Black Crag",
      "Red Eye",
      "Bonebreaker",
      "Skullsplitter",
      "Choppa",
      "Waaagh",
    ],
    suffixes: [
      "Boyz",
      "Krushas",
      "Stompas",
      "Choppas",
      "Black Orcs",
      "Big 'Uns",
      "Brawlers",
      "Skull-Smashers",
      "Greenskins",
      "Bonecrushers",
    ],
  },

  goblin: {
    prefixes: [
      "Sneaky",
      "Squig-Hopping",
      "Gitz",
      "Pointy-Hat",
      "Bombardier",
      "Fanatic",
      "Nasty",
      "Snotty",
      "Looney",
      "Twitchy",
    ],
    suffixes: [
      "Gitz",
      "Squig Riders",
      "Looneys",
      "Pointy Hats",
      "Bombers",
      "Fanatics",
      "Sneaks",
      "Backstabbers",
      "Hop-Alongs",
      "Bandits",
    ],
  },

  ogre: {
    prefixes: [
      "Iron Guts",
      "Maneater",
      "Bull",
      "Big",
      "Gut",
      "Tyrant's",
      "Mountain",
      "Smashing",
      "Bone Breaker",
      "Mawpit",
    ],
    suffixes: [
      "Maneaters",
      "Bulls",
      "Tyrants",
      "Gutbreakers",
      "Bonebreakers",
      "Crushers",
      "Mountains",
      "Smashers",
      "Mawmasters",
      "Glutters",
    ],
  },

  halfling: {
    prefixes: [
      "Mootland",
      "Pie-Eating",
      "Hayfoot",
      "Burrow",
      "Cabbage",
      "Brewmaster's",
      "Hill-Folk",
      "Greenwood",
      "Tubby",
      "Stout",
    ],
    suffixes: [
      "Hotpots",
      "Pie-Slingers",
      "Tree-Climbers",
      "Hayfooters",
      "Burrowers",
      "Cabbage Tossers",
      "Brewmasters",
      "Mootlanders",
      "Hill-Folk",
      "Tubbies",
    ],
  },

  chaos: {
    prefixes: [
      "Doombringer",
      "Skull-Crusher",
      "Eternal",
      "Chaos",
      "Warp-Touched",
      "Dark Pact",
      "Bloodbound",
      "Slaaneshi",
      "Tzeentchian",
      "Nurglesque",
    ],
    suffixes: [
      "Marauders",
      "Warriors",
      "Berserkers",
      "Daemonhost",
      "Doombringers",
      "Skull-Crushers",
      "Renegades",
      "Champions",
      "Forsaken",
      "Damned",
    ],
  },

  undead: {
    prefixes: [
      "Sylvanian",
      "Crypt",
      "Tomb",
      "Drakwald",
      "Mortis",
      "Necropolis",
      "Cursed",
      "Eternal",
      "Bone",
      "Shadowed",
    ],
    suffixes: [
      "Wights",
      "Wraiths",
      "Mummies",
      "Ghouls",
      "Crypt Horrors",
      "Skeletons",
      "Shamblers",
      "Banshees",
      "Necromancers",
      "Risen Dead",
    ],
  },

  amazon: {
    prefixes: [
      "Lustrian",
      "Jungle",
      "Coatl",
      "Sun-Blessed",
      "Vine-Striders",
      "Amazon",
      "Quetzl",
      "Itza",
      "Kroxa",
      "Spear-Throwers",
    ],
    suffixes: [
      "Huntresses",
      "Spear-Sisters",
      "Vine-Striders",
      "Coatl Riders",
      "Sun-Blessed",
      "Catchers",
      "Wardens",
      "Predators",
      "Jungle Stalkers",
      "Eagle Warriors",
    ],
  },

  norse: {
    prefixes: [
      "Norscan",
      "Frostbeard",
      "Ulfsark",
      "Bjornling",
      "Stormbreaker",
      "Sea-Wolf",
      "Wolfship",
      "Iron Reaver",
      "Frozen Crag",
      "Snowbound",
    ],
    suffixes: [
      "Bulldozers",
      "Berserkers",
      "Reavers",
      "Wolves",
      "Sea-Raiders",
      "Frostbeards",
      "Ulfwerenar",
      "Marauders",
      "Snow-Strikers",
      "Stormcallers",
    ],
  },

  generic: {
    prefixes: [
      "Iron",
      "Bloodied",
      "Eternal",
      "Stalwart",
      "Wild",
      "Burning",
      "Stormcalled",
      "Thunder",
      "Black",
      "Crimson",
    ],
    suffixes: [
      "Champions",
      "Wardens",
      "Reavers",
      "Marauders",
      "Crushers",
      "Thunderers",
      "Stalwarts",
      "Predators",
      "Brawlers",
      "Stormbringers",
    ],
  },
};

/** Mapping roster slug → famille thématique. */
const ROSTER_FAMILY_MAP: Record<string, string> = {
  skaven: "skaven",
  underworld: "skaven",
  lizardmen: "lizardmen",
  slann: "lizardmen",
  dwarf: "dwarf",
  chaos_dwarf: "dwarf",
  wood_elf: "elf",
  dark_elf: "elf",
  high_elf: "elf",
  elven_union: "elf",
  human: "human",
  imperial_nobility: "human",
  old_world_alliance: "human",
  bretonnian: "human",
  orc: "orc",
  black_orc: "orc",
  goblin: "goblin",
  snotling: "goblin",
  halfling: "halfling",
  ogre: "ogre",
  chaos_chosen: "chaos",
  chaos_renegade: "chaos",
  khorne: "chaos",
  nurgle: "chaos",
  undead: "undead",
  necromantic_horror: "undead",
  vampire: "undead",
  tomb_kings: "undead",
  amazon: "amazon",
  norse: "norse",
  gnome: "halfling",
};

export function rosterToFamily(roster: string): string {
  return ROSTER_FAMILY_MAP[roster] ?? "generic";
}

export interface GenerateTeamNameOptions {
  /** RNG injectable (priorité sur `seed` ; pratique pour tests). */
  rng?: () => number;
  /** Seed déterministe ; ignorée si `rng` est fourni. */
  seed?: string;
}

function pick<T>(items: readonly T[], rng: () => number): T {
  if (items.length === 0) {
    throw new Error("pick: items must be non-empty");
  }
  const idx = Math.floor(rng() * items.length);
  return items[Math.min(idx, items.length - 1)];
}

export function generateTeamName(
  roster: string,
  opts: GenerateTeamNameOptions = {},
): string {
  const family = rosterToFamily(roster);
  const bank = TEAM_NAME_FAMILIES[family] ?? TEAM_NAME_FAMILIES.generic;
  const rng =
    opts.rng ??
    makeRNG(opts.seed ?? `${roster}-${randomBytes(8).toString("hex")}`);
  const prefix = pick(bank.prefixes, rng);
  const suffix = pick(bank.suffixes, rng);
  return `${prefix} ${suffix}`;
}
