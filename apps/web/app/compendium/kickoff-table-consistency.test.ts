/**
 * La table 2D6 de coup d'envoi (saison 2025) existe en trois endroits
 * qui doivent rester cohérents :
 *  1. `docs/regles-bb-2025/page-01.md` — transcription du livre (interne) ;
 *  2. `apps/web/app/compendium/data/rules-bb-2025.json` — version publiée
 *     et reformulée (page `/compendium/coup-d-envoi`) ;
 *  3. `KICKOFF_EVENTS` du game-engine — moteur de jeu + liste déroulante
 *     de saisie des feuilles de match de ligue.
 *
 * Ce test verrouille la correspondance 2↔3 : le compendium affichait la
 * bonne table 2025 alors que le moteur servait encore celle de l'édition
 * précédente (Émeute, Défense parfaite, Arbitre zélé…).
 */

import { describe, expect, it } from "vitest";
import { KICKOFF_EVENTS } from "@bb/game-engine";
import { getChapter } from "./data";

const KICKOFF_TABLE_CAPTION = "Événements de coup d'envoi (2D6)";

/**
 * Normalise l'espace fine avant la ponctuation double : `data.ts`
 * applique sa propre typographie au rendu, on compare donc les noms
 * indépendamment de cet espacement.
 */
function normalize(name: string): string {
  return name.replace(/[\s\u00a0\u202f]+([!?:;])/g, "$1").trim();
}

/** Extrait le nom en gras en tête de cellule : `**Nom !** suite…`. */
function boldName(cell: string): string {
  return normalize(cell.match(/^\*\*(.+?)\*\*/)?.[1] ?? "");
}

describe("table de coup d'envoi : compendium ↔ game-engine", () => {
  const chapter = getChapter("coup-d-envoi");
  const table = chapter?.blocks.find(
    (b) => b.type === "table" && b.caption === KICKOFF_TABLE_CAPTION,
  );

  it("le compendium expose bien la table 2D6", () => {
    expect(table, `bloc "${KICKOFF_TABLE_CAPTION}" introuvable`).toBeDefined();
  });

  it("couvre les 11 résultats de 2 à 12", () => {
    if (table?.type !== "table") throw new Error("table introuvable");
    expect(table.rows.map((r) => r[0])).toEqual(
      ["2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
    );
  });

  it("chaque ligne porte le même nom d'événement que le game-engine", () => {
    if (table?.type !== "table") throw new Error("table introuvable");
    for (const [roll, cell] of table.rows) {
      const engineEvent = KICKOFF_EVENTS[Number(roll)];
      expect(engineEvent, `2D6 = ${roll} absent du game-engine`).toBeDefined();
      expect(boldName(cell), `2D6 = ${roll}`).toBe(normalize(engineEvent.nameFr));
    }
  });
});
