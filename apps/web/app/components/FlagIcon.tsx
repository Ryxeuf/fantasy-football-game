/**
 * Drapeaux de langue dessinés en SVG.
 *
 * Les emoji de drapeaux (🇫🇷, 🇬🇧) ne sont pas rendus par Windows, qui
 * affiche les deux lettres du code pays à la place (« FR », « GB »). Le
 * sélecteur de langue passe donc par ces images vectorielles, identiques
 * sur tous les systèmes.
 */

export type FlagCode = "fr" | "en";

interface FlagIconProps {
  readonly code: FlagCode;
  readonly className?: string;
}

const BASE_CLASS =
  "inline-block h-4 w-6 flex-shrink-0 rounded-sm ring-1 ring-black/10";

export default function FlagIcon({ code, className }: FlagIconProps) {
  const cls = className ? `${BASE_CLASS} ${className}` : BASE_CLASS;

  if (code === "fr") {
    return (
      <svg
        viewBox="0 0 3 2"
        className={cls}
        aria-hidden="true"
        focusable="false"
        data-testid="flag-fr"
      >
        <rect width="1" height="2" x="0" fill="#0055A4" />
        <rect width="1" height="2" x="1" fill="#FFFFFF" />
        <rect width="1" height="2" x="2" fill="#EF4135" />
      </svg>
    );
  }

  // Union Jack (ratio 3:2, tracé simplifié).
  return (
    <svg
      viewBox="0 0 60 40"
      className={cls}
      aria-hidden="true"
      focusable="false"
      data-testid="flag-en"
    >
      <rect width="60" height="40" fill="#012169" />
      <path d="M0,0 L60,40 M60,0 L0,40" stroke="#FFFFFF" strokeWidth="8" />
      <path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" strokeWidth="3" />
      <path d="M30,0 V40 M0,20 H60" stroke="#FFFFFF" strokeWidth="12" />
      <path d="M30,0 V40 M0,20 H60" stroke="#C8102E" strokeWidth="7" />
    </svg>
  );
}
