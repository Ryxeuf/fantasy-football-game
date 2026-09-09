import { describe, it, expect } from "vitest";
import {
  frozenSkillsByPlayerId,
  parseFrozenPlayers,
} from "./league-sheet-frozen-skills";

const live = (
  id: string,
  number: number,
  name: string,
  skills: string | null,
) => ({ id, number, name, skills });

const snapshot = (players: unknown[], extra: object = {}) => ({
  teamValue: 1_000_000,
  players,
  ...extra,
});

describe("parseFrozenPlayers", () => {
  it("lit un snapshot objet natif (PostgreSQL)", () => {
    const parsed = parseFrozenPlayers(
      snapshot([{ number: 1, name: "Griff", skills: "block" }]),
    );
    expect(parsed).toEqual([{ number: 1, name: "Griff", skills: "block" }]);
  });

  it("lit un snapshot chaîne JSON (miroir sqlite)", () => {
    const parsed = parseFrozenPlayers(
      JSON.stringify(snapshot([{ number: 2, name: "Karla", skills: "dodge" }])),
    );
    expect(parsed).toEqual([{ number: 2, name: "Karla", skills: "dodge" }]);
  });

  it("rend null sur un snapshot absent, illisible ou « en-tête seul »", () => {
    expect(parseFrozenPlayers(null)).toBeNull();
    expect(parseFrozenPlayers(undefined)).toBeNull();
    expect(parseFrozenPlayers("{pas du json")).toBeNull();
    expect(parseFrozenPlayers({ teamValue: 10 })).toBeNull();
    expect(
      parseFrozenPlayers(snapshot([{ number: 1, name: "X", skills: "" }], {
        headerOnly: true,
      })),
    ).toBeNull();
  });

  it("écarte les entrées sans numéro exploitable et tolère les champs manquants", () => {
    expect(
      parseFrozenPlayers(
        snapshot([
          { name: "Sans numéro", skills: "block" },
          { number: Number.NaN, name: "NaN", skills: "block" },
          { number: 7 },
          null,
        ]),
      ),
    ).toEqual([{ number: 7, name: "", skills: "" }]);
  });
});

describe("frozenSkillsByPlayerId", () => {
  it("rend les compétences DU COUP D'ENVOI, pas celles du roster live", () => {
    // Le joueur a gagné « Innovateur Violent » à la fin de ce match : le
    // gel, lui, porte encore ses compétences d'avant le coup d'envoi.
    const map = frozenSkillsByPlayerId(
      [live("p1", 1, "Griff", "block,violent-innovator")],
      snapshot([{ number: 1, name: "Griff", skills: "block" }]),
    );
    expect(map.get("p1")).toBe("block");
  });

  it("rapproche un joueur RENOMMÉ depuis le match (numéro unique)", () => {
    const map = frozenSkillsByPlayerId(
      [live("p1", 4, "Nouveau Nom", "block,violent-innovator")],
      snapshot([{ number: 4, name: "Ancien Nom", skills: "block" }]),
    );
    expect(map.get("p1")).toBe("block");
  });

  it("rapproche un joueur RENUMÉROTÉ depuis le match (nom unique)", () => {
    const map = frozenSkillsByPlayerId(
      [live("p1", 12, "Griff", "block,violent-innovator")],
      snapshot([{ number: 4, name: "Griff", skills: "block" }]),
    );
    expect(map.get("p1")).toBe("block");
  });

  it("préfère le couple (numéro + nom) quand deux joueurs partagent un numéro", () => {
    const map = frozenSkillsByPlayerId(
      [live("p1", 4, "Griff", null), live("p2", 4, "Karla", null)],
      snapshot([
        { number: 4, name: "Griff", skills: "block" },
        { number: 4, name: "Karla", skills: "dodge" },
      ]),
    );
    expect(map.get("p1")).toBe("block");
    expect(map.get("p2")).toBe("dodge");
  });

  it("n'accorde AUCUNE compétence à un joueur absent du gel", () => {
    // Recruté après le match : il n'a pas joué cette rencontre-là, ses
    // compétences actuelles ne doivent rien changer à la feuille.
    const map = frozenSkillsByPlayerId(
      [live("p9", 16, "Recrue", "violent-innovator")],
      snapshot([{ number: 1, name: "Griff", skills: "block" }]),
    );
    expect(map.get("p9")).toBe("");
  });

  it("retombe sur le roster live sans snapshot exploitable", () => {
    for (const raw of [null, undefined, "{cassé", { headerOnly: true }]) {
      const map = frozenSkillsByPlayerId(
        [live("p1", 1, "Griff", "block,violent-innovator")],
        raw,
      );
      expect(map.get("p1")).toBe("block,violent-innovator");
    }
  });

  it("normalise les compétences absentes du live en chaîne vide", () => {
    const map = frozenSkillsByPlayerId([live("p1", 1, "Griff", null)], null);
    expect(map.get("p1")).toBe("");
  });
});
