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

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

import PositionDetailPage, { generateMetadata } from "./page";

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

  it("appelle notFound() pour un segment inconnu", async () => {
    await expect(
      PositionDetailPage({
        params: { slug: "skaven", position: "inconnu" },
        searchParams: {},
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
