/**
 * Tests des routes `/admin/team-journal/*` : validation/coercition des
 * filtres par les schémas Zod, projection query → filtres de service, et
 * nommage des exports.
 *
 * Les handlers eux-mêmes sont de fines coquilles autour de
 * `services/team-audit-search` (testé à part) : on vérifie ici le contrat de
 * bordure, là où un drift schéma/handler passerait inaperçu.
 */

import { describe, expect, it } from "vitest";

import {
  adminTeamJournalExportQuerySchema,
  adminTeamJournalQuerySchema,
  adminTeamJournalStatsQuerySchema,
} from "../schemas/admin-team-journal.schemas";
import { exportFilename, toSearchFilters } from "./admin-team-journal";
import {
  MAX_EXPORT_ROWS,
  MAX_SEARCH_PAGE_SIZE,
} from "../services/team-audit-search";

describe("adminTeamJournalQuerySchema", () => {
  it("applique les défauts sur une query vide", () => {
    const parsed = adminTeamJournalQuerySchema.parse({});
    expect(parsed.limit).toBe(50);
    expect(parsed.offset).toBe(0);
    expect(parsed.order).toBe("recent");
    expect(parsed.onlyEconomic).toBe(false);
    expect(parsed.deep).toBe(false);
  });

  it("coerce les nombres et les dates venus de la query string", () => {
    const parsed = adminTeamJournalQuerySchema.parse({
      limit: "25",
      offset: "100",
      minAbsTreasuryDelta: "100000",
      since: "2026-01-01T00:00:00.000Z",
    });
    expect(parsed.limit).toBe(25);
    expect(parsed.offset).toBe(100);
    expect(parsed.minAbsTreasuryDelta).toBe(100_000);
    expect(parsed.since).toBeInstanceOf(Date);
  });

  it("accepte les drapeaux sous leurs deux écritures", () => {
    expect(adminTeamJournalQuerySchema.parse({ onlyEconomic: "1" }).onlyEconomic).toBe(true);
    expect(
      adminTeamJournalQuerySchema.parse({ onlyEconomic: "true" }).onlyEconomic,
    ).toBe(true);
    expect(adminTeamJournalQuerySchema.parse({ onlyFailed: "0" }).onlyFailed).toBe(
      false,
    );
  });

  it("traite une chaîne vide comme un filtre absent", () => {
    const parsed = adminTeamJournalQuerySchema.parse({ q: "", teamSearch: "  " });
    expect(parsed.q).toBeUndefined();
    expect(parsed.teamSearch).toBeUndefined();
  });

  it("trime les filtres texte", () => {
    expect(adminTeamJournalQuerySchema.parse({ q: "  nuffle  " }).q).toBe("nuffle");
  });

  it("refuse une taille de page au-delà du plafond", () => {
    expect(
      adminTeamJournalQuerySchema.safeParse({ limit: String(MAX_SEARCH_PAGE_SIZE + 1) })
        .success,
    ).toBe(false);
  });

  it("refuse un rôle, une source ou un ordre inconnus", () => {
    expect(adminTeamJournalQuerySchema.safeParse({ actorRole: "root" }).success).toBe(
      false,
    );
    expect(adminTeamJournalQuerySchema.safeParse({ source: "ftp" }).success).toBe(
      false,
    );
    expect(adminTeamJournalQuerySchema.safeParse({ order: "random" }).success).toBe(
      false,
    );
  });

  it("refuse un seuil négatif", () => {
    expect(
      adminTeamJournalQuerySchema.safeParse({ minAbsTreasuryDelta: "-1" }).success,
    ).toBe(false);
  });

  it("refuse une date illisible plutôt que de filtrer sur `Invalid Date`", () => {
    expect(
      adminTeamJournalQuerySchema.safeParse({ since: "pas-une-date" }).success,
    ).toBe(false);
  });
});

describe("adminTeamJournalExportQuerySchema", () => {
  it("exporte en CSV par défaut, plafonné", () => {
    const parsed = adminTeamJournalExportQuerySchema.parse({});
    expect(parsed.format).toBe("csv");
    expect(parsed.limit).toBe(MAX_EXPORT_ROWS);
  });

  it("accepte le NDJSON et refuse tout autre format", () => {
    expect(
      adminTeamJournalExportQuerySchema.parse({ format: "ndjson" }).format,
    ).toBe("ndjson");
    expect(
      adminTeamJournalExportQuerySchema.safeParse({ format: "xlsx" }).success,
    ).toBe(false);
  });

  it("refuse un export au-delà du plafond plutôt que de tronquer en silence", () => {
    expect(
      adminTeamJournalExportQuerySchema.safeParse({
        limit: String(MAX_EXPORT_ROWS + 1),
      }).success,
    ).toBe(false);
  });
});

describe("adminTeamJournalStatsQuerySchema", () => {
  it("borne le nombre de lignes d'agrégat", () => {
    expect(adminTeamJournalStatsQuerySchema.parse({}).topN).toBe(15);
    expect(adminTeamJournalStatsQuerySchema.parse({ topN: "50" }).topN).toBe(50);
    expect(adminTeamJournalStatsQuerySchema.safeParse({ topN: "51" }).success).toBe(
      false,
    );
  });
});

describe("toSearchFilters", () => {
  it("projette une query complète en filtres de service", () => {
    const query = adminTeamJournalQuerySchema.parse({
      teamSearch: "rats",
      actorRole: "commissioner",
      actionPrefix: "team.purchase",
      onlyEconomic: "1",
      minAbsTreasuryDelta: "100000",
      q: "nuffle",
      deep: "1",
      limit: "25",
      offset: "50",
      order: "treasury-impact",
    });

    expect(toSearchFilters(query)).toMatchObject({
      teamSearch: "rats",
      actorRole: "commissioner",
      actionPrefix: "team.purchase",
      onlyEconomic: true,
      minAbsTreasuryDelta: 100_000,
      q: "nuffle",
      deep: true,
      limit: 25,
      offset: 50,
      order: "treasury-impact",
    });
  });

  it("normalise les filtres absents en null (et pas en undefined)", () => {
    const filters = toSearchFilters(adminTeamJournalQuerySchema.parse({}));
    expect(filters.teamId).toBeNull();
    expect(filters.q).toBeNull();
    expect(filters.since).toBeNull();
  });

  it("n'ajoute ni pagination ni tri pour une requête d'agrégats", () => {
    const filters = toSearchFilters(adminTeamJournalStatsQuerySchema.parse({}));
    expect(filters).not.toHaveProperty("limit");
    expect(filters).not.toHaveProperty("order");
  });

  it("porte la pagination et le tri d'un export", () => {
    const filters = toSearchFilters(
      adminTeamJournalExportQuerySchema.parse({ order: "oldest" }),
    );
    expect(filters.limit).toBe(MAX_EXPORT_ROWS);
    expect(filters.order).toBe("oldest");
  });
});

describe("exportFilename", () => {
  it("horodate le fichier avec l'extension du format", () => {
    const name = exportFilename("csv", new Date("2026-08-26T19:30:00.000Z"));
    expect(name).toBe("journal-equipes-2026-08-26T19-30-00.csv");
    expect(exportFilename("ndjson", new Date("2026-08-26T19:30:00.000Z"))).toMatch(
      /\.ndjson$/,
    );
  });

  it("n'émet aucun `:` — illégal dans un nom de fichier Windows", () => {
    expect(exportFilename("csv", new Date())).not.toContain(":");
  });
});
