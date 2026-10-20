import { describe, it, expect } from "vitest";
import {
  pendingSubmissionSides,
  pendingSubmissionsLabel,
} from "./double-validation";

const AT = "2026-10-20T10:00:00.000Z";

describe("pendingSubmissionSides", () => {
  it.each([
    ["brouillon", { status: "draft" }, ["home", "away"]],
    ["domicile soumis", { status: "submitted_home", submittedByHomeAt: AT }, ["away"]],
    ["extérieur soumis", { status: "submitted_away", submittedByAwayAt: AT }, ["home"]],
    [
      "les deux",
      { status: "both_submitted", submittedByHomeAt: AT, submittedByAwayAt: AT },
      [],
    ],
    // Serveur qui ne servirait pas les dates : le statut suffit.
    ["statut seul", { status: "both_submitted" }, []],
  ] as const)("%s ⇒ %j", (_label, sheet, expected) => {
    expect(pendingSubmissionSides(sheet)).toEqual(expected);
  });

  it("n'attend pas le coach forfaitaire", () => {
    expect(pendingSubmissionSides({ status: "draft", forfeitSide: "away" })).toEqual([
      "home",
    ]);
    expect(
      pendingSubmissionSides({
        status: "submitted_home",
        submittedByHomeAt: AT,
        forfeitSide: "away",
      }),
    ).toEqual([]);
  });
});

describe("pendingSubmissionsLabel", () => {
  it("nomme les équipes attendues, rien si personne ne manque", () => {
    expect(pendingSubmissionsLabel(["away"], { home: "Orcs", away: "Rats" })).toBe(
      "En attente de la soumission de Rats",
    );
    expect(pendingSubmissionsLabel(["home", "away"], {})).toBe(
      "En attente de la soumission de Domicile et Extérieur",
    );
    expect(pendingSubmissionsLabel([], { home: "Orcs" })).toBe("");
  });
});
