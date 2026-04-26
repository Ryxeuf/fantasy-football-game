/**
 * Team logos (O.8b cosmetiques visuels — logos equipe).
 *
 * Generates programmatic SVG emblems for each roster, using the canonical
 * roster colors from {@link ROSTER_COLORS} and a per-roster shape + glyph.
 *
 * Why a programmatic SVG approach?
 *   - zero asset shipping cost (no PNG/atlas to maintain)
 *   - deterministic output, easily testable as pure strings
 *   - usable both server-side (OG images, PDF export) and client-side (React)
 *   - per-roster colors automatically picked up via {@link getTeamColors}
 *   - new rosters only need a 2-line entry to get a fresh emblem
 *
 * Renderer-agnostic: returns a self-contained SVG string. The web client
 * wraps this via the `<TeamLogo>` React component; the mobile / server side
 * can also embed it as `dangerouslySetInnerHTML` or convert to PNG via
 * `@vercel/og` / `satori` when needed.
 */
import { DEFAULT_TEAM_COLORS, ROSTER_COLORS, type TeamColors } from './team-colors';

/** Available silhouette shapes — kept small on purpose for visual coherence. */
export const TEAM_LOGO_SHAPES = ['shield', 'circle', 'diamond', 'hexagon'] as const;
export type TeamLogoShape = (typeof TEAM_LOGO_SHAPES)[number];

export interface TeamLogo {
  /** Outer silhouette shape. */
  shape: TeamLogoShape;
  /** 1 to 3 character monogram drawn inside the shape (e.g. "S", "Sk"). */
  glyph: string;
}

/** Neutral fallback emblem used for unknown / missing roster slugs. */
export const DEFAULT_TEAM_LOGO: TeamLogo = {
  shape: 'circle',
  glyph: 'NA',
};

/**
 * Per-roster emblem definitions. Keys MUST match the slugs of
 * {@link ROSTER_COLORS} (and therefore of `positions.ts`). The
 * `team-logos.test.ts` suite enforces exhaustive coverage.
 *
 * Glyphs are rendered as drawn-in text — keep them ASCII to ensure
 * consistent font rendering across browsers / generators.
 */
export const ROSTER_LOGOS: Record<string, TeamLogo> = {
  // Imperial / Order
  human: { shape: 'shield', glyph: 'H' },
  imperial_nobility: { shape: 'shield', glyph: 'IN' },
  old_world_alliance: { shape: 'shield', glyph: 'OW' },

  // Dwarves
  dwarf: { shape: 'hexagon', glyph: 'D' },
  chaos_dwarf: { shape: 'hexagon', glyph: 'CD' },
  gnome: { shape: 'hexagon', glyph: 'G' },

  // Elves
  high_elf: { shape: 'diamond', glyph: 'HE' },
  wood_elf: { shape: 'diamond', glyph: 'WE' },
  dark_elf: { shape: 'diamond', glyph: 'DE' },
  elven_union: { shape: 'diamond', glyph: 'EU' },
  slann: { shape: 'diamond', glyph: 'SL' },

  // Greenskins
  orc: { shape: 'circle', glyph: 'O' },
  black_orc: { shape: 'circle', glyph: 'BO' },
  goblin: { shape: 'circle', glyph: 'GO' },
  snotling: { shape: 'circle', glyph: 'SN' },
  underworld: { shape: 'circle', glyph: 'UW' },

  // Skaven
  skaven: { shape: 'circle', glyph: 'S' },

  // Lizards
  lizardmen: { shape: 'shield', glyph: 'LZ' },

  // Undead
  undead: { shape: 'shield', glyph: 'U' },
  necromantic_horror: { shape: 'shield', glyph: 'NH' },
  tomb_kings: { shape: 'shield', glyph: 'TK' },
  vampire: { shape: 'diamond', glyph: 'V' },

  // Chaos
  chaos_chosen: { shape: 'hexagon', glyph: 'CC' },
  chaos_renegade: { shape: 'hexagon', glyph: 'CR' },
  khorne: { shape: 'hexagon', glyph: 'K' },
  nurgle: { shape: 'hexagon', glyph: 'N' },

  // Misc
  amazon: { shape: 'shield', glyph: 'A' },
  halfling: { shape: 'circle', glyph: 'HF' },
  ogre: { shape: 'hexagon', glyph: 'OG' },
  norse: { shape: 'shield', glyph: 'NO' },
};

/**
 * Resolve the emblem for a given roster slug.
 *
 * Resolution order:
 *   1. canonical {@link ROSTER_LOGOS}[slug]
 *   2. {@link DEFAULT_TEAM_LOGO}
 */
export function getTeamLogo(rosterSlug: string | undefined): TeamLogo {
  if (!rosterSlug) return DEFAULT_TEAM_LOGO;
  return ROSTER_LOGOS[rosterSlug] ?? DEFAULT_TEAM_LOGO;
}

export interface RenderTeamLogoOptions {
  /** Pixel size of the resulting square SVG. Defaults to 64. Non-positive falls back to 64. */
  size?: number;
  /** Optional accessible title; when provided the SVG exposes role="img" + aria-label. */
  title?: string;
  /** Override the canonical roster colors. */
  override?: TeamColors;
  /** Override the canonical roster logo (useful for previews / fixtures). */
  logo?: TeamLogo;
}

const DEFAULT_SIZE = 64;
const VIEW_BOX = 64;

/**
 * Render a self-contained SVG string for the given roster.
 *
 * Pure function — no DOM, no side effects, deterministic output. Safe to
 * inline server-side (Next.js metadata, OG images) or browser-side via
 * `dangerouslySetInnerHTML`.
 */
export function renderTeamLogoSvg(
  rosterSlug: string | undefined,
  options: RenderTeamLogoOptions = {},
): string {
  const logo = options.logo ?? getTeamLogo(rosterSlug);
  const colors = options.override ?? (rosterSlug ? ROSTER_COLORS[rosterSlug] : undefined) ?? DEFAULT_TEAM_COLORS;
  const sizeOpt = options.size;
  const size = typeof sizeOpt === 'number' && sizeOpt > 0 ? Math.floor(sizeOpt) : DEFAULT_SIZE;

  const primary = toHexColor(colors.primary);
  const secondary = toHexColor(colors.secondary);

  const titleNode = options.title
    ? `<title>${escapeXml(options.title)}</title>`
    : '';
  const accessibilityAttrs = options.title
    ? ` role="img" aria-label="${escapeXml(options.title)}"`
    : ' aria-hidden="true"';

  const shapePath = renderShape(logo.shape, primary, secondary);
  const glyph = renderGlyph(logo.glyph, secondary);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
    `viewBox="0 0 ${VIEW_BOX} ${VIEW_BOX}"${accessibilityAttrs}>` +
    titleNode +
    shapePath +
    glyph +
    `</svg>`
  );
}

function renderShape(shape: TeamLogoShape, primary: string, secondary: string): string {
  const stroke = `stroke="${secondary}" stroke-width="3" stroke-linejoin="round"`;
  switch (shape) {
    case 'shield':
      // Heater-style shield silhouette inscribed in the 64x64 viewbox.
      return (
        `<path d="M32 4 L58 12 L58 32 C58 48 46 58 32 60 C18 58 6 48 6 32 L6 12 Z" ` +
        `fill="${primary}" ${stroke} />`
      );
    case 'circle':
      return `<circle cx="32" cy="32" r="28" fill="${primary}" ${stroke} />`;
    case 'diamond':
      return (
        `<path d="M32 4 L60 32 L32 60 L4 32 Z" fill="${primary}" ${stroke} />`
      );
    case 'hexagon':
      return (
        `<path d="M32 4 L57 18 L57 46 L32 60 L7 46 L7 18 Z" ` +
        `fill="${primary}" ${stroke} />`
      );
  }
}

function renderGlyph(glyph: string, color: string): string {
  // 1 char -> larger font; 2 chars -> medium; 3 chars -> compact.
  const fontSize = glyph.length >= 3 ? 18 : glyph.length === 2 ? 24 : 32;
  return (
    `<text x="32" y="32" text-anchor="middle" dominant-baseline="central" ` +
    `font-family="Verdana, Geneva, sans-serif" font-weight="700" ` +
    `font-size="${fontSize}" fill="${color}">${escapeXml(glyph)}</text>`
  );
}

function toHexColor(value: number): string {
  const clamped = Math.max(0, Math.min(0xffffff, Math.floor(value)));
  return `#${clamped.toString(16).padStart(6, '0')}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
