"use client";

/**
 * Selecteur de style de jeu pour le lineup builder (Nuffle Coach).
 *
 * Le style definit les plafonds (max) de composition par archetype
 * (cf. @bb/nfl-mapper PLAY_STYLE_CAPS). Mobile-first : controle segmente
 * scrollable horizontalement sur petit ecran, grille sur desktop, + une
 * carte recap des plafonds du style actif.
 *
 * Presentational pur : aucun fetch. Le parent gere la persistance (PATCH
 * /play-style) et passe `disabled` quand le lineup est locked.
 */
import {
  PLAY_STYLES,
  PLAY_STYLE_CAPS,
  coercePlayStyle,
  type ArchetypeCaps,
  type CompositionArchetype,
  type PlayStyle,
} from "@bb/nfl-mapper";

interface StyleMeta {
  readonly label: string;
  readonly icon: string;
  readonly tagline: string;
}

/** Metadonnees d'affichage par style (FR hardcode, cf. CLAUDE.md). */
const STYLE_META: Readonly<Record<PlayStyle, StyleMeta>> = {
  balanced: {
    label: "Équilibré",
    icon: "⚖️",
    tagline: "Roster polyvalent, anti-stack léger.",
  },
  offensive: {
    label: "Offensif",
    icon: "🔥",
    tagline: "Course et réception généreuses.",
  },
  air_raid: {
    label: "Air Raid",
    icon: "🎯",
    tagline: "Jeu aérien extrême, course bridée.",
  },
  defensive: {
    label: "Défensif",
    icon: "🛡️",
    tagline: "Offense limitée, mur défensif.",
  },
};

/** Ordre + libelles des archetypes plafonnables affiches dans le recap. */
const CAP_ARCHETYPES: ReadonlyArray<{
  readonly key: CompositionArchetype;
  readonly label: string;
}> = [
  { key: "passer", label: "QB" },
  { key: "rusher", label: "RB" },
  { key: "receiver", label: "WR/TE" },
  { key: "bigGuy", label: "DT/NT" },
];

function capLabel(caps: ArchetypeCaps, key: CompositionArchetype): string {
  const v = caps[key];
  return v === undefined ? "∞" : `${v} max`;
}

interface PlayStyleSelectorProps {
  readonly value: string | undefined;
  readonly onChange: (style: PlayStyle) => void;
  readonly disabled?: boolean;
  readonly saving?: boolean;
}

export function PlayStyleSelector({
  value,
  onChange,
  disabled = false,
  saving = false,
}: PlayStyleSelectorProps): JSX.Element {
  const active = coercePlayStyle(value);
  const caps = PLAY_STYLE_CAPS[active];

  return (
    <section
      className="rounded-xl border border-nuffle-bronze/20 bg-white p-3 shadow-sm sm:p-4"
      data-testid="play-style-selector"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-nuffle-anthracite">
          Style de jeu
        </h2>
        {saving && (
          <span className="text-xs text-nuffle-anthracite/50">
            Enregistrement…
          </span>
        )}
      </div>

      {/* Controle segmente : scroll-x sur mobile, grille 4 cols sur sm+. */}
      <div
        className="mt-2 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0"
        role="radiogroup"
        aria-label="Style de jeu"
      >
        {PLAY_STYLES.map((style) => {
          const meta = STYLE_META[style];
          const isActive = style === active;
          return (
            <button
              key={style}
              type="button"
              role="radio"
              aria-checked={isActive}
              disabled={disabled}
              onClick={() => onChange(style)}
              data-testid={`play-style-option-${style}`}
              className={`flex min-w-[7.5rem] shrink-0 flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors sm:min-w-0 ${
                isActive
                  ? "border-nuffle-gold bg-nuffle-gold/10"
                  : "border-nuffle-bronze/25 bg-white hover:border-nuffle-gold/50"
              } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <span className="text-sm font-semibold text-nuffle-anthracite">
                <span aria-hidden>{meta.icon}</span> {meta.label}
              </span>
              <span className="text-[11px] leading-tight text-nuffle-anthracite/60">
                {meta.tagline}
              </span>
            </button>
          );
        })}
      </div>

      {/* Recap des plafonds du style actif. */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-medium text-nuffle-anthracite/50">
          Plafonds :
        </span>
        {CAP_ARCHETYPES.map(({ key, label }) => (
          <span
            key={key}
            className="rounded-full bg-nuffle-ivory/60 px-2 py-0.5 text-[11px] font-medium text-nuffle-anthracite"
            title={`${label} : ${capLabel(caps, key)}`}
          >
            {label} <strong>{capLabel(caps, key)}</strong>
          </span>
        ))}
        <span
          className="rounded-full bg-nuffle-ivory/40 px-2 py-0.5 text-[11px] text-nuffle-anthracite/70"
          title="Linemen et défenseurs : illimités — un lineup de 11 reste toujours possible"
        >
          Linemen / défense ∞
        </span>
      </div>
    </section>
  );
}
