/**
 * Pro League rookie generator — sprint Pro League lot 1.E.6.
 *
 * Génère procéduralement des `ProTeamRoster` pour :
 *  - Le **seed initial** d'une équipe (au démarrage d'une saison ou
 *    au seed de la ligue) — `seedTeamRoster(teamId, count)`.
 *  - Le **remplacement** des joueurs morts (status='dead') ou
 *    indisponibles longue durée — `replenishTeamRoster(teamId,
 *    targetSize)`.
 *  - Le **draft d'urgence** d'un rookie unique — `generateRookie(teamId)`.
 *
 * Stats par race basées sur les profils BB2020 (lineman position
 * uniquement au MVP — les positions exotiques type Blitzer / Thrower
 * arriveront avec le système de progression XP).
 *
 * Noms procéduraux : tirage simple dans des pools racial-flavored.
 * Pas d'IA — restera lisible et performant.
 *
 * Tirage RNG seedé par `teamId` + `Date.now()` pour permettre 2 appels
 * successifs de produire des joueurs différents (vs casualty service
 * qui est seedé par matchId pour reproductibilité).
 */

import { prisma } from "../prisma";

const TARGET_ROSTER_SIZE = 12;

export type Race = string;

export interface RookieStats {
  readonly ma: number;
  readonly st: number;
  readonly ag: number;
  readonly pa: number | null;
  readonly av: number;
  readonly position: string;
  readonly skills: readonly string[];
}

/** Stats baseline par race (BB2020 Lineman position). */
const RACE_BASELINE: Record<string, RookieStats> = {
  Orc: {
    ma: 5,
    st: 3,
    ag: 3,
    pa: 4,
    av: 10,
    position: "Lineman",
    skills: ["block"],
  },
  "Wood Elf": {
    ma: 7,
    st: 3,
    ag: 2,
    pa: 4,
    av: 8,
    position: "Lineman",
    skills: [],
  },
  Dwarf: {
    ma: 4,
    st: 3,
    ag: 4,
    pa: 4,
    av: 10,
    position: "Lineman",
    skills: ["block", "tackle"],
  },
  Halfling: {
    ma: 5,
    st: 2,
    ag: 4,
    pa: 5,
    av: 7,
    position: "Lineman",
    skills: ["dodge", "right_stuff"],
  },
  Ogre: {
    ma: 5,
    st: 5,
    ag: 4,
    pa: null,
    av: 10,
    position: "Big Guy",
    skills: ["mighty_blow", "thick_skull", "throw_team_mate"],
  },
  Skaven: {
    ma: 7,
    st: 3,
    ag: 3,
    pa: 4,
    av: 8,
    position: "Lineman",
    skills: [],
  },
  Lizardmen: {
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 9,
    position: "Skink",
    skills: ["dodge", "stunty"],
  },
  Amazon: {
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 8,
    position: "Linewoman",
    skills: ["dodge"],
  },
  Norse: {
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 8,
    position: "Lineman",
    skills: ["block"],
  },
  Undead: {
    ma: 6,
    st: 3,
    ag: 4,
    pa: 4,
    av: 8,
    position: "Zombie",
    skills: ["regeneration"],
  },
  "Tomb Kings": {
    ma: 4,
    st: 3,
    ag: 4,
    pa: 4,
    av: 9,
    position: "Skeleton",
    skills: ["regeneration", "thick_skull"],
  },
  "Pro Elf": {
    ma: 6,
    st: 3,
    ag: 3,
    pa: 3,
    av: 8,
    position: "Lineman",
    skills: [],
  },
  "Dark Elf": {
    ma: 6,
    st: 3,
    ag: 3,
    pa: 3,
    av: 8,
    position: "Lineman",
    skills: [],
  },
  Beastmen: {
    ma: 6,
    st: 3,
    ag: 4,
    pa: 4,
    av: 9,
    position: "Lineman",
    skills: ["horns"],
  },
};

const DEFAULT_STATS: RookieStats = {
  ma: 6,
  st: 3,
  ag: 3,
  pa: 4,
  av: 9,
  position: "Lineman",
  skills: [],
};

/** Pools de noms par race (mini-MVP). */
const NAME_POOLS: Record<string, { first: string[]; last: string[] }> = {
  Orc: {
    first: [
      "Grimgut",
      "Mox",
      "Skraz",
      "Gorbag",
      "Brakk",
      "Uzgar",
      "Krogan",
      "Bork",
      "Drogga",
      "Ugluk",
    ],
    last: [
      "Ironjaw",
      "Bonecruncher",
      "Skullsplitter",
      "Ratripper",
      "Bloodtusk",
      "Goretooth",
    ],
  },
  "Wood Elf": {
    first: [
      "Aelar",
      "Faelar",
      "Sylvian",
      "Thranduil",
      "Lirien",
      "Caelen",
      "Aerith",
      "Faelin",
    ],
    last: [
      "Leafshade",
      "Moonweaver",
      "Stardust",
      "Greenwhisper",
      "Silverbough",
    ],
  },
  Dwarf: {
    first: [
      "Thorgrim",
      "Borin",
      "Durok",
      "Grimnir",
      "Brokk",
      "Dwalin",
      "Balin",
      "Nori",
    ],
    last: [
      "Stoneshield",
      "Ironbeard",
      "Hammerhand",
      "Goldforge",
      "Anvilbreaker",
    ],
  },
  Halfling: {
    first: [
      "Pippin",
      "Frodo",
      "Sam",
      "Merry",
      "Bilbo",
      "Otho",
      "Bungo",
      "Drogo",
    ],
    last: [
      "Cheesetoes",
      "Pieface",
      "Buttercup",
      "Honeyfoot",
      "Tubblesworth",
    ],
  },
  Ogre: {
    first: ["Bork", "Gronk", "Mash", "Ugg", "Zog", "Brog"],
    last: ["Bonecruncher", "Smashface", "Ribcrusher"],
  },
  Skaven: {
    first: ["Skritch", "Rikkit", "Snik", "Verminkin", "Gnaw"],
    last: ["Quicktail", "Blackwhisker", "Sneakypaw", "Plagueclaw"],
  },
  Lizardmen: {
    first: ["Sotek", "Tehenhauin", "Kroq", "Tlaqua", "Itzl"],
    last: ["Sunblade", "Coldscale", "Stonecharger", "Quickfeather"],
  },
  Amazon: {
    first: ["Itzpapalotl", "Citlali", "Xiuhcoatl", "Yoltzin", "Mahuizoh"],
    last: ["Spearfeather", "Jadeheart", "Goldenfang", "Wildwind"],
  },
  Norse: {
    first: [
      "Ragnar",
      "Bjorn",
      "Eirik",
      "Sigurd",
      "Olaf",
      "Ulfgar",
      "Arngrim",
    ],
    last: ["Frostfist", "Stormbreaker", "Wolfclaw", "Trollbane"],
  },
  Undead: {
    first: ["Mortimer", "Cadaver", "Lich", "Ghul"],
    last: ["Boneless", "Pallidface", "Rotbreath", "Dustcrown"],
  },
  "Tomb Kings": {
    first: ["Khepri", "Setep", "Anhur", "Mereb", "Khentkaues"],
    last: ["Sandwalker", "Goldcurse", "Dustlord", "Painstone"],
  },
  "Pro Elf": {
    first: ["Aelfric", "Lothric", "Tyrian", "Maelis", "Helior"],
    last: ["Stormcrest", "Skywind", "Lightstride"],
  },
  "Dark Elf": {
    first: ["Malus", "Vaelyn", "Drachau", "Khaine", "Hellebron"],
    last: ["Bloodspike", "Shadowblade", "Soulrender", "Doomwhisper"],
  },
  Beastmen: {
    first: ["Khazrak", "Gor", "Ungor", "Khorne", "Slaaneshi"],
    last: ["Cloventooth", "Gorehoof", "Blackmane"],
  },
};

const DEFAULT_NAMES = {
  first: ["Player"],
  last: ["Rookie"],
};

/** RNG mulberry32 — petit, déterministe, suffisant ici. */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function pickRandom<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Génère un nom + stats baseline pour un rookie de la race donnée.
 * Pure (RNG injecté) — testable sans I/O.
 */
export function generateRookieData(
  race: string,
  rng: () => number,
): { name: string; stats: RookieStats } {
  const pool = NAME_POOLS[race] ?? DEFAULT_NAMES;
  const first = pickRandom(pool.first, rng);
  const last = pickRandom(pool.last, rng);
  const stats = RACE_BASELINE[race] ?? DEFAULT_STATS;
  return {
    name: `${first} ${last}`,
    stats,
  };
}

export interface SeedTeamRosterResult {
  readonly teamId: string;
  readonly created: number;
  readonly skipped: number;
  readonly skipReason?: string;
}

/**
 * Crée `count` rookies pour une équipe au seed initial. No-op si
 * l'équipe a déjà des joueurs (idempotent).
 */
export async function seedTeamRoster(
  teamId: string,
  count: number = TARGET_ROSTER_SIZE,
): Promise<SeedTeamRosterResult> {
  const team = await prisma.proTeam.findUnique({
    where: { id: teamId },
    select: { id: true, race: true, slug: true },
  });
  if (!team) {
    throw new Error(`ProTeam '${teamId}' introuvable`);
  }
  const existing = await prisma.proTeamRoster.count({ where: { teamId } });
  if (existing > 0) {
    return {
      teamId,
      created: 0,
      skipped: existing,
      skipReason: "roster_already_seeded",
    };
  }
  const rng = mulberry32(hashSeed(`seed:${teamId}:${team.slug}`));
  let created = 0;
  for (let i = 0; i < count; i += 1) {
    const { name, stats } = generateRookieData(team.race as string, rng);
    await prisma.proTeamRoster.create({
      data: {
        teamId,
        name,
        position: stats.position,
        ma: stats.ma,
        st: stats.st,
        ag: stats.ag,
        pa: stats.pa,
        av: stats.av,
        skills: stats.skills as unknown as object,
        status: "active",
      },
    });
    created += 1;
  }
  return { teamId, created, skipped: 0 };
}

export interface ReplenishResult {
  readonly teamId: string;
  readonly activeBefore: number;
  readonly created: number;
  readonly targetSize: number;
}

/**
 * Si une équipe a moins de `targetSize` joueurs `active`, génère des
 * rookies pour atteindre la cible. Idempotent (rien à faire si déjà
 * complet).
 */
export async function replenishTeamRoster(
  teamId: string,
  targetSize: number = TARGET_ROSTER_SIZE,
): Promise<ReplenishResult> {
  const team = await prisma.proTeam.findUnique({
    where: { id: teamId },
    select: { id: true, race: true, slug: true },
  });
  if (!team) {
    throw new Error(`ProTeam '${teamId}' introuvable`);
  }
  const activeBefore = await prisma.proTeamRoster.count({
    where: { teamId, status: "active" },
  });
  const missing = Math.max(0, targetSize - activeBefore);
  if (missing === 0) {
    return { teamId, activeBefore, created: 0, targetSize };
  }
  // Seed avec teamId + timestamp pour ne pas re-générer les mêmes
  // noms d'un appel à l'autre (cas casualties multiples sur saison).
  const rng = mulberry32(
    hashSeed(`replenish:${teamId}:${team.slug}:${Date.now()}`),
  );
  let created = 0;
  for (let i = 0; i < missing; i += 1) {
    const { name, stats } = generateRookieData(team.race as string, rng);
    await prisma.proTeamRoster.create({
      data: {
        teamId,
        name,
        position: stats.position,
        ma: stats.ma,
        st: stats.st,
        ag: stats.ag,
        pa: stats.pa,
        av: stats.av,
        skills: stats.skills as unknown as object,
        status: "active",
      },
    });
    created += 1;
  }
  return { teamId, activeBefore, created, targetSize };
}

/**
 * Cron sweep : pour chaque équipe avec roster `active` < target,
 * génère les rookies manquants. Erreur par équipe isolée.
 */
export async function sweepRookieReplenish(
  targetSize: number = TARGET_ROSTER_SIZE,
): Promise<{ inspected: number; replenished: number; failed: number }> {
  const teams = await prisma.proTeam.findMany({
    select: { id: true },
  });
  let replenished = 0;
  let failed = 0;
  for (const t of teams) {
    try {
      const out = await replenishTeamRoster(t.id as string, targetSize);
      if (out.created > 0) replenished += 1;
    } catch {
      failed += 1;
    }
  }
  return { inspected: teams.length, replenished, failed };
}
