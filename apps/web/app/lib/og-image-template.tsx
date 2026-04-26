/**
 * Template visuel React pour ImageResponse / satori (Q.14 — Sprint 23).
 *
 * IMPORTANT : satori ne supporte que **flexbox** (pas de grid).
 * Toutes les positions sont gerees via display: flex et les
 * dimensions absolutes (px / fractions de 1200x630).
 *
 * Le template est purement presentation : il consomme la structure
 * { title, subtitle, badges[], accent } produite par
 * `og-image-content.ts` et la mappe sur des elements styles inline.
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
};

interface OgImageTemplateProps {
  content: OgContent;
  /** URL canonique a afficher en footer (ex: nufflearena.fr/teams/skaven). */
  canonicalUrl: string;
}

export function OgImageTemplate({ content, canonicalUrl }: OgImageTemplateProps) {
  const theme = THEMES[content.accent];

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

      {/* Title block (centered vertically via flex-grow) */}
      <div
        style={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontSize: "92px",
            fontWeight: 800,
            lineHeight: 1.05,
            color: theme.text,
            marginBottom: "24px",
            // satori ne wrap pas automatiquement les longs titres ; on
            // augmente la zone via maxWidth pour eviter la troncature.
            maxWidth: "1040px",
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
