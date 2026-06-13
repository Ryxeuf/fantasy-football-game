"use client";

/**
 * NuffleScenes — illustrations vectorielles maison (plus grandes que les
 * icones de NuffleArt). Meme langage graphique « or grave sur sombre »
 * pour garder l'unite visuelle : ecus de factions, blason de championnat
 * (ligue), trophee de coupe, fioritures d'angle et fond de stade.
 */

const GOLD = "#E8C96A";
const GOLD_DEEP = "#C9A227";
const COIN = "#1B1610";
const BLOOD = "#8A2222";

type SvgProps = { readonly className?: string };

/* ------------------------------------------------------------------ */
/* Ecus de factions — silhouette d'ecu sombre + embleme grave or       */
/* ------------------------------------------------------------------ */

export type FactionEmblem =
  | "hammer"
  | "claw"
  | "horns"
  | "skull"
  | "tusks"
  | "leaf"
  | "sun"
  | "bolt";

export const FACTIONS: ReadonlyArray<{ emblem: FactionEmblem; label: string }> = [
  { emblem: "bolt", label: "Skaven" },
  { emblem: "tusks", label: "Orques" },
  { emblem: "leaf", label: "Elfes Sylvains" },
  { emblem: "hammer", label: "Nains" },
  { emblem: "skull", label: "Morts-Vivants" },
  { emblem: "claw", label: "Hommes-Lézards" },
  { emblem: "horns", label: "Chaos" },
  { emblem: "sun", label: "Amazones" },
];

function Emblem({ emblem }: { emblem: FactionEmblem }) {
  switch (emblem) {
    case "hammer":
      return (
        <g fill={GOLD}>
          <rect x="17" y="19" width="14" height="6.5" rx="1.4" />
          <rect x="21.5" y="25" width="5" height="15" rx="1" />
        </g>
      );
    case "claw":
      return (
        <g fill="none" stroke={GOLD} strokeWidth="2.6" strokeLinecap="round">
          <path d="M18 18c-1 7-1 14 0 21" />
          <path d="M24 16c-1 8-1 16 0 24" />
          <path d="M30 18c1 7 1 14 0 21" />
        </g>
      );
    case "horns":
      return (
        <path
          fill={GOLD}
          d="M24 40c-7 0-11-9-9-22 4 3 6 7 9 12 3-5 5-9 9-12 2 13-2 22-9 22z"
        />
      );
    case "skull":
      return (
        <g transform="translate(13,12) scale(1.1)">
          <path
            fill={GOLD}
            d="M10 4c-5.5 0-9.5 3.8-9.5 9 0 3 1.4 5 3 6.2.6.5 1 .9 1 1.7V23c0 .6.4 1 1 1h1.2c.5 0 .9-.4.9-1v-1.5h1.3V23c0 .6.4 1 1 1s1-.4 1-1v-1.5h1.3V23c0 .6.4 1 .9 1H16c.6 0 1-.4 1-1v-2.1c0-.8.4-1.2 1-1.7 1.6-1.2 3-3.2 3-6.2 0-5.2-4-9-9.5-9z"
          />
          <g fill={COIN}>
            <circle cx="6.3" cy="12.6" r="2.5" />
            <circle cx="13.7" cy="12.6" r="2.5" />
            <path d="M10 14.4l1.7 3.1H8.3z" />
          </g>
        </g>
      );
    case "tusks":
      return (
        <g fill={GOLD}>
          <path d="M19 19c-1.5 9 .5 16 3 21-.5-8-.5-15 0-21z" />
          <path d="M29 19c1.5 9-.5 16-3 21 .5-8 .5-15 0-21z" />
          <rect x="17" y="17" width="14" height="3" rx="1.5" />
        </g>
      );
    case "leaf":
      return (
        <g>
          <path fill={GOLD} d="M24 15c8 6 8 19 0 25-8-6-8-19 0-25z" />
          <path d="M24 18v18" stroke={COIN} strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );
    case "sun":
      return (
        <g fill={GOLD} stroke={GOLD} strokeWidth="2.4" strokeLinecap="round">
          <circle cx="24" cy="28" r="6" stroke="none" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const r = (deg * Math.PI) / 180;
            return (
              <line
                key={deg}
                x1={24 + 9 * Math.cos(r)}
                y1={28 + 9 * Math.sin(r)}
                x2={24 + 13 * Math.cos(r)}
                y2={28 + 13 * Math.sin(r)}
              />
            );
          })}
        </g>
      );
    case "bolt":
      return <path fill={GOLD} d="M28 15l-10 15h6l-3 11 11-16h-6z" />;
    default:
      return null;
  }
}

export function FactionCrest({ emblem, className }: { readonly emblem: FactionEmblem; readonly className?: string }) {
  return (
    <svg viewBox="0 0 48 58" className={className} aria-hidden="true">
      <path
        d="M5 7h38v19c0 15-8 24-19 29C13 50 5 41 5 26z"
        fill={COIN}
        stroke={GOLD}
        strokeWidth="2"
      />
      <path
        d="M8.5 10h31v16c0 12.5-6.6 20.4-15.5 24.6C15.1 46.4 8.5 38.5 8.5 26z"
        fill="none"
        stroke={GOLD_DEEP}
        strokeWidth="0.8"
        opacity="0.5"
      />
      <Emblem emblem={emblem} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Blason de championnat (Ligue) — laurier + ecu + etoile              */
/* ------------------------------------------------------------------ */

const STAR_PATH =
  "M12 2.2l2.6 6 6.5.5-4.9 4.2 1.5 6.3L12 16l-5.7 3.2 1.5-6.3-4.9-4.2 6.5-.5z";

export function LeagueCrest({ className }: SvgProps) {
  const leftLeaves = [
    { x: 53, y: 96, rot: -22 },
    { x: 46, y: 86, rot: -30 },
    { x: 40, y: 75, rot: -40 },
    { x: 35, y: 64, rot: -50 },
    { x: 31, y: 53, rot: -62 },
    { x: 29, y: 43, rot: -74 },
  ];
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label="Blason de championnat">
      <defs>
        <linearGradient id="lc2-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F3Dd92" />
          <stop offset="55%" stopColor={GOLD} />
          <stop offset="100%" stopColor={GOLD_DEEP} />
        </linearGradient>
      </defs>

      {/* laurier */}
      <g fill="url(#lc2-gold)">
        {leftLeaves.map((l) => (
          <g key={`l${l.x}-${l.y}`}>
            <ellipse cx={l.x} cy={l.y} rx="3" ry="6.5" transform={`rotate(${l.rot} ${l.x} ${l.y})`} />
            <ellipse cx={120 - l.x} cy={l.y} rx="3" ry="6.5" transform={`rotate(${-l.rot} ${120 - l.x} ${l.y})`} />
          </g>
        ))}
      </g>
      <g fill="none" stroke="url(#lc2-gold)" strokeWidth="2" strokeLinecap="round">
        <path d="M60 110C42 102 32 80 29 44" />
        <path d="M60 110C78 102 88 80 91 44" />
      </g>

      {/* ecu central */}
      <path d="M40 30h40v22c0 15-9 23-20 28-11-5-20-13-20-28z" fill={COIN} stroke="url(#lc2-gold)" strokeWidth="2.5" />
      <path d="M44 34h32v18c0 12.5-7.4 19.4-16 23.6C51.4 71.4 44 64.5 44 52z" fill="none" stroke={GOLD_DEEP} strokeWidth="0.8" opacity="0.55" />

      {/* etoile dans l'ecu */}
      <g transform="translate(48,40) scale(1.0)">
        <path d={STAR_PATH} fill="url(#lc2-gold)" />
      </g>

      {/* couronne / etoile sommitale */}
      <g transform="translate(50,8) scale(0.85)">
        <path d={STAR_PATH} fill="url(#lc2-gold)" />
      </g>

      {/* gemme rouge sang */}
      <circle cx="60" cy="78" r="3" fill={BLOOD} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Trophee de coupe                                                    */
/* ------------------------------------------------------------------ */

export function CupCrest({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label="Trophée de coupe">
      <defs>
        <linearGradient id="cc2-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F3Dd92" />
          <stop offset="55%" stopColor={GOLD} />
          <stop offset="100%" stopColor={GOLD_DEEP} />
        </linearGradient>
      </defs>

      {/* coupe */}
      <path d="M40 26h40v14a20 20 0 0 1-40 0z" fill={COIN} stroke="url(#cc2-gold)" strokeWidth="3" />
      <path d="M45 30h30" stroke={GOLD_DEEP} strokeWidth="1.2" opacity="0.6" />
      {/* anses */}
      <path d="M40 30H30a10 10 0 0 0 10 16" fill="none" stroke="url(#cc2-gold)" strokeWidth="3" />
      <path d="M80 30h10a10 10 0 0 1-10 16" fill="none" stroke="url(#cc2-gold)" strokeWidth="3" />
      {/* etoile gravee */}
      <g transform="translate(48,30) scale(1.0)">
        <path d={STAR_PATH} fill="url(#cc2-gold)" />
      </g>
      {/* pied */}
      <path d="M60 60v14M48 74h24l-3 12H51z" fill={COIN} stroke="url(#cc2-gold)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M42 90h36" stroke="url(#cc2-gold)" strokeWidth="4" strokeLinecap="round" />
      {/* etoiles laterales */}
      <g transform="translate(12,40) scale(0.5)" opacity="0.85">
        <path d={STAR_PATH} fill="url(#cc2-gold)" />
      </g>
      <g transform="translate(90,40) scale(0.5)" opacity="0.85">
        <path d={STAR_PATH} fill="url(#cc2-gold)" />
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Fioriture d'angle (filigrane) — pour encadrer les panneaux          */
/* ------------------------------------------------------------------ */

export function Flourish({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 60 60" className={className} aria-hidden="true" fill="none" stroke={GOLD} strokeWidth="1.4" strokeLinecap="round">
      <path d="M4 4c22 0 30 8 30 30" opacity="0.8" />
      <path d="M4 4c0 22 8 30 30 30" opacity="0.8" />
      <path d="M4 16c8 0 12 4 12 12" opacity="0.5" />
      <circle cx="34" cy="34" r="2" fill={GOLD} stroke="none" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Fond de stade (hero) — gradins concentriques + foule, tres discret  */
/* ------------------------------------------------------------------ */

export function StadiumBackdrop({ className }: SvgProps) {
  const crowd: { x: number; y: number }[] = [];
  for (let row = 0; row < 3; row += 1) {
    for (let i = 0; i < 26; i += 1) {
      crowd.push({ x: 8 + i * 15, y: 24 + row * 16 });
    }
  }
  return (
    <svg viewBox="0 0 400 260" className={className} aria-hidden="true" preserveAspectRatio="xMidYMax slice">
      <g stroke={GOLD_DEEP} fill="none" strokeWidth="1.4" opacity="0.5">
        <path d="M-20 250a220 120 0 0 1 440 0" />
        <path d="M-20 250a300 165 0 0 1 440 0" />
        <path d="M-20 250a380 210 0 0 1 440 0" />
      </g>
      <g fill={GOLD_DEEP} opacity="0.5">
        {crowd.map((c) => (
          <circle key={`${c.x}-${c.y}`} cx={c.x} cy={c.y} r="1.7" />
        ))}
      </g>
      {/* poteaux de but stylises */}
      <g stroke={GOLD_DEEP} strokeWidth="2" opacity="0.55" strokeLinecap="round">
        <path d="M120 250V150M120 150h-10M120 165h-8M120 150h10M120 165h8" />
        <path d="M280 250V150M280 150h-10M280 165h-8M280 150h10M280 165h8" />
      </g>
    </svg>
  );
}
