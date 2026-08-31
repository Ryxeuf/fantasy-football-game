/**
 * Template visuel React pour ImageResponse / satori (Q.14 — Sprint 23).
 *
 * IMPORTANT : satori ne supporte que **flexbox** (pas de grid).
 * Toutes les positions sont gerees via display: flex et les
 * dimensions absolutes (px / fractions de 1200x630).
 *
 * Le template est purement presentation : il consomme la structure
 * { title, subtitle, badges[], accent, logo? } produite par
 * `og-image-content.ts` et la mappe sur des elements styles inline.
 *
 * Regle du logo : il est pose dans une boite CARREE de taille fixe, en
 * `objectFit: contain`. C'est ce qui empeche la deformation constatee sur
 * l'ancien `og:image` (un PNG 1024x1024 annonce 1200x630, donc etire par
 * les scrapers) — et ca vaut aussi pour un logo d'equipe uploade, dont on
 * ne maitrise pas les proportions.
 *
 * L'embleme de repli (equipe sans logo) est rendu en elements SATORI, pas
 * en `<img src="data:image/svg+xml…">` : satori rasterise un SVG imbrique
 * sans resoudre ses polices, et le monogramme disparaitrait.
 */
import type { OgContent, OgAccent } from "./og-image-content";

interface AccentTheme {
  background: string;
  accent: string;
  text: string;
  badgeBg: string;
  badgeText: string;
}

const THEMES: Record<OgAccent, AccentTheme> = {
  team: {
    background: "linear-gradient(135deg, #1f1212 0%, #4a1f1f 60%, #6b1414 100%)",
    accent: "#fbbf24",
    text: "#f5f5f5",
    badgeBg: "rgba(251, 191, 36, 0.18)",
    badgeText: "#fde68a",
  },
  star: {
    background: "linear-gradient(135deg, #1f1a0a 0%, #4a3a1a 60%, #b8860b 100%)",
    accent: "#fde047",
    text: "#fff8e7",
    badgeBg: "rgba(253, 224, 71, 0.18)",
    badgeText: "#fff8c4",
  },
  skill: {
    background: "linear-gradient(135deg, #0a1228 0%, #1e3a8a 60%, #2563eb 100%)",
    accent: "#93c5fd",
    text: "#eff6ff",
    badgeBg: "rgba(147, 197, 253, 0.18)",
    badgeText: "#dbeafe",
  },
  // Lot O.D — Pro League match : dark slate avec accent emerald (live)
  match: {
    background:
      "linear-gradient(135deg, #020617 0%, #0f172a 50%, #064e3b 100%)",
    accent: "#34d399",
    text: "#ecfdf5",
    badgeBg: "rgba(52, 211, 153, 0.18)",
    badgeText: "#a7f3d0",
  },
  // Carte par defaut du site : le brun/or de l'identite Nuffle Arena.
  brand: {
    background:
      "linear-gradient(135deg, #16110b 0%, #2e2314 55%, #6b4e2e 100%)",
    accent: "#e0b64a",
    text: "#fdf7e6",
    badgeBg: "rgba(224, 182, 74, 0.18)",
    badgeText: "#f6e3ad",
  },
  // Lot O.D — Gazette : parchemin journal, sepia/amber chaud
  gazette: {
    background:
      "linear-gradient(135deg, #1c1410 0%, #3a2616 50%, #92400e 100%)",
    accent: "#fbbf24",
    text: "#fef3c7",
    badgeBg: "rgba(251, 191, 36, 0.20)",
    badgeText: "#fde68a",
  },
};

interface OgImageTemplateProps {
  content: OgContent;
  /** URL canonique a afficher en footer (ex: nufflearena.fr/teams/skaven). */
  canonicalUrl: string;
}

/** Cote de la boite du logo, en px. */
const LOGO_BOX = 260;
/** Marge interieure de la boite : le logo ne touche jamais ses bords. */
const LOGO_PADDING = 22;
/** Largeur restante pour le texte quand un logo occupe la colonne droite. */
const TEXT_WIDTH_WITH_LOGO = 1040 - LOGO_BOX - 48;

/**
 * Satori passe bien a la ligne, mais un nom d'equipe long a 92px mangerait
 * la carte sur trois lignes et pousserait les badges hors du cadre. On
 * reduit le corps par paliers plutot que de tronquer : un nom coupe est
 * pire qu'un nom un peu plus petit.
 */
function titleSizeFor(title: string, hasLogo: boolean): string {
  const budget = hasLogo ? 18 : 24;
  if (title.length <= budget) return "92px";
  if (title.length <= budget * 1.6) return "68px";
  return "52px";
}

export function OgImageTemplate({ content, canonicalUrl }: OgImageTemplateProps) {
  const theme = THEMES[content.accent];
  const logo = content.logo;
  const hasLogo = Boolean(logo);
  const titleFontSize = titleSizeFor(content.title, hasLogo);

  return (
    <div
      style={{
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        background: theme.background,
        color: theme.text,
        padding: "60px 80px",
        fontFamily: "Verdana, Geneva, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          fontSize: "28px",
          color: theme.accent,
          letterSpacing: "4px",
          fontWeight: 700,
        }}
      >
        NUFFLE ARENA
      </div>

      {/* Title block (centered vertically via flex-grow) + logo a droite */}
      <div
        style={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: "48px",
        }}
      >
        <div
          style={{
            flexGrow: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            // Sans logo, le bloc titre reprend toute la largeur utile.
            maxWidth: hasLogo ? `${TEXT_WIDTH_WITH_LOGO}px` : "1040px",
          }}
        >
          <div
            style={{
              fontSize: titleFontSize,
              fontWeight: 800,
              lineHeight: 1.05,
              color: theme.text,
              marginBottom: "24px",
              display: "flex",
            }}
          >
            {content.title}
          </div>
          <div
            style={{
              fontSize: "32px",
              color: theme.accent,
              fontWeight: 600,
              display: "flex",
            }}
          >
            {content.subtitle}
          </div>
        </div>

        {/*
          Boite CARREE + objectFit: contain => les proportions du logo sont
          preservees quelles qu'elles soient (carre, panoramique, portrait).
          C'est le correctif de la deformation constatee au partage.
        */}
        {logo?.kind === "image" ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: `${LOGO_BOX}px`,
              height: `${LOGO_BOX}px`,
              flexShrink: 0,
              borderRadius: "32px",
              background: theme.badgeBg,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logo.src}
              alt=""
              width={LOGO_BOX - LOGO_PADDING * 2}
              height={LOGO_BOX - LOGO_PADDING * 2}
              style={{ objectFit: "contain" }}
            />
          </div>
        ) : null}

        {/* Embleme de repli : couleurs canoniques du roster + monogramme. */}
        {logo?.kind === "emblem" ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: `${LOGO_BOX}px`,
              height: `${LOGO_BOX}px`,
              flexShrink: 0,
              borderRadius: logo.round ? "50%" : "44px",
              background: logo.background,
              border: `8px solid ${logo.foreground}`,
              color: logo.foreground,
              fontSize: logo.glyph.length >= 3 ? "84px" : logo.glyph.length === 2 ? "104px" : "132px",
              fontWeight: 800,
              letterSpacing: "2px",
            }}
          >
            {logo.glyph}
          </div>
        ) : null}
      </div>

      {/* Badges row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "16px",
          marginBottom: "32px",
        }}
      >
        {content.badges.map((badge) => (
          <div
            key={badge}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "12px 22px",
              borderRadius: "999px",
              background: theme.badgeBg,
              color: theme.badgeText,
              fontSize: "26px",
              fontWeight: 600,
            }}
          >
            {badge}
          </div>
        ))}
      </div>

      {/* Footer URL */}
      <div
        style={{
          display: "flex",
          fontSize: "24px",
          color: theme.accent,
          opacity: 0.9,
          letterSpacing: "1px",
        }}
      >
        {canonicalUrl}
      </div>
    </div>
  );
}
