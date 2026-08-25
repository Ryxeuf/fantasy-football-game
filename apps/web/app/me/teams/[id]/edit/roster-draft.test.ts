import { describe, it, expect } from "vitest";
import { rosterDraftSignature } from "./roster-draft";

const PLAYERS = [
  { id: "p1", position: "human_lineman", name: "Bob", number: 1 },
  { id: "p2", position: "human_blitzer", name: "Alice", number: 2 },
];

describe("rosterDraftSignature", () => {
  it("est stable pour un brouillon inchangé", () => {
    expect(rosterDraftSignature("Reavers", PLAYERS)).toBe(
      rosterDraftSignature("Reavers", PLAYERS),
    );
  });

  it("ignore l'ordre des joueurs (la liste est triée à l'affichage)", () => {
    expect(rosterDraftSignature("Reavers", [...PLAYERS].reverse())).toBe(
      rosterDraftSignature("Reavers", PLAYERS),
    );
  });

  it("ignore les espaces de bord du nom d'équipe et des joueurs", () => {
    expect(
      rosterDraftSignature("  Reavers  ", [
        { ...PLAYERS[0], name: " Bob " },
        PLAYERS[1],
      ]),
    ).toBe(rosterDraftSignature("Reavers", PLAYERS));
  });

  it("change au renommage de l'équipe", () => {
    expect(rosterDraftSignature("Autres", PLAYERS)).not.toBe(
      rosterDraftSignature("Reavers", PLAYERS),
    );
  });

  it("change au renommage, renumérotation, ajout ou retrait d'un joueur", () => {
    const base = rosterDraftSignature("Reavers", PLAYERS);
    expect(
      rosterDraftSignature("Reavers", [
        { ...PLAYERS[0], name: "Bobby" },
        PLAYERS[1],
      ]),
    ).not.toBe(base);
    expect(
      rosterDraftSignature("Reavers", [
        { ...PLAYERS[0], number: 9 },
        PLAYERS[1],
      ]),
    ).not.toBe(base);
    expect(rosterDraftSignature("Reavers", [PLAYERS[0]])).not.toBe(base);
    expect(
      rosterDraftSignature("Reavers", [
        ...PLAYERS,
        { id: "tmp_1", position: "human_lineman", name: "Neo", number: 3 },
      ]),
    ).not.toBe(base);
  });
});
