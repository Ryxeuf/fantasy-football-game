import { describe, it, expect } from "vitest";
import { cupSheetsAwaitingValidation } from "./pending-sheets";

describe("cupSheetsAwaitingValidation", () => {
  it("ne compte que les feuilles soumises par les deux coachs", () => {
    expect(
      cupSheetsAwaitingValidation([
        {
          pairings: [
            { matchSheet: { status: "both_submitted" } },
            { matchSheet: { status: "submitted_home" } },
            { matchSheet: null },
            {},
          ],
        },
        { pairings: [{ matchSheet: { status: "both_submitted" } }, { matchSheet: { status: "validated" } }] },
      ]),
    ).toBe(2);
    expect(cupSheetsAwaitingValidation([])).toBe(0);
  });
});
