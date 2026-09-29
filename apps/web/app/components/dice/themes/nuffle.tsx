"use client";

import { useId } from "react";
import type {
  BlockFaceProps,
  D6FaceProps,
  D6Value,
  DiceThemeRenderer,
} from "../types";

/**
 * Thème « Nuffle » (défaut) — gravure or sur jeton sombre, le langage
 * graphique de la home (`NuffleArt`). Ids de dégradé uniques par instance
 * (`useId`) : plusieurs dés sur une page ne se volent plus leur `<defs>`.
 */

const GOLD_LIGHT = "#F3Dd92";
const GOLD_DEEP = "#C9A227";
const COIN = "#1B1610";

function powPoints(): string {
  const pts: string[] = [];
  for (let i = 0; i < 16; i += 1) {
    const r = i % 2 === 0 ? 12 : 6;
    const a = (i * 22.5 * Math.PI) / 180;
    pts.push(`${(20 + r * Math.cos(a)).toFixed(2)},${(20 + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

function Tile({ gradId }: { readonly gradId: string }) {
  return (
    <>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GOLD_LIGHT} />
          <stop offset="100%" stopColor={GOLD_DEEP} />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="36" height="36" rx="9" fill={COIN} stroke={`url(#${gradId})`} strokeWidth="1.6" />
      <rect x="4.5" y="4.5" width="31" height="31" rx="7" fill="none" stroke={GOLD_DEEP} strokeWidth="0.7" opacity="0.5" />
    </>
  );
}

function NuffleBlockFace({ face, className, label }: BlockFaceProps) {
  const gradId = `bd-gold-${useId().replace(/:/g, "")}`;
  const gold = `url(#${gradId})`;
  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label={label} data-dice-theme="nuffle">
      <Tile gradId={gradId} />

      {face === "pow" && (
        <>
          <polygon points={powPoints()} fill={gold} />
          <circle cx="20" cy="20" r="4.2" fill={COIN} />
        </>
      )}

      {face === "push" && (
        <path d="M9 20h13M17 13l7 7-7 7" fill="none" stroke={gold} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      )}

      {face === "stumble" && (
        <>
          <path d="M9 22h11M16 16l6 6-6 6" fill="none" stroke={gold} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M27 11v7" stroke={gold} strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="27" cy="22.5" r="1.5" fill={gold} />
        </>
      )}

      {/* Les Deux Plaqués : un crâne sur une explosion (icône du livre). */}
      {face === "bothdown" && (
        <g>
          <polygon points={powPoints()} fill={gold} opacity="0.55" />
          <g fill={gold}>
            <circle cx="20" cy="18" r="6.4" />
            <rect x="15.2" y="23" width="9.6" height="5.4" rx="1.7" />
          </g>
          <g fill={COIN}>
            <circle cx="17.6" cy="17.4" r="1.9" />
            <circle cx="22.4" cy="17.4" r="1.9" />
            <path d="M20 19.2l1.3 2.4h-2.6z" />
          </g>
        </g>
      )}

      {face === "down" && (
        <g>
          <path
            fill={gold}
            d="M20 7c-5 0-8.6 3.4-8.6 8.1 0 2.7 1.3 4.5 2.7 5.6.6.4.9.8.9 1.5V25c0 .6.3 1 .9 1h1c.5 0 .8-.4.8-1v-1.4h1.2V25c0 .6.4 1 .9 1s.9-.4.9-1v-1.4h1.2V25c0 .6.3 1 .8 1h1c.6 0 .9-.4.9-1v-1.8c0-.7.3-1.1.9-1.5 1.4-1.1 2.7-2.9 2.7-5.6C28.6 10.4 25 7 20 7z"
          />
          <g fill={COIN}>
            <circle cx="16.8" cy="14.9" r="2.2" />
            <circle cx="23.2" cy="14.9" r="2.2" />
            <path d="M20 16.6l1.5 2.7h-3z" />
          </g>
        </g>
      )}
    </svg>
  );
}

/** Position des points sur une grille 3×3 (colonnes/lignes 12, 20, 28). */
const PIPS: Record<D6Value, ReadonlyArray<readonly [number, number]>> = {
  1: [[20, 20]],
  2: [[12, 12], [28, 28]],
  3: [[12, 12], [20, 20], [28, 28]],
  4: [[12, 12], [28, 12], [12, 28], [28, 28]],
  5: [[12, 12], [28, 12], [20, 20], [12, 28], [28, 28]],
  6: [[12, 12], [28, 12], [12, 20], [28, 20], [12, 28], [28, 28]],
};

function NuffleD6Face({ value, className, label }: D6FaceProps) {
  const gradId = `d6-gold-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label={label} data-dice-theme="nuffle">
      <Tile gradId={gradId} />
      {PIPS[value].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={value === 1 ? 4.6 : 3.4} fill={`url(#${gradId})`} data-pip="" />
      ))}
    </svg>
  );
}

export const NUFFLE_DICE_THEME: DiceThemeRenderer = {
  id: "nuffle",
  BlockFace: NuffleBlockFace,
  D6Face: NuffleD6Face,
};
