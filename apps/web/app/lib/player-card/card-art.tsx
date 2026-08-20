/**
 * Template visuel satori de la carte joueur (change `export-player-cards`).
 *
 * IMPORTANT : satori ne supporte que **flexbox** (pas de grid), les styles
 * inline, et les images embarquées en data URI. Deux pièges vérifiés :
 *  - les `<text>` d'un SVG embarqué ne sont PAS rendus (resvg sans fontes) —
 *    le monogramme de l'emblème est donc superposé en texte satori ;
 *  - les portraits `.webp` du site ne sont pas décodés par satori — la zone
 *    portrait est un emblème programmatique (logo roster / étoile), qui a
 *    aussi l'avantage de ne réutiliser aucun artwork Games Workshop dans un
 *    fichier téléchargeable.
 *
 * Identité visuelle Nuffle Arena (marine + or + couleur canonique du
 * roster), volontairement distincte de l'habillage des cartes officielles.
 * Dimensions : 750×1050 px = carte poker 63,5×88,9 mm à 300 dpi.
 */
import {
  getTeamColors,
  getTeamLogo,
  renderTeamLogoSvg,
} from "@bb/game-engine";
import { formatPlusStat } from "../format-stats";
import {
  CARD_LABELS,
  formatGoldAmount,
  hexFromColorNumber,
  isLightColor,
  nameFontSize,
  shadeHexColor,
  type PlayerCardData,
} from "./card-model";

export const PLAYER_CARD_WIDTH = 750;
export const PLAYER_CARD_HEIGHT = 1050;

const NAVY = "#101b33";
const GOLD = "#d9a520";
const GOLD_LIGHT = "#f3d37a";
const PARCHMENT = "#f4edda";
const INK = "#26303f";

interface CardTheme {
  readonly navy: string;
  readonly primary: string;
  readonly primaryDark: string;
  readonly primaryLight: string;
  readonly gold: string;
  readonly goldLight: string;
  /** Texte posé sur `primary` (bandeau nom) — marine si couleur claire. */
  readonly onPrimary: string;
  /** Couleur des grandes valeurs (stats) — assombrie si primaire claire. */
  readonly statValue: string;
}

/** Thème "légende" des Star Players (pourpre + or), hors couleurs roster. */
const STAR_THEME: CardTheme = {
  navy: NAVY,
  primary: "#a3122e",
  primaryDark: "#6d0b1e",
  primaryLight: "#d33c55",
  gold: GOLD,
  goldLight: GOLD_LIGHT,
  onPrimary: "#ffffff",
  statValue: "#a3122e",
};

/** Thème d'une carte à partir des couleurs canoniques du roster. */
export function buildCardTheme(data: PlayerCardData): CardTheme {
  if (data.kind === "star") return STAR_THEME;
  const colors = getTeamColors(data.rosterSlug);
  const primary = hexFromColorNumber(colors.primary);
  const light = isLightColor(primary);
  return {
    navy: NAVY,
    primary,
    primaryDark: shadeHexColor(primary, -0.35),
    primaryLight: shadeHexColor(primary, 0.22),
    gold: GOLD,
    goldLight: GOLD_LIGHT,
    onPrimary: light ? NAVY : "#ffffff",
    statValue: light ? shadeHexColor(primary, -0.55) : primary,
  };
}

function svgToDataUri(svg: string): string {
  const bytes = new TextEncoder().encode(svg);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

/** Étoile à cinq branches pour l'emblème des Star Players. */
function starEmblemSvg(fill: string, stroke: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">` +
    `<path d="M50 5 L61.2 37.6 L95.7 38.3 L68.2 59.1 L78.1 92.1 L50 72.4 ` +
    `L21.9 92.1 L31.8 59.1 L4.3 38.3 L38.8 37.6 Z" ` +
    `fill="${fill}" stroke="${stroke}" stroke-width="4" stroke-linejoin="round"/>` +
    `</svg>`
  );
}

/**
 * Emblème central : forme du logo roster (glyphe SVG masqué — non rendu par
 * satori) pour les joueurs d'équipe, étoile pour les Star Players. Le
 * monogramme est superposé séparément par le template.
 */
function emblemUri(data: PlayerCardData, theme: CardTheme): string {
  if (data.kind === "star") {
    return svgToDataUri(starEmblemSvg(theme.gold, theme.navy));
  }
  const logo = getTeamLogo(data.rosterSlug);
  return svgToDataUri(
    renderTeamLogoSvg(data.rosterSlug, {
      size: 300,
      logo: { shape: logo.shape, glyph: "" },
    }),
  );
}

/** Monogramme superposé au centre de l'emblème (vide pour une étoile). */
function emblemMonogram(data: PlayerCardData): string {
  if (data.kind === "star") return "";
  return getTeamLogo(data.rosterSlug).glyph;
}

interface StatPlateProps {
  label: string;
  value: string;
  theme: CardTheme;
}

function StatPlate({ label, value, theme }: StatPlateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "120px",
        marginBottom: "13px",
        transform: "skewY(-3deg)",
        boxShadow: "3px 4px 0 rgba(15,23,42,0.35)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          background: theme.navy,
          color: "#ffffff",
          fontFamily: "Montserrat",
          fontWeight: 800,
          fontSize: "20px",
          letterSpacing: "3px",
          padding: "3px 0",
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "#ffffff",
          color: theme.statValue,
          fontFamily: "Bebas Neue",
          fontSize: "56px",
          lineHeight: 1,
          padding: "6px 0 2px",
          borderLeft: `3px solid ${theme.navy}`,
          borderRight: `3px solid ${theme.navy}`,
          borderBottom: `3px solid ${theme.navy}`,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SectionTitle({ text, theme }: { text: string; theme: CardTheme }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", marginBottom: "6px" }}>
      <div
        style={{
          display: "flex",
          fontFamily: "Montserrat",
          fontWeight: 800,
          fontSize: "23px",
          letterSpacing: "2px",
          color: theme.statValue,
        }}
      >
        {text}
      </div>
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "3px",
          background: `linear-gradient(90deg, ${theme.statValue} 0%, ${theme.gold} 70%, rgba(0,0,0,0) 100%)`,
          marginTop: "3px",
        }}
      />
    </div>
  );
}

const SECTION_TEXT_STYLE = {
  display: "flex",
  fontFamily: "Montserrat",
  fontWeight: 600,
  fontSize: "23px",
  color: INK,
  lineHeight: 1.35,
  marginBottom: "15px",
} as const;

/**
 * Carte joueur complète, prête à être passée à `ImageResponse`. Fonction
 * pure : ne lit ni fichier ni réseau (les emblèmes sont des data URI).
 */
export function PlayerCardArt({ data }: { data: PlayerCardData }) {
  const theme = buildCardTheme(data);
  const labels = CARD_LABELS[data.lang];
  const monogram = emblemMonogram(data);
  const costText = data.cost !== null ? formatGoldAmount(data.cost) : null;
  return (
    <div
      style={{
        width: `${PLAYER_CARD_WIDTH}px`,
        height: `${PLAYER_CARD_HEIGHT}px`,
        display: "flex",
        fontFamily: "Montserrat",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: theme.navy,
          borderRadius: "34px",
          padding: "10px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            borderRadius: "26px",
            border: `3px solid ${theme.gold}`,
            background: PARCHMENT,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Bandeau nom, légèrement incliné, en pleine largeur. */}
          <div
            style={{
              display: "flex",
              position: "absolute",
              top: "40px",
              left: "-30px",
              width: `${PLAYER_CARD_WIDTH + 60}px`,
              transform: "rotate(-3deg)",
              background: `linear-gradient(90deg, ${theme.primaryDark} 0%, ${theme.primary} 55%, ${theme.primaryDark} 100%)`,
              boxShadow: "0 6px 0 rgba(15,23,42,0.3)",
              padding: "12px 60px 8px",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                fontFamily: "Bebas Neue",
                fontSize: `${nameFontSize(data.name)}px`,
                color: theme.onPrimary,
                letterSpacing: "3px",
                whiteSpace: "nowrap",
              }}
            >
              {data.name.toUpperCase()}
            </div>
          </div>

          {/* Marque + type de carte. */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "12px 24px 0",
              fontFamily: "Montserrat",
              fontWeight: 800,
              fontSize: "16px",
              letterSpacing: "4px",
              color: theme.navy,
            }}
          >
            <div style={{ display: "flex" }}>NUFFLE ARENA</div>
            <div style={{ display: "flex" }}>{data.kindLabel.toUpperCase()}</div>
          </div>

          {/* Corps : rail de stats + emblème + rubriques. */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              flexGrow: 1,
              marginTop: "128px",
              padding: "0 24px",
              marginBottom: "58px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginRight: "22px",
                flexShrink: 0,
              }}
            >
              <StatPlate label="MA" value={String(data.stats.ma)} theme={theme} />
              <StatPlate label="ST" value={String(data.stats.st)} theme={theme} />
              <StatPlate label="AG" value={formatPlusStat(data.stats.ag)} theme={theme} />
              <StatPlate label="PA" value={formatPlusStat(data.stats.pa)} theme={theme} />
              <StatPlate label="AV" value={formatPlusStat(data.stats.av)} theme={theme} />
              {costText ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    marginTop: "8px",
                    width: "120px",
                    background: theme.primary,
                    border: `3px solid ${theme.gold}`,
                    borderRadius: "12px",
                    padding: "8px 2px",
                    boxShadow: "3px 4px 0 rgba(15,23,42,0.35)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      fontFamily: "Montserrat",
                      fontWeight: 800,
                      fontSize: "14px",
                      letterSpacing: "1px",
                      color: theme.goldLight,
                    }}
                  >
                    {data.costLabel.toUpperCase()}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      fontFamily: "Bebas Neue",
                      fontSize: costText.length >= 8 ? "27px" : "32px",
                      lineHeight: 1.1,
                      color: theme.onPrimary,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {costText}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      fontFamily: "Montserrat",
                      fontWeight: 800,
                      fontSize: "13px",
                      letterSpacing: "2px",
                      color: theme.onPrimary,
                      opacity: 0.85,
                    }}
                  >
                    {CARD_LABELS[data.lang].gold}
                  </div>
                </div>
              ) : null}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flexGrow: 1,
                width: "534px",
              }}
            >
              {/* Emblème (remplit l'espace vertical restant). */}
              <div
                style={{
                  display: "flex",
                  position: "relative",
                  flexGrow: 1,
                  minHeight: "330px",
                  borderRadius: "18px",
                  background: `radial-gradient(circle at 50% 35%, ${theme.primaryLight} 0%, ${theme.primary} 55%, ${theme.primaryDark} 100%)`,
                  border: `3px solid ${theme.navy}`,
                  overflow: "hidden",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "18px",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- data URI satori */}
                <img
                  src={emblemUri(data, theme)}
                  width={270}
                  height={270}
                  alt=""
                  style={{ opacity: 0.96 }}
                />
                {monogram ? (
                  <div
                    style={{
                      display: "flex",
                      position: "absolute",
                      top: "0",
                      left: "0",
                      width: "100%",
                      height: "100%",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "Bebas Neue",
                      fontSize: monogram.length >= 3 ? "86px" : monogram.length === 2 ? "112px" : "140px",
                      color: theme.goldLight,
                    }}
                  >
                    {monogram}
                  </div>
                ) : null}
                {typeof data.number === "number" ? (
                  <div
                    style={{
                      display: "flex",
                      position: "absolute",
                      bottom: "-12px",
                      right: "16px",
                      fontFamily: "Bebas Neue",
                      fontSize: "120px",
                      color: "rgba(255,255,255,0.92)",
                    }}
                  >
                    {`#${data.number}`}
                  </div>
                ) : null}
                {data.ribbon ? (
                  <div
                    style={{
                      display: "flex",
                      position: "absolute",
                      top: "26px",
                      right: "-58px",
                      transform: "rotate(35deg)",
                      background: theme.gold,
                      color: theme.navy,
                      fontFamily: "Montserrat",
                      fontWeight: 800,
                      fontSize: "20px",
                      letterSpacing: "2px",
                      padding: "6px 70px",
                    }}
                  >
                    {data.ribbon.toUpperCase()}
                  </div>
                ) : null}
              </div>

              {/* Rubriques. */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <SectionTitle text={labels.skills} theme={theme} />
                <div style={SECTION_TEXT_STYLE}>
                  {data.skills.length ? data.skills.join(", ") : "—"}
                </div>
                <SectionTitle text={labels.playsFor} theme={theme} />
                <div style={SECTION_TEXT_STYLE}>
                  {data.playsFor.length ? data.playsFor.join(", ") : "—"}
                </div>
                <SectionTitle text={data.infoTitle} theme={theme} />
                {data.infoStats && data.infoStats.length ? (
                  <div style={{ display: "flex", flexDirection: "row", marginTop: "4px" }}>
                    {data.infoStats.map((stat) => (
                      <div
                        key={stat.label}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          marginRight: "14px",
                          background: "#ffffff",
                          border: `2px solid ${theme.navy}`,
                          borderRadius: "10px",
                          padding: "6px 16px",
                          boxShadow: "2px 3px 0 rgba(15,23,42,0.25)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            fontFamily: "Bebas Neue",
                            fontSize: "40px",
                            color: theme.statValue,
                            lineHeight: 1,
                          }}
                        >
                          {stat.value}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            fontFamily: "Montserrat",
                            fontWeight: 800,
                            fontSize: "14px",
                            letterSpacing: "1px",
                            color: theme.navy,
                          }}
                        >
                          {stat.label.toUpperCase()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      fontFamily: "Montserrat",
                      fontWeight: 600,
                      fontSize: "20px",
                      color: "#3d4451",
                      lineHeight: 1.4,
                    }}
                  >
                    {data.infoText ?? "—"}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Pied de carte. */}
          <div
            style={{
              display: "flex",
              position: "absolute",
              bottom: "0",
              left: "0",
              width: "100%",
              background: theme.navy,
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 26px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontFamily: "Bebas Neue",
                fontSize: "26px",
                letterSpacing: "3px",
                color: "#ffffff",
              }}
            >
              NUFFLE ARENA
            </div>
            <div
              style={{
                display: "flex",
                fontFamily: "Montserrat",
                fontWeight: 600,
                fontSize: "18px",
                color: theme.goldLight,
              }}
            >
              nufflearena.fr
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
