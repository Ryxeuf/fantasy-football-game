/**
 * Skill categories + position access tables (Lot 4.D.2).
 *
 * Pourquoi
 * --------
 * Avant ce lot, le level-up applier (Lot 3.C.4) tirait dans un pool
 * unique GENERAL — un Lineman et un Catcher recevaient la meme
 * distribution de skills, ce qui aplatissait completement la
 * diversite BB classique.
 *
 * BB Season 2/3 definit 5 categories de skills (G/A/S/P/M). Chaque
 * position a acces aux pools en `primary` (1/6 doubles non requis,
 * cost 20k) ou `secondary` (cost 30k, plus rare en BB). Cette table
 * encode l'acces canonique par position et la categorisation des
 * skills par slug.
 *
 * Architecture
 * ------------
 *  - `SkillCategory` : union 'G'|'A'|'S'|'P'|'M'.
 *  - `SKILLS_BY_CATEGORY` : pool exhaustif des skills BB officiels
 *    par categorie. Slugs alignes sur game-engine registry.
 *  - `SKILL_CATEGORY` : reverse lookup slug -> category.
 *  - `POSITION_SKILL_ACCESS` : par position, liste des categories
 *    primary / secondary. Positions inconnues -> fallback Lineman.
 *  - `skillSourceForPlayer(position, slug)` : 'primary' | 'secondary'
 *    | 'unavailable' selon l'acces du joueur. Sert a computer le TV
 *    + filtrer les pools du level-up applier.
 *  - `getEligiblePoolFor(position, source)` : retourne la liste des
 *    slugs accessibles au joueur pour cette source (primary ou
 *    secondary). Sert au pickAdvancement etendu.
 *
 * Hors scope MVP
 * --------------
 *  - Skill cap par player (BB rules : 6 skills max sans lvl-up
 *    extra). Pas applique ici, le pool epuise via le filter.
 *  - Skill restrictions par race (ex: Bull Centaur Block = always
 *    primary General). On utilise la position generique ici. Lot
 *    futur si besoin.
 */

export type SkillCategory = "G" | "A" | "S" | "P" | "M";

/**
 * Pools BB officiels par categorie. Pas exhaustif (~25 skills par
 * pool en BB total) mais couvre les plus communs / influents
 * tactiquement. A etendre si on observe des trous en prod.
 */
export const SKILLS_BY_CATEGORY: Record<SkillCategory, readonly string[]> = {
  G: [
    "block",
    "dauntless",
    "dirty_player",
    "fend",
    "frenzy",
    "kick",
    "pro",
    "shadowing",
    "strip_ball",
    "sure_hands",
    "tackle",
    "wrestle",
  ],
  A: [
    "catch",
    "diving_catch",
    "diving_tackle",
    "dodge",
    "jump_up",
    "leap",
    "side_step",
    "sneaky_git",
    "sprint",
    "sure_feet",
  ],
  S: [
    "break_tackle",
    "grab",
    "guard",
    "juggernaut",
    "mighty_blow",
    "multiple_block",
    "piling_on",
    "stand_firm",
    "strong_arm",
    "thick_skull",
  ],
  P: [
    "accurate",
    "cloud_burster",
    "dump_off",
    "fumblerooskie",
    "hail_mary_pass",
    "leader",
    "nerves_of_steel",
    "on_the_ball",
    "pass",
    "running_pass",
    "safe_pass",
  ],
  M: [
    "big_hand",
    "claws",
    "disturbing_presence",
    "extra_arms",
    "foul_appearance",
    "horns",
    "iron_hard_skin",
    "monstrous_mouth",
    "prehensile_tail",
    "tentacles",
    "two_heads",
    "very_long_legs",
  ],
};

/** Reverse lookup : skill slug -> category. */
export const SKILL_CATEGORY: Record<string, SkillCategory> = (() => {
  const out: Record<string, SkillCategory> = {};
  for (const [cat, list] of Object.entries(SKILLS_BY_CATEGORY)) {
    for (const slug of list) {
      out[slug] = cat as SkillCategory;
    }
  }
  return out;
})();

export interface PositionSkillAccess {
  readonly primary: readonly SkillCategory[];
  readonly secondary: readonly SkillCategory[];
}

/**
 * Acces aux pools par position. Source : Blood Bowl Season 2/3
 * starter rosters tier list. Les positions absentes tombent sur
 * le default `LINEMAN_FALLBACK` (G primary, A/S/P secondary).
 *
 * Notes :
 *   - Big Guy = S primary + G secondary (peu mobile, focus brutal)
 *   - Catcher = G/A primary, S/P secondary (reception + esquive)
 *   - Blitzer = G/S primary, A secondary (versatile bashy)
 *   - Thrower = G/P primary, A secondary (lanceur skill+passes)
 *   - Skink = G/A primary, S/P secondary (catcher Lizardmen)
 *   - Saurus = G/S primary, A secondary (blocker Lizardmen)
 *   - Zombie/Skeleton = Lineman-equivalent
 */
export const POSITION_SKILL_ACCESS: Record<string, PositionSkillAccess> = {
  Lineman: { primary: ["G"], secondary: ["A", "S", "P"] },
  Linewoman: { primary: ["G"], secondary: ["A", "S", "P"] },
  Zombie: { primary: ["G"], secondary: ["S"] },
  Skeleton: { primary: ["G"], secondary: ["S"] },
  Catcher: { primary: ["G", "A"], secondary: ["S", "P"] },
  Blitzer: { primary: ["G", "S"], secondary: ["A"] },
  Thrower: { primary: ["G", "P"], secondary: ["A"] },
  Runner: { primary: ["G", "A"], secondary: ["S", "P"] },
  Blocker: { primary: ["G", "S"], secondary: ["A"] },
  Skink: { primary: ["G", "A"], secondary: ["S"] },
  Saurus: { primary: ["G", "S"], secondary: ["A"] },
  "Big Guy": { primary: ["S"], secondary: ["G"] },
};

const LINEMAN_FALLBACK: PositionSkillAccess = {
  primary: ["G"],
  secondary: ["A", "S", "P"],
};

export type SkillSource = "primary" | "secondary" | "unavailable";

/**
 * Determine si un slug est accessible au joueur en `primary`,
 * `secondary` ou `unavailable`. Utilise par :
 *  - `pro-roster-tv` pour le pricing 20k vs 30k
 *  - `pro-roster-level-up` pour filtrer le pool de pick
 */
export function skillSourceForPlayer(
  position: string,
  slug: string,
): SkillSource {
  const access = POSITION_SKILL_ACCESS[position] ?? LINEMAN_FALLBACK;
  const cat = SKILL_CATEGORY[slug];
  if (!cat) return "unavailable";
  if (access.primary.includes(cat)) return "primary";
  if (access.secondary.includes(cat)) return "secondary";
  return "unavailable";
}

/**
 * Liste des slugs eligibles au joueur pour une source donnee
 * (primary ou secondary). Union de tous les pools des categories
 * accessibles a cette source.
 */
export function getEligiblePoolFor(
  position: string,
  source: "primary" | "secondary",
): readonly string[] {
  const access = POSITION_SKILL_ACCESS[position] ?? LINEMAN_FALLBACK;
  const cats = source === "primary" ? access.primary : access.secondary;
  const out: string[] = [];
  for (const cat of cats) {
    out.push(...SKILLS_BY_CATEGORY[cat]);
  }
  return out;
}
