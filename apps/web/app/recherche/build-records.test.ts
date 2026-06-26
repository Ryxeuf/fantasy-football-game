import { describe, expect, it } from "vitest";
import {
  compendiumRecords,
  skillRecords,
  positionRecords,
  rosterRecords,
  starRecords,
} from "./build-records";

describe("compendiumRecords", () => {
  const records = compendiumRecords();

  it("produit au moins un enregistrement par chapitre", () => {
    expect(records.length).toBeGreaterThan(0);
    expect(records.every((r) => r.type === "rule")).toBe(true);
  });

  it("crée des liens profonds vers /compendium avec ancre pour les sections", () => {
    const withAnchor = records.filter((r) => r.url.includes("#"));
    expect(withAnchor.length).toBeGreaterThan(0);
    for (const r of withAnchor) {
      expect(r.url).toMatch(/^\/compendium\/[^#]+#.+/);
    }
  });

  it("n'expose aucun marqueur illisible (corpus déjà nettoyé)", () => {
    for (const r of records) {
      expect(`${r.title} ${r.text}`).not.toMatch(/illisible/i);
    }
  });
});

describe("record builders d'API", () => {
  it("skillRecords mappe slug, titre et lien", () => {
    const [r] = skillRecords([
      { slug: "block", nameFr: "Blocage", description: "Relance.", category: "General" },
    ]);
    expect(r).toMatchObject({ type: "skill", title: "Blocage", url: "/skills/block" });
  });

  it("positionRecords construit le lien profond roster/position", () => {
    const [r] = positionRecords(
      [{ slug: "human_blitzer", displayName: "Blitzer", rosterSlug: "human" }],
      new Map([["human", "Humains"]]),
    );
    expect(r.type).toBe("position");
    expect(r.url).toBe("/teams/human/blitzer");
    expect(r.subtitle).toContain("Humains");
  });

  it("rosterRecords et starRecords produisent des liens", () => {
    expect(rosterRecords([{ slug: "human", name: "Humains", tier: "I" }])[0].url).toBe(
      "/teams/human",
    );
    expect(
      starRecords([{ slug: "morg", displayName: "Morg", specialRule: "Loner" }])[0]
        .type,
    ).toBe("star");
  });
});
