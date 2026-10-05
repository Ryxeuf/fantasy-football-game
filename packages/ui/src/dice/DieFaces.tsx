import * as React from "react";
import { useDiceSkin } from "./DiceSkinContext";
import {
  D6_PIPS,
  blockFaceSrc,
  diceAssetSizeFor,
  isPipValue,
  type DiceFaceOutcome,
  type DiceSkin,
} from "./skins";

/**
 * Faces de dés dessinées dans un skin (cf. `skins.ts`) :
 *  - `SkinnedBlockFace` : face PNG du Dé de Blocage ;
 *  - `SkinnedPipFace`   : D6 à points (SVG aux couleurs du skin) ;
 *  - `SkinnedNumberFace`: dé chiffré (D3, D8, D16, total de 2D6…).
 *
 * Sans `skin` explicite, le skin du contexte (dé original hors provider).
 * Le nom accessible est OBLIGATOIRE : une face sans libellé ne dit rien à un
 * lecteur d'écran.
 */

interface CommonProps {
  readonly label: string;
  readonly className?: string;
  readonly style?: React.CSSProperties;
  /** Force un skin (aperçu) au lieu de celui du contexte. */
  readonly skin?: DiceSkin;
}

export interface SkinnedBlockFaceProps extends CommonProps {
  readonly outcome: DiceFaceOutcome;
  /** Taille d'affichage en px CSS : choisit le PNG (64/128/320). */
  readonly px?: number;
  readonly loading?: "lazy" | "eager";
}

export function SkinnedBlockFace({
  outcome,
  label,
  className,
  style,
  skin,
  px,
  loading,
}: SkinnedBlockFaceProps) {
  const ctx = useDiceSkin();
  const s = skin ?? ctx;
  return (
    <img
      src={blockFaceSrc(s, outcome, diceAssetSizeFor(px))}
      alt={label}
      title={label}
      className={className}
      style={px ? { width: px, height: px, ...style } : style}
      loading={loading}
      decoding="async"
      draggable={false}
      data-dice-theme={s.id}
      data-dice-face={outcome}
    />
  );
}

/** Jeton commun aux dés numériques : fond, liseré du skin, ombre de bord. */
function Token({ skin }: { readonly skin: DiceSkin }) {
  const { background, accent } = skin.palette;
  return (
    <>
      <rect x="1" y="1" width="38" height="38" rx="6" fill={background} stroke="#000" strokeOpacity="0.35" strokeWidth="1" />
      {skin.framed && (
        <rect x="3.6" y="3.6" width="32.8" height="32.8" rx="4" fill="none" stroke={accent} strokeWidth="1.2" />
      )}
    </>
  );
}

export interface SkinnedPipFaceProps extends CommonProps {
  /** 1 à 6 ; hors bornes, la valeur s'affiche chiffrée. */
  readonly value: number;
}

export function SkinnedPipFace({ value, label, className, style, skin }: SkinnedPipFaceProps) {
  const ctx = useDiceSkin();
  const s = skin ?? ctx;
  if (!isPipValue(value)) {
    return <SkinnedNumberFace value={value} label={label} className={className} style={style} skin={s} />;
  }
  return (
    <svg viewBox="0 0 40 40" className={className} style={style} role="img" aria-label={label} data-dice-theme={s.id}>
      <Token skin={s} />
      {D6_PIPS[value].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={value === 1 ? 5 : 3.6} fill={s.palette.symbol} data-pip="" />
      ))}
    </svg>
  );
}

export interface SkinnedNumberFaceProps extends CommonProps {
  readonly value: number;
  /** Nombre de faces du dé (8 pour un D8) : affiché en petit, en coin. */
  readonly sides?: number;
}

export function SkinnedNumberFace({ value, sides, label, className, style, skin }: SkinnedNumberFaceProps) {
  const ctx = useDiceSkin();
  const s = skin ?? ctx;
  const text = String(value);
  const fontSize = text.length >= 3 ? 13 : text.length === 2 ? 17 : 21;
  return (
    <svg viewBox="0 0 40 40" className={className} style={style} role="img" aria-label={label} data-dice-theme={s.id}>
      <Token skin={s} />
      <text
        x="20"
        y={sides ? 19 : 20.5}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontWeight="800"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fill={s.palette.symbol}
        data-die-value=""
      >
        {text}
      </text>
      {sides ? (
        <text
          x="20"
          y="32"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="6"
          fontWeight="700"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fill={s.palette.accent}
          opacity="0.9"
        >
          {`D${sides}`}
        </text>
      ) : null}
    </svg>
  );
}
