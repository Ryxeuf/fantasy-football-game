import { describe, expect, it } from "vitest";
import {
  blockFaceForName,
  diceColumnBounds,
  diceColumnName,
  parseDiceColumn,
  parseRollRange,
  rangeLabel,
  rangeValues,
  type DiceColumn,
} from "./dice-notation";
import { chapters } from "./data";

const D6: DiceColumn = { kind: "d6" };
const D16: DiceColumn = { kind: "number", sides: 16 };
const TWO_D6: DiceColumn = { kind: "sum", count: 2, sides: 6 };

describe("parseDiceColumn", () => {
  it.each([
    ["D6", D6],
    ["2D6", TWO_D6],
    ["D16", D16],
    ["D8", { kind: "number", sides: 8 }],
    ["D3", { kind: "number", sides: 3 }],
    ["1ᵉʳ D6", D6],
    ["2ᵉ D6", D6],
    [" d6 ", D6],
  ] as const)("reconnaît « %s »", (header, expected) => {
    expect(parseDiceColumn(header)).toEqual(expected);
  });

  it.each(["Résultat", "Jet de D6", "D7", "D100", "Faces", "4D6", "", "D"])(
    "ignore « %s »",
    (header) => {
      expect(parseDiceColumn(header)).toBeNull();
    },
  );
});

describe("parseRollRange", () => {
  it("lit une valeur seule et une plage", () => {
    expect(parseRollRange("9", TWO_D6)).toEqual({ from: 9, to: 9 });
    expect(parseRollRange("2-7", TWO_D6)).toEqual({ from: 2, to: 7 });
    expect(parseRollRange("15 – 16", D16)).toEqual({ from: 15, to: 16 });
  });

  it("refuse ce qui n'est pas une plage du dé", () => {
    expect(parseRollRange("", D6)).toBeNull();
    expect(parseRollRange("Aucun jet", D6)).toBeNull();
    expect(parseRollRange("7", D6), "au-delà d'un D6").toBeNull();
    expect(parseRollRange("1", TWO_D6), "en deçà de 2D6").toBeNull();
    expect(parseRollRange("5-3", D6), "plage inversée").toBeNull();
    expect(parseRollRange("600+", D6)).toBeNull();
  });
});

describe("helpers de plage", () => {
  it("énumère les valeurs bornes comprises", () => {
    expect(rangeValues({ from: 2, to: 5 })).toEqual([2, 3, 4, 5]);
    expect(rangeValues({ from: 6, to: 6 })).toEqual([6]);
  });

  it("annonce la plage en toutes lettres", () => {
    expect(rangeLabel({ from: 2, to: 7 })).toBe("2 à 7");
    expect(rangeLabel({ from: 9, to: 9 })).toBe("9");
  });

  it("nomme le dé et ses bornes", () => {
    expect(diceColumnName(TWO_D6)).toBe("2D6");
    expect(diceColumnName(D16)).toBe("D16");
    expect(diceColumnName(D6)).toBe("D6");
    expect(diceColumnBounds(TWO_D6)).toEqual({ from: 2, to: 12 });
    expect(diceColumnBounds(D16)).toEqual({ from: 1, to: 16 });
  });
});

describe("blockFaceForName", () => {
  it("retrouve chaque face par son nom officiel, casse et accents ignorés", () => {
    expect(blockFaceForName("Attaquant Plaqué")).toBe("down");
    expect(blockFaceForName("Les Deux Plaqués")).toBe("bothdown");
    expect(blockFaceForName("Repoussé")).toBe("push");
    expect(blockFaceForName("Bousculé")).toBe("stumble");
    expect(blockFaceForName(" defenseur plaque ")).toBe("pow");
  });

  it("ignore tout autre texte", () => {
    expect(blockFaceForName("Plaqué")).toBeNull();
    expect(blockFaceForName("Le joueur est Repoussé")).toBeNull();
  });
});

/**
 * Garde-fou de CONTENU : chaque colonne de jets publiée doit se dessiner
 * entièrement. Une plage hors des bornes de son dé (coquille « 2-13 » sur
 * 2D6, colonne D16 qui commence à 0…) retomberait en texte sans prévenir.
 */
describe("compendium : toutes les colonnes de jets se dessinent", () => {
  const diceTables = chapters.flatMap((chapter) =>
    chapter.blocks.flatMap((block) =>
      block.type === "table" ? [{ chapter: chapter.slug, block }] : [],
    ),
  );

  it("trouve les tables de jets attendues", () => {
    const headers = diceTables.flatMap(({ block }) =>
      block.columns.filter((c) => parseDiceColumn(c) !== null),
    );
    for (const expected of ["2D6", "D16", "D6", "D8", "1ᵉʳ D6", "2ᵉ D6"]) {
      expect(headers, expected).toContain(expected);
    }
  });

  it("chaque cellule non vide d'une colonne de jets est une plage valide", () => {
    for (const { chapter, block } of diceTables) {
      block.columns.forEach((header, c) => {
        const column = parseDiceColumn(header);
        if (!column) return;
        for (const row of block.rows) {
          const cell = row[c] ?? "";
          if (cell.trim() === "") continue;
          expect(
            parseRollRange(cell, column),
            `${chapter} · ${block.caption} · « ${header} » = « ${cell} »`,
          ).not.toBeNull();
        }
      });
    }
  });
});
