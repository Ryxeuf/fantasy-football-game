/**
 * Team visual identity — per-roster primary/secondary colors.
 *
 * Foundation for task H.6 "Sprite sheets par equipe". Before shipping actual
 * sprite sheet assets, we need per-team visual differentiation on the board.
 * This module centralises canonical Blood Bowl roster colors so `PixiBoard`
 * (and, later, the sprite loader) can tint players by roster instead of
 * defaulting to the hardcoded red/blue team A/B palette.
 *
 * Follow-up sub-tasks:
 *   - asset loader + sprite registry using @pixi/assets
 *   - PNG/JSON sprite sheets shipped under `apps/web/public/images/team-sprites/`
 *   - PixiBoard to swap circle Graphics for Pixi Sprites
 *   - Prisma schema migration to persist per-roster color overrides
 */

/** RGB colors expressed as 24-bit integers, compatible with Pixi Graphics / tint. */
export interface TeamColors {
  /** Main jersey color (circle fill / sprite tint base). */
  primary: number;
  /** Accent color used for outlines, trims and secondary details. */
  secondary: number;
}

/**
 * Neutral fallback palette. Intentionally close to the legacy red/blue scheme
 * so that disabling per-roster colors is visually backwards compatible.
 */
export const DEFAULT_TEAM_COLORS: TeamColors = {
  primary: 0x888888,
  secondary: 0xffffff,
};

/**
 * Canonical roster colors — inspired by Games Workshop / Blood Bowl lore.
 * Keys MUST match the roster slugs defined in `positions.ts` and
 * `season3-rosters.ts`. New rosters should add an entry here; the
 * `team-colors.test.ts` suite enforces exhaustive coverage.
 */
export const ROSTER_COLORS: Record<string, TeamColors> = {
  // --- Classic Imperial / Order ---
  human: { primary: 0x1e3a8a, secondary: 0xfbbf24 }, // Reikland blue & gold
  imperial_nobility: { primary: 0x7f1d1d, secondary: 0xf3e8c5 }, // deep red & cream
  old_world_alliance: { primary: 0x4b5563, secondary: 0xfbbf24 },

  // --- Dwarves ---
  dwarf: { primary: 0x1e40af, secondary: 0xfcd34d }, // royal blue & gold
  chaos_dwarf: { primary: 0x111827, secondary: 0xdc2626 }, // black & red
  gnome: { primary: 0x065f46, secondary: 0xfde68a },

  // --- Elves ---
  high_elf: { primary: 0xfafafa, secondary: 0x1e3a8a }, // white & sapphire
  wood_elf: { primary: 0x14532d, secondary: 0x84cc16 }, // forest greens
  dark_elf: { primary: 0x1f2937, secondary: 0x7c3aed }, // black & violet
  elven_union: { primary: 0x1e40af, secondary: 0xfafafa },
  slann: { primary: 0x0891b2, secondary: 0xfacc15 }, // teal & gold

  // --- Orcs / Goblins ---
  orc: { primary: 0x166534, secondary: 0x111827 }, // orc green & black
  black_orc: { primary: 0x052e16, secondary: 0xfacc15 },
  goblin: { primary: 0x4d7c0f, secondary: 0xfbbf24 },
  snotling: { primary: 0x84cc16, secondary: 0x1c1917 },
  underworld: { primary: 0x1f2937, secondary: 0x22c55e },

  // --- Skaven / Rats ---
  skaven: { primary: 0x92400e, secondary: 0xd6d3d1 }, // rust & bone

  // --- Lizards / Amphibians ---
  lizardmen: { primary: 0x15803d, secondary: 0xfacc15 },

  // --- Undead ---
  undead: { primary: 0x4c1d95, secondary: 0xe5e7eb },
  necromantic_horror: { primary: 0x312e81, secondary: 0xc7d2fe },
  tomb_kings: { primary: 0xb45309, secondary: 0x1c1917 }, // sand & obsidian
  vampire: { primary: 0x7f1d1d, secondary: 0x1c1917 }, // blood & black

  // --- Chaos ---
  chaos_chosen: { primary: 0x1c1917, secondary: 0x9a3412 },
  chaos_renegade: { primary: 0x78350f, secondary: 0xd97706 },
  khorne: { primary: 0x991b1b, secondary: 0x1c1917 }, // blood red & black
  nurgle: { primary: 0x3f6212, secondary: 0xa3a3a3 }, // rot green & grey

  // --- Others ---
  amazon: { primary: 0xa16207, secondary: 0x14532d }, // bronze & jungle
  halfling: { primary: 0x65a30d, secondary: 0xfbbf24 }, // meadow & butter
  ogre: { primary: 0x78350f, secondary: 0xfde68a },
  norse: { primary: 0x0c4a6e, secondary: 0xe0f2fe }, // ice & snow
};

/**
 * Resolve the visual colors for a given roster.
 *
 * Resolution order:
 *   1. explicit `override` argument (e.g. from a `TeamRoster.primaryColor`)
 *   2. canonical `ROSTER_COLORS[slug]`
 *   3. `DEFAULT_TEAM_COLORS`
 *
 * @param rosterSlug - roster slug as defined in `positions.ts`
 * @param override - optional override (primary + secondary required)
 */
export function getTeamColors(
  rosterSlug: string | undefined,
  override?: TeamColors,
): TeamColors {
  if (override) return override;
  if (!rosterSlug) return DEFAULT_TEAM_COLORS;
  return ROSTER_COLORS[rosterSlug] ?? DEFAULT_TEAM_COLORS;
}
