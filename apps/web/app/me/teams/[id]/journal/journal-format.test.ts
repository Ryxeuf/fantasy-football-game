/**
 * Tests du formatage du journal d'équipe : regroupement par opération,
 * cumul des variations, libellés et unités.
 */

import { describe, expect, it } from "vitest";

import {
  deltaToneClass,
  formatChanges,
  formatGold,
  formatGoldDelta,
  formatTimestamp,
  groupByOperation,
  type JournalEntry,
} from "./journal-format";

function entry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: "e1",
    createdAt: "2026-08-01T10:00:00.000Z",
    correlationId: "req-1",
    step: 1,
    action: "team.purchase.player",
    entity: "Team",
    entityId: null,
    actorUserId: "u1",
    actorRole: "owner",
    actorLabel: "Nuffle",
    impersonatorId: null,
    source: "http",
    route: "POST /team/:id/purchase",
    ipAddress: null,
    changes: null,
    before: null,
    after: null,
    details: null,
    treasury: 320_000,
    teamValue: 1_000_000,
    currentValue: 950_000,
    treasuryDelta: -80_000,
    teamValueDelta: 0,
    note: null,
    summary: "Achat d'un joueur par Nuffle",
    ...overrides,
  };
}

describe("groupByOperation", () => {
  it("regroupe les étapes d'une requête et les remet dans l'ordre d'exécution", () => {
    const ops = groupByOperation([
      entry({ id: "e2", step: 2, action: "team.values.recompute" }),
      entry({ id: "e1", step: 1 }),
    ]);

    expect(ops).toHaveLength(1);
    expect(ops[0].steps.map((s) => s.step)).toEqual([1, 2]);
    // La tête d'affiche est la 1re étape : celle qui nomme l'acte métier,
    // pas le recalcul de VE qui la suit.
    expect(ops[0].headline).toBe("Achat d'un joueur par Nuffle");
  });

  it("cumule les variations d'or et de VE sur toute l'opération", () => {
    const ops = groupByOperation([
      entry({ id: "e1", step: 1, treasuryDelta: -80_000, teamValueDelta: 0 }),
      entry({
        id: "e2",
        step: 2,
        treasuryDelta: 0,
        teamValueDelta: 80_000,
        teamValue: 1_080_000,
        treasury: 320_000,
      }),
    ]);

    expect(ops[0].treasuryDelta).toBe(-80_000);
    expect(ops[0].teamValueDelta).toBe(80_000);
    // L'état final vient de la DERNIÈRE étape qui le porte.
    expect(ops[0].treasuryAfter).toBe(320_000);
    expect(ops[0].teamValueAfter).toBe(1_080_000);
  });

  it("sépare deux opérations distinctes, la plus récente en tête", () => {
    const ops = groupByOperation([
      entry({
        id: "a",
        correlationId: "req-old",
        createdAt: "2026-08-01T09:00:00.000Z",
      }),
      entry({
        id: "b",
        correlationId: "req-new",
        createdAt: "2026-08-01T11:00:00.000Z",
      }),
    ]);

    expect(ops.map((o) => o.correlationId)).toEqual(["req-new", "req-old"]);
  });

  it("marque une opération dont une étape a échoué", () => {
    const ops = groupByOperation([
      entry({ id: "e1", step: 1, action: "team.purchase.player.failed" }),
    ]);
    expect(ops[0].failed).toBe(true);
  });

  it("rend un état final null quand aucune étape ne le porte", () => {
    const ops = groupByOperation([
      entry({ treasury: null, teamValue: null, treasuryDelta: null }),
    ]);
    expect(ops[0].treasuryAfter).toBeNull();
    expect(ops[0].teamValueAfter).toBeNull();
    expect(ops[0].treasuryDelta).toBe(0);
  });

  it("rend une liste vide sur une page vide", () => {
    expect(groupByOperation([])).toEqual([]);
  });
});

describe("formatGold / formatGoldDelta", () => {
  it("formate les montants en milliers d'or", () => {
    expect(formatGold(320_000)).toBe("320k po");
    expect(formatGold(0)).toBe("0k po");
    expect(formatGold(null)).toBe("—");
  });

  it("signe les variations et neutralise le zéro", () => {
    expect(formatGoldDelta(80_000)).toBe("+80k po");
    expect(formatGoldDelta(-80_000)).toBe("-80k po");
    expect(formatGoldDelta(0)).toBe("—");
    expect(formatGoldDelta(null)).toBe("—");
  });
});

describe("deltaToneClass", () => {
  it("colore l'or qui entre en vert, celui qui sort en rouge", () => {
    expect(deltaToneClass(1)).toContain("green");
    expect(deltaToneClass(-1)).toContain("red");
    expect(deltaToneClass(0)).toContain("gray");
  });
});

describe("formatChanges", () => {
  it("libelle les champs et formate l'or en kpo", () => {
    const formatted = formatChanges({
      treasury: { from: 400_000, to: 320_000 },
      apothecary: { from: false, to: true },
      rerolls: { from: 2, to: 3 },
    });

    expect(formatted).toContainEqual({
      field: "treasury",
      label: "Trésorerie",
      from: "400k po",
      to: "320k po",
    });
    expect(formatted).toContainEqual({
      field: "apothecary",
      label: "Apothicaire",
      from: "non",
      to: "oui",
    });
    // Un compteur reste un nombre brut : le formater en or serait faux.
    expect(formatted).toContainEqual({
      field: "rerolls",
      label: "Relances",
      from: "2",
      to: "3",
    });
  });

  it("affiche « — » pour une valeur absente (création)", () => {
    expect(formatChanges({ treasury: { from: null, to: 0 } })[0].from).toBe("—");
  });

  it("retombe sur le nom brut d'un champ non libellé", () => {
    expect(formatChanges({ champInconnu: { from: 1, to: 2 } })[0].label).toBe(
      "champInconnu",
    );
  });

  it("rend une liste vide quand il n'y a pas de diff", () => {
    expect(formatChanges(null)).toEqual([]);
  });
});

describe("formatTimestamp", () => {
  it("rend la chaîne telle quelle si la date est illisible", () => {
    expect(formatTimestamp("pas-une-date")).toBe("pas-une-date");
  });

  it("formate une date ISO valide", () => {
    expect(formatTimestamp("2026-08-01T10:00:00.000Z")).toMatch(/2026/);
  });
});
