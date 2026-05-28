/**
 * Dérivation des attributs Blood Bowl d'un joueur NFL Fantasy.
 *
 * Contexte
 * --------
 * `NflPlayer.bbPosition` est déjà dérivé à l'ingest via
 * `getBbPosition(nflPosition, race)`. Ses **stats** (MA/ST/AG/PA/AV) et
 * **compétences de base** ne l'étaient pas : tous les joueurs avaient
 * `bbStats: {}` et `bbSkills: []`. Ce module dérive les deux depuis la
 * source de vérité des rosters BB Saison 3 (`SEASON_THREE_ROSTERS`).
 *
 * Pour chaque (BbRace, BbPosition), on désigne **une** position de roster
 * S3 équivalente (mapping curé `RACE_POSITION_TO_SLUG`). On lit alors ses
 * MA/ST/AG/PA/AV et ses compétences (CSV) depuis `PositionDefinition`.
 *
 * Pour les positions sans équivalent direct (ex: Norse n'a pas de Catcher
 * en S3), on retombe sur la position la plus proche (souvent le specialist
 * AG-primary). Les mappings sont best-effort et peuvent être affinés.
 */

import type { BbPosition, BbRace } from "@bb/nfl-mapper";
import {
  TEAM_ROSTERS_BY_RULESET,
  type PositionDefinition,
} from "../../../../packages/game-engine/src/rosters/positions";

export interface BbAttributeStats {
  readonly ma: number;
  readonly st: number;
  readonly ag: number;
  readonly pa: number;
  readonly av: number;
}

export interface DerivedBbAttributes {
  readonly stats: BbAttributeStats;
  readonly skills: readonly string[];
  /** Slug de la position S3 utilisée comme source. Trace pour debug/audit. */
  readonly sourceSlug: string;
}

/**
 * Mapping curé (BbRace, BbPosition) -> slug de position dans SEASON_THREE_ROSTERS.
 * Sources : packages/game-engine/src/rosters/season3-rosters.ts.
 */
const RACE_POSITION_TO_SLUG: Readonly<
  Record<BbRace, Partial<Record<BbPosition, string>>>
> = {
  Skaven: {
    Lineman: "skaven_rat_des_clans_skaven",
    Thrower: "skaven_lanceur_skaven",
    GutterRunner: "skaven_coureur_d_egouts",
    StormVermin: "skaven_blitzer_skaven",
    RatOgre: "skaven_rat_ogre",
  },
  WoodElf: {
    Lineman: "wood_elf_trois_quart_elfe_sylvain",
    Thrower: "wood_elf_lanceur_elfe_sylvain",
    Catcher: "wood_elf_receveur_elfe_sylvain",
    Wardancer: "wood_elf_danceur_de_guerre",
    Treeman: "wood_elf_homme_arbre_de_la_loren",
  },
  Orc: {
    Lineman: "orc_trois_quart_orque",
    Goblin: "orc_trois_quart_gobelin",
    Thrower: "orc_lanceur_orque",
    Blitzer: "orc_blitzer_orque",
    BlackOrc: "orc_bloqueur_kosto",
    Troll: "orc_troll",
  },
  Human: {
    Lineman: "human_trois_quart",
    Thrower: "human_lanceur",
    Catcher: "human_receveur",
    Blitzer: "human_blitzer",
    Ogre: "human_ogre",
  },
  Norse: {
    Lineman: "norse_trois_quart",
    // Norse S3 n'a pas de Thrower dédié ; la Valkyrie est l'AG-primary
    // passing-capable, on l'utilise pour Thrower/Catcher/Runner.
    Thrower: "norse_valkyrie",
    Catcher: "norse_valkyrie",
    Runner: "norse_valkyrie",
    Berserker: "norse_berzerker",
    Ulfwerener: "norse_ulfwerener",
    Yhetee: "norse_yeti",
  },
  Dwarf: {
    // Dwarf S3 utilise "Trois-quart Nain" comme blocker de ligne ; pas de
    // position "Runner" dédiée hors Coureur Nain.
    Blocker: "dwarf_trois_quart_nain",
    Runner: "dwarf_coureur_nain",
    Blitzer: "dwarf_blitzer_nain",
    Trollslayer: "dwarf_tueur_de_trolls",
    Deathroller: "dwarf_roule_mort",
  },
  Khorne: {
    Bloodseeker: "khorne_marauder_sanglant",
    Khorngor: "khorne_khorngor",
    Bloodspawn: "khorne_rabatteur_sanglant",
    Bloodthirster: "khorne_rejeton_sanglant",
  },
  Necromantic: {
    Zombie: "necromantic_horror_trois_quart_zombie",
    Ghoul: "necromantic_horror_coureur_goule",
    // Wight -> Spectre (closest AG/G specialist undead).
    Wight: "necromantic_horror_spectre",
    FleshGolem: "necromantic_horror_golem_de_chair",
    Werewolf: "necromantic_horror_loup_garou",
  },
};

/** Clé du roster S3 pour une race (alignée sur season3-rosters.ts). */
const RACE_TO_ROSTER_KEY: Readonly<Record<BbRace, string>> = {
  Skaven: "skaven",
  WoodElf: "wood_elf",
  Orc: "orc",
  Human: "human",
  Norse: "norse",
  Dwarf: "dwarf",
  Khorne: "khorne",
  Necromantic: "necromantic_horror",
};

/** Cache : slug -> PositionDefinition (rempli paresseusement à la 1ère lecture). */
let positionBySlugCache: Map<string, PositionDefinition> | null = null;

function getPositionBySlug(): Map<string, PositionDefinition> {
  if (positionBySlugCache) return positionBySlugCache;
  const map = new Map<string, PositionDefinition>();
  const season3 = TEAM_ROSTERS_BY_RULESET.season_3;
  for (const roster of Object.values(season3)) {
    for (const pos of roster.positions) {
      map.set(pos.slug, pos);
    }
  }
  positionBySlugCache = map;
  return map;
}

function parseSkillsCsv(csv: string): readonly string[] {
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Dérive stats + skills BB pour un joueur (race + position BB).
 * Retourne `null` si la combinaison n'est pas supportée (race inconnue,
 * position non mappée, ou slug introuvable dans season3-rosters).
 */
export function deriveBbAttributes(
  race: BbRace,
  bbPosition: BbPosition,
): DerivedBbAttributes | null {
  const positionMap = RACE_POSITION_TO_SLUG[race];
  if (!positionMap) return null;
  const slug = positionMap[bbPosition];
  if (!slug) return null;
  const def = getPositionBySlug().get(slug);
  if (!def) return null;
  return {
    stats: { ma: def.ma, st: def.st, ag: def.ag, pa: def.pa, av: def.av },
    skills: parseSkillsCsv(def.skills),
    sourceSlug: slug,
  };
}

/** Pour les tests / debug : nombre total de mappings configurés. */
export function countDerivationMappings(): number {
  let n = 0;
  for (const m of Object.values(RACE_POSITION_TO_SLUG)) {
    n += Object.keys(m).length;
  }
  return n;
}
