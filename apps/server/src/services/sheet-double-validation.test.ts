import { describe, it, expect } from "vitest";
import {
  missingCoachSubmissions,
  missingSubmissionsMessage,
} from "./sheet-double-validation";

const AT = new Date("2026-10-20T10:00:00.000Z");

describe("missingCoachSubmissions", () => {
  it.each([
    ["aucune soumission", {}, ["home", "away"]],
    ["domicile seul", { submittedByHomeAt: AT }, ["away"]],
    ["extérieur seul", { submittedByAwayAt: AT }, ["home"]],
    ["les deux", { submittedByHomeAt: AT, submittedByAwayAt: AT }, []],
    // Sérialisée en JSON par l'API : la date arrive en chaîne.
    ["dates en chaîne", { submittedByHomeAt: AT.toISOString(), submittedByAwayAt: "2026-10-20" }, []],
  ] as const)("%s ⇒ %j", (_label, sheet, expected) => {
    expect(missingCoachSubmissions(sheet)).toEqual(expected);
  });

  it("n'attend pas le coach FORFAITAIRE, mais toujours l'autre", () => {
    expect(missingCoachSubmissions({ forfeitSide: "away" })).toEqual(["home"]);
    expect(
      missingCoachSubmissions({ forfeitSide: "away", submittedByHomeAt: AT }),
    ).toEqual([]);
    expect(missingCoachSubmissions({ forfeitSide: "home" })).toEqual(["away"]);
  });

  it("ignore une valeur de forfait inconnue", () => {
    expect(missingCoachSubmissions({ forfeitSide: "both" })).toEqual([
      "home",
      "away",
    ]);
  });
});

describe("missingSubmissionsMessage", () => {
  it("nomme l'équipe dont la soumission manque", () => {
    expect(
      missingSubmissionsMessage(["away"], { home: "Orcs", away: "Rats" }),
    ).toBe(
      "Double validation : la feuille doit d'abord être soumise par le coach de « Rats » avant la validation du commissaire",
    );
  });

  it("nomme les deux équipes, et retombe sur le côté sans nom", () => {
    expect(missingSubmissionsMessage(["home", "away"], { home: "Orcs" })).toContain(
      "les coachs de « Orcs » et « Extérieur »",
    );
  });
});
