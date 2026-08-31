import { describe, it, expect } from "vitest";
import {
  buildRosterShareDescription,
  buildRosterShareTitle,
  SHARE_DESCRIPTION_MAX,
  truncateOnWordBoundary,
} from "./roster-share-text";

describe("truncateOnWordBoundary", () => {
  it("laisse un texte court intact", () => {
    expect(truncateOnWordBoundary("Bande de rats", 200)).toBe("Bande de rats");
  });

  it("normalise les retours à la ligne et les espaces multiples", () => {
    expect(truncateOnWordBoundary("Bande\n\n  de   rats", 200)).toBe(
      "Bande de rats",
    );
  });

  it("coupe sur une frontière de mot et suffixe une ellipse", () => {
    const out = truncateOnWordBoundary("un deux trois quatre cinq", 14);
    expect(out).toBe("un deux trois…");
    expect(out.length).toBeLessThanOrEqual(14);
  });

  it("ne laisse pas de ponctuation orpheline avant l'ellipse", () => {
    expect(truncateOnWordBoundary("un deux, trois quatre", 12)).toBe("un deux…");
  });

  it("coupe au caractère quand un mot unique dépasse la borne", () => {
    const out = truncateOnWordBoundary("a".repeat(50), 10);
    expect(out).toBe(`${"a".repeat(9)}…`);
  });
});

describe("buildRosterShareTitle", () => {
  it("porte le nom de l'équipe ET celui du site", () => {
    const title = buildRosterShareTitle({
      teamName: "Les Rats Véloces",
      raceName: "Skaven",
    });
    expect(title).toBe("Les Rats Véloces — Skaven | Nuffle Arena");
  });

  it("reste lisible sans race connue", () => {
    expect(buildRosterShareTitle({ teamName: "Les Rats Véloces" })).toBe(
      "Les Rats Véloces | Nuffle Arena",
    );
    expect(
      buildRosterShareTitle({ teamName: "Les Rats Véloces", raceName: "  " }),
    ).toBe("Les Rats Véloces | Nuffle Arena");
  });
});

describe("buildRosterShareDescription", () => {
  const base = {
    teamName: "Les Rats Véloces",
    raceName: "Skaven",
    playerCount: 13,
    teamValue: 1_150_000,
  };

  it("sert la description du coach quand elle existe", () => {
    expect(
      buildRosterShareDescription({
        ...base,
        description: "Une bande de rats qui court plus vite que son ombre.",
      }),
    ).toBe("Une bande de rats qui court plus vite que son ombre.");
  });

  it("tronque la description du coach à la borne de partage", () => {
    const long = "Fluff ".repeat(120);
    const out = buildRosterShareDescription({ ...base, description: long });
    expect(out.length).toBeLessThanOrEqual(SHARE_DESCRIPTION_MAX);
    expect(out.endsWith("…")).toBe(true);
  });

  it("retombe sur la description générée sans fluff", () => {
    const out = buildRosterShareDescription(base);
    expect(out).toContain("Les Rats Véloces");
    expect(out).toContain("Skaven");
    expect(out).toContain("13 joueurs");
    expect(out).toContain("Nuffle Arena");
  });

  it("traite une description blanche comme absente", () => {
    const blank = buildRosterShareDescription({ ...base, description: "   " });
    expect(blank).toBe(buildRosterShareDescription(base));
  });

  it("n'affiche jamais une valeur d'équipe négative", () => {
    const out = buildRosterShareDescription({ ...base, teamValue: -5 });
    expect(out).toContain("0 po");
  });
});
