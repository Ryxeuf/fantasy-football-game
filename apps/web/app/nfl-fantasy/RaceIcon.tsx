/**
 * Icône (emoji) de race BB pour les pages NFL Fantasy.
 * Le code de race vient de `NflTeam.bbRace` ; le label localisé de
 * `NflTeam.raceLabel`. Pas d'asset image (cf. emoji déjà utilisés sur la
 * page d'accueil et l'avatar du détail joueur).
 */

const RACE_EMOJI: Readonly<Record<string, string>> = {
  Skaven: "🐀",
  WoodElf: "🌳",
  Orc: "🐗",
  Human: "🛡️",
  Norse: "🪓",
  Dwarf: "⛏️",
  Khorne: "💀",
  Necromantic: "🧟",
};

export function getRaceEmoji(race: string | null | undefined): string | null {
  if (!race) return null;
  return RACE_EMOJI[race] ?? null;
}

interface RaceIconProps {
  /** Code race BB (cf. NflTeam.bbRace). */
  race: string | null | undefined;
  /** Label public (raceLabel) pour le title/aria. Optionnel. */
  label?: string | null;
  className?: string;
}

export function RaceIcon({ race, label, className }: RaceIconProps) {
  const emoji = getRaceEmoji(race);
  if (!emoji) return null;
  const title = label ? `${label} (${race})` : (race ?? "");
  return (
    <span
      title={title}
      aria-label={title}
      role="img"
      className={className ?? "inline-block"}
    >
      {emoji}
    </span>
  );
}
