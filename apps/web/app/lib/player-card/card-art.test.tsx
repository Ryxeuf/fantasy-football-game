import { describe, expect, it } from "vitest";
import type { ReactElement, ReactNode } from "react";
import {
  buildCardTheme,
  PlayerCardArt,
  PLAYER_CARD_HEIGHT,
  PLAYER_CARD_WIDTH,
} from "./card-art";
import {
  buildStarPlayerCardData,
  buildTeamPlayerCardData,
  type PlayerCardData,
} from "./card-model";

/** Aplati récursivement tous les nœuds texte de l'arbre React (sans DOM). */
function collectText(node: ReactNode, out: string[] = []): string[] {
  if (node === null || node === undefined || typeof node === "boolean") {
    return out;
  }
  if (typeof node === "string" || typeof node === "number") {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, out);
    return out;
  }
  const element = node as ReactElement;
  if (typeof element.type === "function") {
    // Composant fonction (StatPlate, SectionTitle…) : on l'expanse.
    return collectText(
      (element.type as (props: unknown) => ReactNode)(element.props),
      out,
    );
  }
  if (element.props) {
    collectText(element.props.children as ReactNode, out);
  }
  return out;
}

/** Collecte les `src` des <img> de l'arbre. */
function collectImageSrcs(node: ReactNode, out: string[] = []): string[] {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const child of node) collectImageSrcs(child, out);
    return out;
  }
  const element = node as ReactElement;
  if (typeof element.type === "function") {
    return collectImageSrcs(
      (element.type as (props: unknown) => ReactNode)(element.props),
      out,
    );
  }
  if (element.type === "img" && typeof element.props?.src === "string") {
    out.push(element.props.src);
  }
  if (element.props) {
    collectImageSrcs(element.props.children as ReactNode, out);
  }
  return out;
}

function teamCard(overrides: Partial<PlayerCardData> = {}): PlayerCardData {
  return {
    ...buildTeamPlayerCardData(
      {
        name: "Kratch Déverminé",
        number: 4,
        ma: 9,
        st: 3,
        ag: 2,
        pa: null,
        av: 8,
        skills: "block,dodge",
        spp: 24,
        matchesPlayed: 12,
        totalTouchdowns: 7,
        totalCasualties: 3,
      },
      {
        lang: "fr",
        positionName: "Blitzer",
        teamName: "Les Rats des Égouts",
        rosterName: "Skavens",
        rosterSlug: "skaven",
        cost: 90_000,
      },
    ),
    ...overrides,
  };
}

describe("PlayerCardArt", () => {
  it("rend le nom en capitales, les stats formatées et la carrière", () => {
    const texts = collectText(PlayerCardArt({ data: teamCard() }));
    expect(texts).toContain("KRATCH DÉVERMINÉ");
    expect(texts).toContain("BLITZER");
    expect(texts).toContain("9");
    expect(texts).toContain("2+");
    // PA null → "-".
    expect(texts).toContain("-");
    expect(texts).toContain("#4");
    expect(texts.join(" ")).toContain("Blocage, Esquive");
    expect(texts).toContain("COMPÉTENCES & TRAITS");
    expect(texts).toContain("JOUE POUR");
    expect(texts).toContain("CARRIÈRE");
    expect(texts).toContain("90 000");
    expect(texts).toContain("PO");
    expect(texts).toContain("MATCHS");
    expect(texts).toContain("nufflearena.fr");
  });

  it("superpose le monogramme du roster (les <text> SVG ne sont pas rendus par satori)", () => {
    const element = PlayerCardArt({ data: teamCard() });
    const texts = collectText(element);
    // Monogramme skaven = "S" (cf. ROSTER_LOGOS), rendu en texte satori.
    expect(texts).toContain("S");
    const srcs = collectImageSrcs(element);
    expect(srcs).toHaveLength(1);
    expect(srcs[0].startsWith("data:image/svg+xml;base64,")).toBe(true);
    // Le SVG embarqué ne porte pas de glyphe (masqué, non rendu par resvg).
    const svg = atob(srcs[0].split(",")[1]);
    expect(svg).toContain("<svg");
    expect(svg).not.toContain(">S</text>");
  });

  it("rend une carte star avec ruban, étoile et règle spéciale", () => {
    const star = buildStarPlayerCardData(
      {
        displayName: "Griff Oberwald",
        cost: 280_000,
        ma: 7,
        st: 4,
        ag: 2,
        pa: 3,
        av: 9,
        skills: "block,dodge",
        isMegaStar: true,
        specialRule: "Une fois par match, relance un dé.",
      },
      { lang: "fr", playsFor: ["Humains", "Nains"] },
    );
    const element = PlayerCardArt({ data: star });
    const texts = collectText(element);
    expect(texts).toContain("GRIFF OBERWALD");
    expect(texts).toContain("STAR PLAYER");
    expect(texts).toContain("MEGA-STAR");
    expect(texts).toContain("RÈGLE SPÉCIALE");
    expect(texts).toContain("Une fois par match, relance un dé.");
    expect(texts.join(" ")).toContain("Humains, Nains");
    // Emblème étoile embarqué en data URI.
    const svg = atob(collectImageSrcs(element)[0].split(",")[1]);
    expect(svg).toContain("path");
  });

  it("affiche des tirets pour les rubriques vides et masque coût/numéro absents", () => {
    const card = teamCard({
      skills: [],
      playsFor: [],
      cost: null,
      number: undefined,
    });
    const texts = collectText(PlayerCardArt({ data: card }));
    expect(texts.filter((t) => t === "—").length).toBeGreaterThanOrEqual(2);
    expect(texts).not.toContain("VALEUR");
    expect(texts.some((t) => t.startsWith("#"))).toBe(false);
  });

  it("expose les dimensions carte poker 300 dpi", () => {
    expect(PLAYER_CARD_WIDTH).toBe(750);
    expect(PLAYER_CARD_HEIGHT).toBe(1050);
  });
});

describe("buildCardTheme", () => {
  it("thème légende fixe pour les stars", () => {
    const star = buildStarPlayerCardData(
      {
        displayName: "X",
        cost: 100_000,
        ma: 6,
        st: 3,
        ag: 3,
        pa: null,
        av: 9,
        skills: "",
      },
      { lang: "fr", playsFor: [] },
    );
    const theme = buildCardTheme(star);
    expect(theme.primary).toBe("#a3122e");
    expect(theme.onPrimary).toBe("#ffffff");
  });

  it("dérive le thème des couleurs canoniques du roster (repli par défaut)", () => {
    const known = buildCardTheme(teamCard());
    const fallback = buildCardTheme(teamCard({ rosterSlug: undefined }));
    expect(known.primary).toMatch(/^#[0-9a-f]{6}$/);
    expect(fallback.primary).toMatch(/^#[0-9a-f]{6}$/);
    expect(known.primary).not.toBe(fallback.primary);
  });
});
