/**
 * Garde d'ouverture d'une feuille de ligue : une rencontre d'une journée
 * antérieure encore ouverte, pour l'une des deux équipes, bloque le gel.
 */
import { describe, it, expect } from "vitest";
import {
  CLOSED_PAIRING_STATUSES,
  findBlockingPreviousPairings,
  previousMatchPendingMessage,
  roundLabel,
  type OpenGuardCandidatePairing,
} from "./league-sheet-open-guard";

const current = {
  id: "j3",
  roundNumber: 3,
  homeTeamId: "paladins",
  awayTeamId: "orcs",
};

function pairing(
  over: Partial<OpenGuardCandidatePairing> & { id: string },
): OpenGuardCandidatePairing {
  return {
    status: "scheduled",
    roundNumber: 2,
    roundName: null,
    homeTeamId: "paladins",
    homeTeamName: "Paladins de la Dame",
    awayTeamId: "elves",
    awayTeamName: "Elfes",
    ...over,
  };
}

describe("findBlockingPreviousPairings", () => {
  it("une rencontre antérieure ouverte d'une des deux équipes bloque", () => {
    const out = findBlockingPreviousPairings({
      current,
      candidates: [pairing({ id: "j2" })],
    });
    expect(out).toEqual([
      {
        pairingId: "j2",
        roundNumber: 2,
        roundLabel: "journée 2",
        teamNames: ["Paladins de la Dame"],
        homeTeamName: "Paladins de la Dame",
        awayTeamName: "Elfes",
        status: "scheduled",
      },
    ]);
  });

  it("l'équipe extérieure compte autant que l'équipe à domicile", () => {
    const out = findBlockingPreviousPairings({
      current,
      candidates: [
        pairing({
          id: "j1",
          roundNumber: 1,
          homeTeamId: "dwarves",
          homeTeamName: "Nains",
          awayTeamId: "orcs",
          awayTeamName: "Orques",
          status: "in_progress",
        }),
      ],
    });
    expect(out.map((b) => [b.pairingId, b.teamNames])).toEqual([
      ["j1", ["Orques"]],
    ]);
  });

  it("une rencontre close (jouée, forfait, annulée) ne bloque pas", () => {
    for (const status of CLOSED_PAIRING_STATUSES) {
      expect(
        findBlockingPreviousPairings({
          current,
          candidates: [pairing({ id: "j2", status })],
        }),
        status,
      ).toEqual([]);
    }
  });

  it("ni la même journée, ni une journée suivante, ni la rencontre elle-même", () => {
    const out = findBlockingPreviousPairings({
      current,
      candidates: [
        pairing({ id: "same", roundNumber: 3 }),
        pairing({ id: "later", roundNumber: 4 }),
        pairing({ id: "j3", roundNumber: 1 }),
      ],
    });
    expect(out).toEqual([]);
  });

  it("une rencontre d'autres équipes ne bloque pas", () => {
    const out = findBlockingPreviousPairings({
      current,
      candidates: [
        pairing({
          id: "other",
          homeTeamId: "dwarves",
          homeTeamName: "Nains",
          awayTeamId: "elves",
          awayTeamName: "Elfes",
        }),
      ],
    });
    expect(out).toEqual([]);
  });

  it("la rencontre aller des deux équipes nomme les deux, une seule fois", () => {
    const out = findBlockingPreviousPairings({
      current,
      candidates: [
        pairing({
          id: "aller",
          roundNumber: 1,
          awayTeamId: "orcs",
          awayTeamName: "Orques",
        }),
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].teamNames).toEqual(["Paladins de la Dame", "Orques"]);
  });

  it("un placeholder de bracket (home === away) ne nomme son équipe qu'une fois", () => {
    const out = findBlockingPreviousPairings({
      current,
      candidates: [
        pairing({ id: "ph", awayTeamId: "paladins", awayTeamName: "Paladins de la Dame" }),
      ],
    });
    expect(out[0].teamNames).toEqual(["Paladins de la Dame"]);
  });

  it("trie par journée", () => {
    const out = findBlockingPreviousPairings({
      current,
      candidates: [
        pairing({ id: "b", roundNumber: 2 }),
        pairing({ id: "a", roundNumber: 1 }),
      ],
    });
    expect(out.map((b) => b.pairingId)).toEqual(["a", "b"]);
  });
});

describe("roundLabel", () => {
  it("le nom de la journée s'il existe, sinon « journée N »", () => {
    expect(roundLabel(2, null)).toBe("journée 2");
    expect(roundLabel(2, "  ")).toBe("journée 2");
    expect(roundLabel(5, "Demi-finale 1")).toBe("Demi-finale 1");
  });
});

describe("previousMatchPendingMessage", () => {
  const blocking = findBlockingPreviousPairings({
    current,
    candidates: [pairing({ id: "j2" })],
  });

  it("nomme la rencontre bloquante et dit quoi faire", () => {
    const msg = previousMatchPendingMessage(blocking, false);
    expect(msg).toContain("journée 2 : Paladins de la Dame – Elfes");
    expect(msg).toMatch(/valider sa feuille/);
    expect(msg).not.toMatch(/commissaire/);
  });

  it("rappelle au commissaire qu'il peut forcer", () => {
    expect(previousMatchPendingMessage(blocking, true)).toMatch(
      /commissaire, vous pouvez l'ouvrir quand même/,
    );
  });
});
