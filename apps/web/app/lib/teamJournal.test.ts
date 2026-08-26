/**
 * Tests du client de recherche transversale : sérialisation des filtres
 * (l'endroit où un mauvais encodage donnerait des résultats faussement
 * vides ou faussement larges) et lecture de l'en-tête d'export.
 */

import { describe, expect, it } from "vitest";

import { buildJournalQuery, parseFilename } from "./teamJournal";

/** Relit une query string en objet, pour asserter sans dépendre de l'ordre. */
function parse(qs: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(qs));
}

describe("buildJournalQuery", () => {
  it("rend une query vide quand aucun filtre n'est posé", () => {
    expect(buildJournalQuery({})).toBe("");
  });

  it("reprend les filtres texte en les trimant", () => {
    const q = parse(
      buildJournalQuery({ q: "  nuffle  ", teamSearch: "rats", ownerId: "u1" }),
    );
    expect(q.q).toBe("nuffle");
    expect(q.teamSearch).toBe("rats");
    expect(q.ownerId).toBe("u1");
  });

  it("OMET un filtre vide ou blanc plutôt que d'envoyer une chaîne vide", () => {
    const q = parse(buildJournalQuery({ q: "   ", teamSearch: "", action: "" }));
    expect(q).not.toHaveProperty("q");
    expect(q).not.toHaveProperty("teamSearch");
    expect(q).not.toHaveProperty("action");
  });

  it("n'envoie les drapeaux que lorsqu'ils sont actifs", () => {
    expect(parse(buildJournalQuery({ onlyEconomic: true }))).toHaveProperty(
      "onlyEconomic",
      "1",
    );
    expect(parse(buildJournalQuery({ onlyEconomic: false }))).not.toHaveProperty(
      "onlyEconomic",
    );
  });

  it("étend la borne de fin à la fin de journée", () => {
    // Sans cela, « jusqu'au 1er août » exclurait tout ce qui s'est passé
    // le 1er août — le filtre le plus naturel donnerait le résultat le plus
    // trompeur.
    const q = parse(
      buildJournalQuery({ since: "2026-08-01", until: "2026-08-31" }),
    );
    expect(q.since).toBe("2026-08-01T00:00:00.000Z");
    expect(q.until).toBe("2026-08-31T23:59:59.999Z");
  });

  it("convertit les seuils saisis en kpo vers les po attendus par l'API", () => {
    const q = parse(
      buildJournalQuery({ minTreasuryDeltaK: 100, minTeamValueDeltaK: 250 }),
    );
    expect(q.minAbsTreasuryDelta).toBe("100000");
    expect(q.minAbsTeamValueDelta).toBe("250000");
  });

  it("ignore un seuil nul ou négatif", () => {
    expect(parse(buildJournalQuery({ minTreasuryDeltaK: 0 }))).not.toHaveProperty(
      "minAbsTreasuryDelta",
    );
    expect(
      parse(buildJournalQuery({ minTreasuryDeltaK: -5 })),
    ).not.toHaveProperty("minAbsTreasuryDelta");
  });

  it("omet le tri par défaut et l'offset nul (query plus courte, même sens)", () => {
    const q = parse(buildJournalQuery({ order: "recent", offset: 0 }));
    expect(q).not.toHaveProperty("order");
    expect(q).not.toHaveProperty("offset");
  });

  it("transmet un tri non par défaut et une pagination réelle", () => {
    const q = parse(
      buildJournalQuery({ order: "treasury-impact", offset: 50, limit: 25 }),
    );
    expect(q.order).toBe("treasury-impact");
    expect(q.offset).toBe("50");
    expect(q.limit).toBe("25");
  });

  it("omet `limit` quand elle est absente (le serveur applique son défaut)", () => {
    expect(parse(buildJournalQuery({ limit: undefined }))).not.toHaveProperty(
      "limit",
    );
  });

  it("encode les caractères spéciaux d'une recherche libre", () => {
    const qs = buildJournalQuery({ q: "a&b=c" });
    expect(qs).toContain("q=a%26b%3Dc");
    expect(parse(qs).q).toBe("a&b=c");
  });
});

describe("parseFilename", () => {
  it("extrait le nom de fichier d'un Content-Disposition", () => {
    expect(
      parseFilename('attachment; filename="journal-equipes-2026-08-26.csv"'),
    ).toBe("journal-equipes-2026-08-26.csv");
  });

  it("accepte un nom non cité", () => {
    expect(parseFilename("attachment; filename=export.ndjson")).toBe(
      "export.ndjson",
    );
  });

  it("rend null quand l'en-tête est absent ou inexploitable", () => {
    expect(parseFilename(null)).toBeNull();
    expect(parseFilename("attachment")).toBeNull();
  });
});
