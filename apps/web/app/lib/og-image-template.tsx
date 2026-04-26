import type { OgImageContent } from "./og-image-content";

/**
 * Template visuel commun pour les Open Graph images dynamiques
 * (Q.14 — Sprint 23). Compatible avec satori (le rendu de Next.js
 * `ImageResponse`) : utilise uniquement flexbox + propriétés
 * supportées (pas de grid, pas de fonts custom externes).
 */
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

export function OgImageTemplate({ content }: { content: OgImageContent }) {
  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#0F172A",
        backgroundImage: `linear-gradient(135deg, ${content.accent} 0%, #0F172A 60%)`,
        color: "#FFFFFF",
        padding: 64,
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: 2,
          textTransform: "uppercase",
          opacity: 0.85,
        }}
      >
        Nuffle Arena
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontSize: 92,
            fontWeight: 900,
            lineHeight: 1.05,
            marginBottom: 24,
            display: "flex",
          }}
        >
          {content.title}
        </div>
        <div
          style={{
            fontSize: 32,
            opacity: 0.9,
            marginBottom: 32,
            display: "flex",
          }}
        >
          {content.subtitle}
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            fontSize: 26,
          }}
        >
          {content.badges.map((badge, idx) => (
            <span
              key={idx}
              style={{
                backgroundColor: "rgba(255,255,255,0.12)",
                border: "2px solid rgba(255,255,255,0.25)",
                padding: "10px 24px",
                borderRadius: 999,
                display: "flex",
              }}
            >
              {badge}
            </span>
          ))}
        </div>
      </div>

      <div
        style={{
          fontSize: 22,
          opacity: 0.7,
          display: "flex",
        }}
      >
        nufflearena.fr
      </div>
    </div>
  );
}
