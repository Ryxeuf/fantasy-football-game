import { describe, expect, it } from "vitest";
import { ApiClientError } from "../../../../lib/api-client";
import { sheetOpenBlockFromError } from "./open-guard";

describe("sheetOpenBlockFromError", () => {
  it("lit les rencontres bloquantes et le droit de forcer", () => {
    const err = new ApiClientError(
      "Feuille non ouverte : une rencontre précédente n'est pas encore close",
      409,
      "previous_match_pending",
      {
        canForce: true,
        blocking: [
          {
            pairingId: "p2",
            roundLabel: "journée 2",
            homeTeamName: "Paladins",
            awayTeamName: "Elfes",
          },
        ],
      },
    );
    expect(sheetOpenBlockFromError(err)).toEqual({
      message:
        "Feuille non ouverte : une rencontre précédente n'est pas encore close",
      canForce: true,
      blocking: [{ pairingId: "p2", label: "journée 2 : Paladins – Elfes" }],
    });
  });

  it("un coach ne peut pas forcer", () => {
    const err = new ApiClientError("x", 409, "previous_match_pending", {
      blocking: [],
    });
    expect(sheetOpenBlockFromError(err)?.canForce).toBe(false);
  });

  it("ignore les entrées illisibles", () => {
    const err = new ApiClientError("x", 409, "previous_match_pending", {
      blocking: [null, { roundLabel: "journée 1" }, { pairingId: "p1" }],
    });
    expect(sheetOpenBlockFromError(err)?.blocking).toEqual([
      { pairingId: "p1", label: "Rencontre précédente" },
    ]);
  });

  it("toute autre erreur n'est pas un refus d'ouverture", () => {
    expect(sheetOpenBlockFromError(new Error("boom"))).toBeNull();
    expect(
      sheetOpenBlockFromError(new ApiClientError("x", 409, "already_validated")),
    ).toBeNull();
  });
});
