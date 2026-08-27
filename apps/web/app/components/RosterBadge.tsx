"use client";

import { getTeamColors } from "@bb/game-engine";
import { useRosterCatalog } from "../lib/roster-catalog";

/**
 * Label coloré d'un roster : nom lisible (« Rois des tombes ») sur fond
 * aux couleurs canoniques du roster (`ROSTER_COLORS` du moteur), avec
 * texte noir/blanc choisi par luminance pour rester lisible.
 *
 * À utiliser partout où une équipe affiche sa race — jamais le slug brut.
 *
 * Le NOM vient de la base (`Roster.name`/`nameEn`, servi par `/api/rosters`) :
 * `getRosterName` est une table FR figée dans le bundle, donc un roster
 * renommé en admin ou créé uniquement en base s'affichait périmé, en anglais
 * jamais traduit, ou en slug brut (W10 de l'audit). Le nom déjà résolu passé
 * en `name` reste prioritaire — c'est le cas quand l'appelant tient la donnée
 * de son propre payload API.
 *
 * Les COULEURS restent au moteur : elles n'existent pas encore en base
 * (cf. §6 de l'audit).
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
  ruleset = "season_3",
  className = "",
}: {
  /** Slug technique du roster (ex: "tomb_kings"). */
  slug: string;
  /** Nom déjà résolu (ex: `raceName` de l'API) — sinon résolu ici. */
  name?: string | null;
  /** Édition à interroger pour le nom (les rosters diffèrent d'une saison à l'autre). */
  ruleset?: string;
  className?: string;
}) {
  const { rosterName } = useRosterCatalog("fr", ruleset);
  const colors = getTeamColors(slug);
  const background = hex(colors.primary);
  const label = name || rosterName(slug);
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
