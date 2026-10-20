import { describe, it, expect } from "vitest";
import {
  flagWithdrawnStandings,
  registeredStandings,
} from "./cup-withdrawn-teams";

const rows = [
  { teamId: "a", totalPoints: 30 },
  { teamId: "gone", totalPoints: 20 },
  { teamId: "b", totalPoints: 10 },
];
const registered = new Set(["a", "b"]);

describe("équipes retirées d'une coupe", () => {
  it("registeredStandings garde les seuls inscrits, dans l'ordre du classement", () => {
    expect(registeredStandings(rows, registered).map((r) => r.teamId)).toEqual([
      "a",
      "b",
    ]);
  });

  it("flagWithdrawnStandings garde TOUTES les lignes et marque la retirée", () => {
    const flagged = flagWithdrawnStandings(rows, registered);
    expect(flagged.map((r) => r.teamId)).toEqual(["a", "gone", "b"]);
    expect(flagged[1]).toEqual({ teamId: "gone", totalPoints: 20, withdrawn: true });
    // Les inscrits sont rendus tels quels : aucun champ ajouté.
    expect(flagged[0]).toBe(rows[0]);
    expect("withdrawn" in flagged[2]).toBe(false);
  });
});
