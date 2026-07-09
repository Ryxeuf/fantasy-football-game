import { getRosterName, getTeamColors } from "@bb/game-engine";

/**
 * Label coloré d'un roster : nom lisible (« Rois des tombes ») sur fond
 * aux couleurs canoniques du roster (`ROSTER_COLORS` du moteur), avec
 * texte noir/blanc choisi par luminance pour rester lisible.
 *
 * À utiliser partout où une équipe affiche sa race — jamais le slug brut.
 */

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

/** Texte sombre sur fond clair, blanc sinon (luminance perceptuelle). */
function contrastText(color: number): string {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 150 ? "#1c1917" : "#ffffff";
}

export default function RosterBadge({
  slug,
  name,
  className = "",
}: {
  /** Slug technique du roster (ex: "tomb_kings"). */
  slug: string;
  /** Nom déjà résolu (ex: `raceName` de l'API) — sinon dérivé du slug. */
  name?: string | null;
  className?: string;
}) {
  const colors = getTeamColors(slug);
  const background = hex(colors.primary);
  const label = name || getRosterName(slug);
  return (
    <span
      data-testid={`roster-badge-${slug}`}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 ${className}`}
      style={{
        backgroundColor: background,
        color: contrastText(colors.primary),
        border: `1px solid ${hex(colors.secondary)}55`,
      }}
      title={label}
    >
      {label}
    </span>
  );
}
