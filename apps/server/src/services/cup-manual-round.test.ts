import { describe, it, expect } from "vitest";
import { buildManualRound, CupRoundError } from "./cup-rounds";

const TEAMS = ["t1", "t2", "t3", "t4", "t5"];

function expectRefusal(fn: () => unknown, needle: string): void {
  try {
    fn();
    throw new Error("aurait dû être refusé");
  } catch (e) {
    expect(e).toBeInstanceOf(CupRoundError);
    expect((e as CupRoundError).code).toBe("invalid_pairings");
    expect((e as CupRoundError).message).toContain(needle);
  }
}

describe("buildManualRound", () => {
  it("met en forme les rencontres saisies, tables numérotées en continu", () => {
    const out = buildManualRound(
      [
        { homeTeamId: "t1", awayTeamId: "t2" },
        { homeTeamId: "t3", awayTeamId: "t4" },
      ],
      TEAMS,
    );
    expect(out.pairings).toEqual([
      { home: "t1", away: "t2", table: 1 },
      { home: "t3", away: "t4", table: 2 },
    ]);
    expect(out.bye).toBeNull();
    expect(out.rematchForced).toBe(false);
  });

  it("accepte une équipe exemptée (`awayTeamId` null ou absent)", () => {
    const out = buildManualRound(
      [
        { homeTeamId: "t1", awayTeamId: "t2" },
        { homeTeamId: "t5", awayTeamId: null },
      ],
      TEAMS,
    );
    expect(out.bye).toBe("t5");
    // L'exempt ne doit pas laisser un trou dans la numérotation des tables.
    expect(out.pairings.map((p) => p.table)).toEqual([1]);
  });

  it("laisse une équipe inscrite hors de la ronde (report, saisie partielle)", () => {
    const out = buildManualRound([{ homeTeamId: "t1", awayTeamId: "t2" }], TEAMS);
    expect(out.pairings).toHaveLength(1);
  });

  it("refuse une saisie vide", () => {
    expectRefusal(() => buildManualRound([], TEAMS), "aucune rencontre");
    expectRefusal(() => buildManualRound(undefined, TEAMS), "aucune rencontre");
  });

  it("refuse une équipe non inscrite (à domicile comme à l'extérieur)", () => {
    expectRefusal(
      () => buildManualRound([{ homeTeamId: "intrus", awayTeamId: "t2" }], TEAMS),
      "non inscrite",
    );
    expectRefusal(
      () => buildManualRound([{ homeTeamId: "t1", awayTeamId: "intrus" }], TEAMS),
      "non inscrite",
    );
  });

  it("refuse une équipe qui jouerait deux fois dans la ronde", () => {
    expectRefusal(
      () =>
        buildManualRound(
          [
            { homeTeamId: "t1", awayTeamId: "t2" },
            { homeTeamId: "t1", awayTeamId: "t3" },
          ],
          TEAMS,
        ),
      "deux fois",
    );
    expectRefusal(
      () =>
        buildManualRound(
          [
            { homeTeamId: "t1", awayTeamId: "t2" },
            { homeTeamId: "t3", awayTeamId: "t2" },
          ],
          TEAMS,
        ),
      "deux fois",
    );
  });

  it("refuse une équipe contre elle-même", () => {
    expectRefusal(
      () => buildManualRound([{ homeTeamId: "t1", awayTeamId: "t1" }], TEAMS),
      "elle-même",
    );
  });

  it("refuse deux exempts dans la même ronde", () => {
    expectRefusal(
      () =>
        buildManualRound(
          [
            { homeTeamId: "t1", awayTeamId: null },
            { homeTeamId: "t2", awayTeamId: null },
          ],
          TEAMS,
        ),
      "une seule équipe exemptée",
    );
  });
});
