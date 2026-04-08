/**
 * Animosity — BB2020 trait
 *
 * When a player with Animosity attempts to Hand Off or Pass to a disliked
 * teammate, roll a D6:
 *  - 1: The player refuses, their activation ends (NOT a turnover)
 *  - 2+: The action proceeds normally
 */

import type { Player, GameState, RNG } from '../core/types';
import { rollD6 } from '../utils/dice';
import { createLogEntry } from '../utils/logging';
import { hasSkill } from '../skills/skill-effects';

// ─── Lineage extraction ─────────────────────────────────────────

/**
 * Known race/lineage keywords in order of specificity.
 * Each entry: [keyword to match in slug, lineage label]
 *
 * The order matters: more-specific terms (e.g. "dark_elf", "rat_ogre",
 * "gutter_runner") must come before generic ones ("elf", "ogre").
 *
 * Covers both Season 2 (English slugs) and Season 3 (French slugs).
 */
const LINEAGE_KEYWORDS: ReadonlyArray<readonly [string, string]> = [
  // Compound / special cases first
  ['dark_elf', 'dark_elf'],
  ['dark-elf', 'dark_elf'],
  ['elf_noir', 'dark_elf'],     // S3 FR
  ['rat_ogre', 'skaven'],       // Rat Ogres are Skaven lineage
  ['rat-ogre', 'skaven'],
  ['gutter_runner', 'skaven'],  // Gutter Runners are Skaven
  ['gutter-runner', 'skaven'],
  ['coureur_d_egout', 'skaven'], // S3 FR gutter runner
  ['big_un', 'orc'],            // Big'Uns are Orcs
  ['big-un', 'orc'],
  // Standard races — order matters: specific before generic
  ['gobelin', 'goblin'],        // S3 FR
  ['goblin', 'goblin'],
  ['snotling', 'snotling'],
  ['skaven', 'skaven'],
  ['halfling', 'halfling'],
  ['dwarf', 'dwarf'],
  ['humain', 'human'],          // S3 FR
  ['human', 'human'],
  ['troll', 'troll'],           // before orc (orc_untrained_troll)
  ['treeman', 'treeman'],
  ['ogre', 'ogre'],             // before orc (orc_ prefix)
  ['orque', 'orc'],             // S3 FR
  ['orc', 'orc'],
  ['elf', 'elf'],
] as const;

/**
 * Extract the race/lineage of a player from their position slug.
 * Position slugs follow the pattern: `{team}_{race}_{role}` in most cases.
 */
export function extractLineage(positionSlug: string): string {
  const slug = positionSlug.toLowerCase();

  for (const [keyword, lineage] of LINEAGE_KEYWORDS) {
    if (slug.includes(keyword)) {
      return lineage;
    }
  }

  return 'unknown';
}

// ─── Animosity check ────────────────────────────────────────────

/** All animosity skill slugs */
const ANIMOSITY_SKILLS = [
  'animosity',
  'animosity-all',
  'animosity-underworld',
  'animosity-all-dwarf-halfling',
  'animosity-all-dwarf-human',
] as const;

/**
 * Determine which animosity variant (if any) the passer has.
 * Returns the slug of the first matching animosity skill, or null.
 */
function getAnimositySkill(player: Player): string | null {
  for (const slug of ANIMOSITY_SKILLS) {
    if (hasSkill(player, slug)) {
      return slug;
    }
  }
  return null;
}

/**
 * Check whether the passer's animosity is triggered against the target.
 *
 * Rules per variant:
 *  - animosity:                  different lineage → check
 *  - animosity-all:              always → check (dislikes ALL teammates)
 *  - animosity-underworld:       different lineage → check (same as generic)
 *  - animosity-all-dwarf-halfling: target is dwarf or halfling → check
 *  - animosity-all-dwarf-human:   target is dwarf or human → check
 */
export function hasAnimosityAgainst(passer: Player, target: Player): boolean {
  const animositySlug = getAnimositySkill(passer);
  if (!animositySlug) return false;

  const targetLineage = extractLineage(target.position);

  switch (animositySlug) {
    case 'animosity-all':
      return true;

    case 'animosity-all-dwarf-halfling':
      return targetLineage === 'dwarf' || targetLineage === 'halfling';

    case 'animosity-all-dwarf-human':
      return targetLineage === 'dwarf' || targetLineage === 'human';

    case 'animosity':
    case 'animosity-underworld': {
      const passerLineage = extractLineage(passer.position);
      return passerLineage !== targetLineage;
    }

    default:
      return false;
  }
}

// ─── D6 roll ────────────────────────────────────────────────────

export interface AnimosityResult {
  /** true = action proceeds, false = player refuses */
  passed: boolean;
  /** Updated game state (with log entries) */
  newState: GameState;
}

/**
 * Roll the Animosity D6 check.
 *
 * Call this ONLY when `hasAnimosityAgainst(passer, target)` is true.
 * - 1: Refuses — activation ends (not a turnover). Ball stays with passer.
 * - 2+: Action proceeds normally.
 */
export function checkAnimosity(
  state: GameState,
  passer: Player,
  target: Player,
  rng: RNG,
): AnimosityResult {
  const newState = structuredClone(state) as GameState;
  const roll = rollD6(rng);

  const checkLog = createLogEntry(
    'dice',
    `Animosité — ${passer.name} jet : ${roll}/2+ ${roll >= 2 ? '✓' : '✗'}`,
    passer.id,
    passer.team,
    { diceRoll: roll, targetNumber: 2 },
  );
  newState.gameLog = [...newState.gameLog, checkLog];

  if (roll === 1) {
    const refuseLog = createLogEntry(
      'action',
      `${passer.name} refuse de coopérer avec ${target.name} ! Activation terminée.`,
      passer.id,
      passer.team,
    );
    newState.gameLog = [...newState.gameLog, refuseLog];
    // NOT a turnover — just end the player's activation
    return { passed: false, newState };
  }

  return { passed: true, newState };
}
