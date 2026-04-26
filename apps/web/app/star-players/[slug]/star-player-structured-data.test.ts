/**
 * Tests pour `buildStarPlayerSchema` (Q.11 — Sprint 23).
 *
 * Helper pur produisant le JSON-LD `Person` / `SportsAthlete` +
 * `BreadcrumbList` pour `/star-players/[slug]`. Memes invariants que
 * `buildTeamSchema` (Q.10) :
 *  - serializable JSON
 *  - resilient aux donnees partielles (specialRule absent, image absente)
 *  - canonical + dateModified
 */

import { describe, it, expect } from "vitest";
import { buildStarPlayerSchema } from "./star-player-structured-data";

const BASE_STAR = {
  slug: "morg_n_thorg",
  displayName: "Morg 'n' Thorg",
  cost: 430,
  ma: 6,
  st: 6,
  ag: 4,
  pa: 5 as number | null,
  av: 10,
  skills: "block,mighty-blow,thick-skull,loner",
  hirableBy: ["all"],
  specialRule: "Mega Star : impossible d'apothecaire.",
  specialRuleEn: "Mega Star: cannot use apothecary.",
  imageUrl: "/data/Star-Players_files/morg_n_thorg.jpg",
  isMegaStar: true,
};

describe("buildStarPlayerSchema", () => {
  it("retourne un @graph contenant Person/SportsAthlete et BreadcrumbList", () => {
    const schema = buildStarPlayerSchema({
      starPlayer: BASE_STAR,
      baseUrl: "https://nufflearena.fr",
    });
    expect(schema["@context"]).toBe("https://schema.org");
    const graph = schema["@graph"] as Array<Record<string, unknown>>;
    const personNode = graph.find((n) => {
      const t = n["@type"];
      return Array.isArray(t) && t.includes("Person") && t.includes("SportsAthlete");
    });
    expect(personNode).toBeDefined();
    expect(graph.some((n) => n["@type"] === "BreadcrumbList")).toBe(true);
  });

  it("definit url, name et sport", () => {
    const schema = buildStarPlayerSchema({
      starPlayer: BASE_STAR,
      baseUrl: "https://nufflearena.fr",
    });
    const node = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) =>
        Array.isArray(n["@type"]) && (n["@type"] as string[]).includes("Person"),
    )!;
    expect(node.name).toBe("Morg 'n' Thorg");
    expect(node.url).toBe(
      "https://nufflearena.fr/star-players/morg_n_thorg",
    );
    expect(node.sport).toBe("Blood Bowl");
    expect(node.jobTitle).toMatch(/Star Player/i);
  });

  it("@id est stable et derive du slug", () => {
    const schema = buildStarPlayerSchema({
      starPlayer: BASE_STAR,
      baseUrl: "https://nufflearena.fr",
    });
    const node = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) =>
        Array.isArray(n["@type"]) && (n["@type"] as string[]).includes("Person"),
    )!;
    expect(node["@id"]).toBe(
      "https://nufflearena.fr/star-players/morg_n_thorg#athlete",
    );
  });

  it("utilise la specialRule francaise quand lang=fr", () => {
    const schema = buildStarPlayerSchema({
      starPlayer: BASE_STAR,
      baseUrl: "https://nufflearena.fr",
      lang: "fr",
    });
    const node = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) =>
        Array.isArray(n["@type"]) && (n["@type"] as string[]).includes("Person"),
    )!;
    expect(node.description).toContain("apothecaire");
  });

  it("utilise la specialRule anglaise quand lang=en", () => {
    const schema = buildStarPlayerSchema({
      starPlayer: BASE_STAR,
      baseUrl: "https://nufflearena.fr",
      lang: "en",
    });
    const node = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) =>
        Array.isArray(n["@type"]) && (n["@type"] as string[]).includes("Person"),
    )!;
    expect(node.description).toContain("apothecary");
  });

  it("retombe sur un fallback si specialRule manque", () => {
    const schema = buildStarPlayerSchema({
      starPlayer: { ...BASE_STAR, specialRule: undefined, specialRuleEn: undefined },
      baseUrl: "https://nufflearena.fr",
    });
    const node = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) =>
        Array.isArray(n["@type"]) && (n["@type"] as string[]).includes("Person"),
    )!;
    expect(node.description).toBeTypeOf("string");
    expect((node.description as string).length).toBeGreaterThan(0);
  });

  it("inclut MA/ST/AG/PA/AV en additionalProperty", () => {
    const schema = buildStarPlayerSchema({
      starPlayer: BASE_STAR,
      baseUrl: "https://nufflearena.fr",
    });
    const node = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) =>
        Array.isArray(n["@type"]) && (n["@type"] as string[]).includes("Person"),
    )!;
    const props = node.additionalProperty as Array<{
      name: string;
      value: string | number;
    }>;
    expect(props.find((p) => p.name === "MA")?.value).toBe(6);
    expect(props.find((p) => p.name === "ST")?.value).toBe(6);
    expect(props.find((p) => p.name === "AG")?.value).toBe("4+");
    expect(props.find((p) => p.name === "PA")?.value).toBe("5+");
    expect(props.find((p) => p.name === "AV")?.value).toBe("10+");
  });

  it("affiche PA = -- quand pa est null", () => {
    const schema = buildStarPlayerSchema({
      starPlayer: { ...BASE_STAR, pa: null },
      baseUrl: "https://nufflearena.fr",
    });
    const node = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) =>
        Array.isArray(n["@type"]) && (n["@type"] as string[]).includes("Person"),
    )!;
    const props = node.additionalProperty as Array<{
      name: string;
      value: string | number;
    }>;
    expect(props.find((p) => p.name === "PA")?.value).toBe("-");
  });

  it("inclut le flag Mega Star quand isMegaStar=true", () => {
    const schema = buildStarPlayerSchema({
      starPlayer: BASE_STAR,
      baseUrl: "https://nufflearena.fr",
    });
    const node = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) =>
        Array.isArray(n["@type"]) && (n["@type"] as string[]).includes("Person"),
    )!;
    const props = node.additionalProperty as Array<{
      name: string;
      value: string | number;
    }>;
    expect(props.find((p) => p.name === "Mega Star")?.value).toBe("Oui");
  });

  it("expose les skills dans knowsAbout (citabilite LLM)", () => {
    const schema = buildStarPlayerSchema({
      starPlayer: BASE_STAR,
      baseUrl: "https://nufflearena.fr",
    });
    const node = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) =>
        Array.isArray(n["@type"]) && (n["@type"] as string[]).includes("Person"),
    )!;
    expect(node.knowsAbout).toEqual(
      expect.arrayContaining(["block", "mighty-blow", "thick-skull", "loner"]),
    );
  });

  it("convertit imageUrl du dossier asset vers public/images quand present", () => {
    const schema = buildStarPlayerSchema({
      starPlayer: BASE_STAR,
      baseUrl: "https://nufflearena.fr",
    });
    const node = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) =>
        Array.isArray(n["@type"]) && (n["@type"] as string[]).includes("Person"),
    )!;
    expect(node.image).toBe(
      "https://nufflearena.fr/images/star-players/morg_n_thorg.jpg",
    );
  });

  it("omet image si imageUrl manque", () => {
    const schema = buildStarPlayerSchema({
      starPlayer: { ...BASE_STAR, imageUrl: undefined },
      baseUrl: "https://nufflearena.fr",
    });
    const node = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (n) =>
        Array.isArray(n["@type"]) && (n["@type"] as string[]).includes("Person"),
    )!;
    expect(node.image).toBeUndefined();
  });

  it("breadcrumb : Accueil -> Star Players -> [nom]", () => {
    const schema = buildStarPlayerSchema({
      starPlayer: BASE_STAR,
      baseUrl: "https://nufflearena.fr",
    });
    const breadcrumb = (
      schema["@graph"] as Array<Record<string, unknown>>
    ).find((n) => n["@type"] === "BreadcrumbList")!;
    const items = breadcrumb.itemListElement as Array<{
      position: number;
      name: string;
      item: string;
    }>;
    expect(items.length).toBe(3);
    expect(items[0]).toMatchObject({ position: 1, name: "Accueil" });
    expect(items[1]).toMatchObject({ position: 2, name: "Star Players" });
    expect(items[2].name).toBe("Morg 'n' Thorg");
  });

  it("schema serializable JSON", () => {
    const schema = buildStarPlayerSchema({
      starPlayer: BASE_STAR,
      baseUrl: "https://nufflearena.fr",
    });
    expect(() => JSON.stringify(schema)).not.toThrow();
  });
});
