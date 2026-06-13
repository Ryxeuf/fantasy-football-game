"use client";

/**
 * NuffleArt — jeu d'illustrations vectorielles maison pour la home.
 *
 * Tout est dessiné en SVG (pas d'images bitmap) pour garantir l'unite
 * visuelle : un seul langage graphique « gravure or sur jeton sombre ».
 * Ce motif est reutilise par le medaillon hero, les des de blocage et
 * les emblemes de categories — d'ou une page homogene.
 */

const GOLD = "#E8C96A";
const GOLD_DEEP = "#C9A227";
const COIN = "#1B1610";
const COIN_EDGE = "#2A2114";
const BLOOD = "#8A2222";

type SvgProps = {
  readonly className?: string;
  readonly title?: string;
};

/* ------------------------------------------------------------------ */
/* Medaillon hero — jeton de Nuffle (anneau grave rotatif + crane)     */
/* ------------------------------------------------------------------ */

export function NuffleMedallion({ className }: SvgProps) {
  const rim =
    "★ NUFFLE ARENA ★ BLOOD BOWL ★ SAISON 3 ★ NUFFLE ARENA ★ BLOOD BOWL ★ SAISON 3 ";
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      role="img"
      aria-label="Le jeton de Nuffle"
    >
      <defs>
        <linearGradient id="nm-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F3Dd92" />
          <stop offset="50%" stopColor={GOLD} />
          <stop offset="100%" stopColor={GOLD_DEEP} />
        </linearGradient>
        <radialGradient id="nm-disc" cx="50%" cy="42%" r="65%">
          <stop offset="0%" stopColor={COIN_EDGE} />
          <stop offset="100%" stopColor={COIN} />
        </radialGradient>
        <path
          id="nm-rim"
          d="M22,100 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0"
          fill="none"
        />
      </defs>

      {/* halo doux */}
      <circle cx="100" cy="100" r="98" fill="url(#nm-gold)" opacity="0.12" />

      {/* anneau exterieur grave */}
      <circle cx="100" cy="100" r="96" fill="none" stroke="url(#nm-gold)" strokeWidth="3" />
      <circle cx="100" cy="100" r="90" fill="none" stroke={GOLD_DEEP} strokeWidth="1" opacity="0.6" />

      {/* texte grave qui tourne lentement */}
      <g
        className="motion-reduce:[animation:none]"
        style={{ animation: "nm-spin 48s linear infinite", transformOrigin: "100px 100px" }}
      >
        <text
          fill={GOLD}
          fontSize="9.5"
          letterSpacing="1.6"
          style={{ fontFamily: "var(--font-cinzel), serif", fontWeight: 700 }}
        >
          <textPath href="#nm-rim" startOffset="0">
            {rim}
          </textPath>
        </text>
      </g>

      {/* rivets cardinaux (jeton) */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const cx = 100 + 83 * Math.cos(rad);
        const cy = 100 + 83 * Math.sin(rad);
        return <circle key={deg} cx={cx} cy={cy} r="1.6" fill={GOLD_DEEP} />;
      })}

      {/* disque central sombre */}
      <circle cx="100" cy="100" r="74" fill="url(#nm-disc)" />
      <circle cx="100" cy="100" r="74" fill="none" stroke="url(#nm-gold)" strokeWidth="2" />
      <circle cx="100" cy="100" r="68" fill="none" stroke={GOLD_DEEP} strokeWidth="0.8" opacity="0.5" />

      {/* crane grave + felure rouge sang */}
      <g transform="translate(28,32) scale(3.6)">
        <path
          fill="url(#nm-gold)"
          d="M20 8c-5.5 0-9.5 3.8-9.5 9 0 3 1.4 5 3 6.2.6.5 1 .9 1 1.7V27c0 .6.4 1 1 1h1.2c.5 0 .9-.4.9-1v-1.5h1.3V27c0 .6.4 1 1 1s1-.4 1-1v-1.5h1.3V27c0 .6.4 1 .9 1H25c.6 0 1-.4 1-1v-2.1c0-.8.4-1.2 1-1.7 1.6-1.2 3-3.2 3-6.2 0-5.2-4-9-9.5-9z"
        />
        <path d="M20 8.4l-.9 2 1 .8-.8 1.7" fill="none" stroke={BLOOD} strokeWidth="0.7" strokeLinecap="round" />
        <g fill={COIN}>
          <circle cx="16.3" cy="16.6" r="2.5" />
          <circle cx="23.7" cy="16.6" r="2.5" />
          <path d="M20 18.4l1.7 3.1h-3.4z" />
        </g>
      </g>

      <style>{`@keyframes nm-spin{to{transform:rotate(360deg)}}`}</style>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Des de blocage — tuile sombre + symbole or grave                    */
/* ------------------------------------------------------------------ */

export type BlockDieFace = "pow" | "push" | "stumble" | "bothdown" | "down";

function powPoints(): string {
  const cx = 20;
  const cy = 20;
  const pts: string[] = [];
  for (let i = 0; i < 16; i += 1) {
    const r = i % 2 === 0 ? 12 : 6;
    const a = (i * 22.5 * Math.PI) / 180;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

const DIE_LABEL: Record<BlockDieFace, string> = {
  pow: "Joueur à terre",
  push: "Repoussé",
  stumble: "Hésitation",
  bothdown: "Tous à terre",
  down: "Attaquant à terre",
};

export function BlockDie({ face, className }: { readonly face: BlockDieFace; readonly className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label={DIE_LABEL[face]}>
      <rect x="2" y="2" width="36" height="36" rx="9" fill={COIN} stroke="url(#bd-gold)" strokeWidth="1.6" />
      <rect x="4.5" y="4.5" width="31" height="31" rx="7" fill="none" stroke={GOLD_DEEP} strokeWidth="0.7" opacity="0.5" />
      <defs>
        <linearGradient id="bd-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F3Dd92" />
          <stop offset="100%" stopColor={GOLD_DEEP} />
        </linearGradient>
      </defs>

      {face === "pow" && (
        <>
          <polygon points={powPoints()} fill="url(#bd-gold)" />
          <circle cx="20" cy="20" r="4.2" fill={COIN} />
        </>
      )}

      {face === "push" && (
        <path
          d="M9 20h13M17 13l7 7-7 7"
          fill="none"
          stroke="url(#bd-gold)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {face === "stumble" && (
        <>
          <path
            d="M9 22h11M16 16l6 6-6 6"
            fill="none"
            stroke="url(#bd-gold)"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M27 11v7" stroke="url(#bd-gold)" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="27" cy="22.5" r="1.5" fill="url(#bd-gold)" />
        </>
      )}

      {face === "bothdown" && (
        <g fill="url(#bd-gold)">
          {[12.5, 27.5].map((cx) => (
            <g key={cx}>
              <circle cx={cx} cy="17" r="5" />
              <rect x={cx - 4} y="21" width="8" height="4.5" rx="1.4" />
              <circle cx={cx - 1.9} cy="16.4" r="1.5" fill={COIN} />
              <circle cx={cx + 1.9} cy="16.4" r="1.5" fill={COIN} />
            </g>
          ))}
        </g>
      )}

      {face === "down" && (
        <g>
          <path
            fill="url(#bd-gold)"
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

/* ------------------------------------------------------------------ */
/* Emblemes de categories — gravure or, trait constant (viewBox 24)    */
/* ------------------------------------------------------------------ */

type EmblemProps = { readonly className?: string };

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function EmblemRosters({ className }: EmblemProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path {...stroke} d="M12 3l7 2.2v5.3c0 4.7-3 7.6-7 8.9-4-1.3-7-4.2-7-8.9V5.2z" />
      <path {...stroke} d="M9 9.5h6M9 12.5h6M9 15h4" />
    </svg>
  );
}

export function EmblemStar({ className }: EmblemProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        {...stroke}
        d="M12 3.2l2.3 4.7 5.2.7-3.8 3.6.9 5.1L12 14.9 7.4 17.3l.9-5.1L4.5 8.6l5.2-.7z"
      />
      <path {...stroke} d="M4.6 14.5c-1.4 1.8-1.4 3.6 0 5.4M19.4 14.5c1.4 1.8 1.4 3.6 0 5.4" />
    </svg>
  );
}

export function EmblemSkills({ className }: EmblemProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path {...stroke} d="M12 6.5C9.8 5.2 6.9 5 4.5 6v12c2.4-1 5.3-.8 7.5.5 2.2-1.3 5.1-1.5 7.5-.5V6c-2.4-1-5.3-.8-7.5.5z" />
      <path {...stroke} d="M12 6.5V19" />
      <path {...stroke} d="M15.5 10.5l1 1 1.8-2" />
    </svg>
  );
}

export function EmblemTutorial({ className }: EmblemProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path {...stroke} d="M12 4l9 3.4-9 3.4-9-3.4z" />
      <path {...stroke} d="M6.5 9.6V15c0 1.3 2.5 2.6 5.5 2.6S17.5 16.3 17.5 15V9.6" />
      <path {...stroke} d="M21 7.4v4.4" />
    </svg>
  );
}

export function EmblemTabletop({ className }: EmblemProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect {...stroke} x="5" y="4" width="14" height="17" rx="2.2" />
      <path {...stroke} d="M9 3.5h6a1 1 0 0 1 1 1V6a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" />
      <path {...stroke} d="M8.5 12l2 2 3.5-3.8" />
      <path {...stroke} d="M8.5 17.5h7" />
    </svg>
  );
}

export function EmblemCup({ className }: EmblemProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path {...stroke} d="M7 4.5h10v3a5 5 0 0 1-10 0z" />
      <path {...stroke} d="M7 5.6H4.7a2.2 2.2 0 0 0 2.3 3.9M17 5.6h2.3a2.2 2.2 0 0 1-2.3 3.9" />
      <path {...stroke} d="M12 12.5v3M10.4 15.5h3.2M9 19.5h6l-.6-4H9.6z" />
    </svg>
  );
}

export function EmblemLeague({ className }: EmblemProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        {...stroke}
        d="M12 3l1 2 2.2.3-1.6 1.5.4 2.2L12 8l-2 1 .4-2.2L8.8 5.3 11 5z"
      />
      <rect {...stroke} x="9.6" y="11" width="4.8" height="9" rx="0.9" />
      <rect {...stroke} x="3.6" y="14" width="4.8" height="6" rx="0.9" />
      <rect {...stroke} x="15.6" y="12.5" width="4.8" height="7.5" rx="0.9" />
    </svg>
  );
}

export function EmblemPdf({ className }: EmblemProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path {...stroke} d="M7 3h7l5 5v11.5A1.5 1.5 0 0 1 17.5 21h-11A1.5 1.5 0 0 1 5 19.5v-15A1.5 1.5 0 0 1 6.5 3z" />
      <path {...stroke} d="M14 3v5h5" />
      <path {...stroke} d="M12 11.5v5M9.6 14.1L12 16.5l2.4-2.4" />
    </svg>
  );
}
