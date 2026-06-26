import { describe, expect, it } from "vitest";
import {
  fold,
  queryTerms,
  searchRecords,
  countByType,
  type SearchRecord,
} from "./search";

const RECORDS: SearchRecord[] = [
  {
    id: "rule:blessures",
    type: "rule",
    title: "Blessures",
    subtitle: "Règles",
    text: "Quand un joueur est mis à terre, on effectue un jet d'armure.",
    url: "/compendium/blessures",
  },
  {
    id: "skill:blocage",
    type: "skill",
    title: "Blocage",
    subtitle: "Compétence",
    text: "Permet de relancer un résultat de blocage.",
    url: "/skills/blocage",
  },
  {
    id: "position:blitzer",
    type: "position",
    title: "Blitzer",
    subtitle: "Position · Humains",
    text: "Blitzer Humain rapide et polyvalent.",
    url: "/teams/human/blitzer",
  },
];

describe("fold", () => {
  it("retire les accents en conservant la longueur", () => {
    expect(fold("Élévation")).toBe("elevation");
    expect(fold("Élévation").length).toBe("Élévation".length);
  });
});

describe("queryTerms", () => {
  it("découpe et filtre les termes courts", () => {
    expect(queryTerms("le Jet d'armure")).toEqual(["le", "jet", "armure"]);
    expect(queryTerms("à")).toEqual([]);
  });
});

describe("searchRecords", () => {
  it("trouve par titre, accent-insensible", () => {
    const hits = searchRecords(RECORDS, "blessures");
    expect(hits[0].record.id).toBe("rule:blessures");
  });

  it("classe une correspondance de titre avant une correspondance de corps", () => {
    const hits = searchRecords(RECORDS, "blocage");
    expect(hits[0].record.id).toBe("skill:blocage");
  });

  it("exige que tous les termes soient présents (ET)", () => {
    expect(searchRecords(RECORDS, "blitzer humain").length).toBe(1);
    expect(searchRecords(RECORDS, "blitzer orque")).toEqual([]);
  });

  it("renvoie un extrait autour de la correspondance", () => {
    const hits = searchRecords(RECORDS, "armure");
    expect(hits[0].snippet.toLowerCase()).toContain("armure");
  });

  it("renvoie vide pour une requête vide", () => {
    expect(searchRecords(RECORDS, "")).toEqual([]);
    expect(searchRecords(RECORDS, "  ")).toEqual([]);
  });

  it("compte par type", () => {
    const counts = countByType(searchRecords(RECORDS, "bl"));
    expect(counts.rule).toBe(1);
    expect(counts.skill).toBe(1);
    expect(counts.position).toBe(1);
  });
});
