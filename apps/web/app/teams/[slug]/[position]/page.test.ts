import { describe, it, expect, vi } from "vitest";

// Fixtures definies dans `vi.hoisted` pour etre accessibles depuis la factory
// `vi.mock` (hoistee au-dessus des declarations de module).
const { respond } = vi.hoisted(() => {
  const ROSTER = {
    slug: "skaven",
    name: "Skavens",
    budget: 1000,
    tier: "I",
    naf: false,
    positions: [
      {
        slug: "skaven_lineman",
        displayName: "Lineman",
        cost: 50,
        min: 0,
        max: 16,
        ma: 7,
        st: 3,
        ag: 3,
        pa: 4,
        av: 8,
        skills: "",
        primarySkills: "G",
        secondarySkills: "A,S",
      },
      {
        slug: "skaven_gutter_runner",
        displayName: "Gutter Runner",
        cost: 85,
        min: 0,
        max: 4,
        ma: 9,
        st: 2,
        ag: 2,
        pa: 4,
        av: 8,
        skills: "dodge",
        primarySkills: "A",
        secondarySkills: "G",
      },
      {
        // Poste porteur du contenu editorial (image / description / fluff).
        slug: "skaven_thrower",
        displayName: "Thrower",
        cost: 65,
        min: 0,
        max: 2,
        ma: 7,
        st: 3,
        ag: 3,
        pa: 2,
        av: 8,
        skills: "dodge",
        primarySkills: "G,P",
        secondarySkills: "A",
        imageUrl: "/images/positions/skaven_thrower.png",
        description: "Le relais de passe des tunnels.",
        fluff: "On raconte qu'il vise mieux dans le noir.",
      },
      {
        // Reproduit le bug : code d'acces "K" (Sournoiserie) absent de ACCESS_FR
        // faisait crasher le rendu (ACCESS_FR["K"] === undefined -> .letter).
        slug: "skaven_assassin",
        displayName: "Assassin",
        cost: 70,
        min: 0,
        max: 2,
        ma: 7,
        st: 3,
        ag: 3,
        pa: 5,
        av: 8,
        skills: "",
        primarySkills: "A,K",
        secondarySkills: "G,S",
      },
    ],
  };
  const respond = (url: string) => {
    if (url.includes("/api/skills")) {
      return Promise.resolve({
        skills: [{ slug: "dodge", nameFr: "Esquive" }],
      });
    }
    if (url.includes("/api/rosters/skaven")) {
      return Promise.resolve({ roster: ROSTER, ruleset: "season_3" });
    }
    return Promise.resolve(null);
  };
  return { respond };
});

vi.mock("../../../lib/serverApi", () => ({
  getServerApiBase: () => "http://test",
  fetchServerJson: vi.fn((url: string) => respond(url)),
  safeServerJson: vi.fn((url: string) => respond(url)),
}));

// `CatalogToolsBar` (pied de page de la fiche) consomme le contexte de langue.
vi.mock("../../../contexts/LanguageContext", () => ({
  useLanguage: () => ({ language: "fr" }),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

import { renderToStaticMarkup } from "react-dom/server";

import PositionDetailPage, { generateMetadata } from "./page";

/** Rend l'element serveur en HTML pour assertions de contenu. */
async function renderPage(position: string, ruleset?: string) {
  const element = await PositionDetailPage({
    params: { slug: "skaven", position },
    searchParams: ruleset ? { ruleset } : {},
  });
  return renderToStaticMarkup(element as React.ReactElement);
}

describe("generateMetadata (position)", () => {
  it("construit titre + canonical pour une position connue", async () => {
    const meta = await generateMetadata({
      params: { slug: "skaven", position: "gutter_runner" },
      searchParams: {},
    });
    expect(String(meta.title)).toContain("Gutter Runner");
    expect(String(meta.title)).toContain("Skavens");
    expect(meta.alternates?.canonical).toMatch(
      /\/teams\/skaven\/gutter_runner$/,
    );
  });

  it("renvoie noindex pour une position inconnue", async () => {
    const meta = await generateMetadata({
      params: { slug: "skaven", position: "inconnu" },
      searchParams: {},
    });
    expect(meta.title).toBe("Position introuvable");
    expect(meta.robots).toMatchObject({ index: false });
  });
});

describe("PositionDetailPage", () => {
  it("rend un element pour une position connue", async () => {
    const element = await PositionDetailPage({
      params: { slug: "skaven", position: "gutter_runner" },
      searchParams: {},
    });
    expect(element).toBeTruthy();
  });

  it("rend une position avec le code d'acces K (Sournoiserie) sans crasher", async () => {
    const element = await PositionDetailPage({
      params: { slug: "skaven", position: "assassin" },
      searchParams: {},
    });
    expect(element).toBeTruthy();
  });

  it("affiche l'illustration, la description et le fluff du poste", async () => {
    const html = await renderPage("thrower");
    expect(html).toContain("skaven_thrower.png");
    expect(html).toContain("Le relais de passe des tunnels.");
    expect(html).toContain("On raconte qu&#x27;il vise mieux dans le noir.");
  });

  it("n'affiche aucune section editoriale quand le poste n'a pas de contenu", async () => {
    const html = await renderPage("gutter_runner");
    expect(html).not.toContain('data-testid="position-illustration"');
    expect(html).not.toContain('data-testid="position-description"');
    expect(html).not.toContain('data-testid="position-fluff"');
  });

  it("affiche l'edition de regles servie et permet d'en changer", async () => {
    const html = await renderPage("gutter_runner");
    expect(html).toContain('data-testid="position-ruleset"');
    expect(html).toContain("Saison 3");
    expect(html).toContain("/teams/skaven/gutter_runner?ruleset=season_2");
  });

  it("appelle notFound() pour un segment inconnu", async () => {
    await expect(
      PositionDetailPage({
        params: { slug: "skaven", position: "inconnu" },
        searchParams: {},
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
