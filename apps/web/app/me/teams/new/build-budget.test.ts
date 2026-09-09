import { describe, it, expect } from "vitest";
import { resolveBuildBudget, type CupBuildRules } from "./build-budget";
import type { TournamentRosterRules } from "@bb/game-engine";

const PACK_RULES: TournamentRosterRules = {
  goldBudget: 1180,
  sppBudget: 24,
  skillStacking: "one_player",
  starPlayersAllowed: true,
};

const EMPTY_CUP: CupBuildRules = {
  tierBudgets: {},
  rosterBudgetOverrides: {},
  tierStartingPsp: {},
  rosterStartingPspOverrides: {},
};

const ROSTER = { slug: "orc", tier: "I", budget: 1000 };

describe("resolveBuildBudget", () => {
  it("n'impose rien en jeu libre", () => {
    expect(
      resolveBuildBudget({ packRules: null, cupRules: null, roster: ROSTER }),
    ).toBeNull();
  });

  it("applique le budget et le pool du règlement hors coupe", () => {
    expect(
      resolveBuildBudget({
        packRules: PACK_RULES,
        cupRules: null,
        roster: ROSTER,
      }),
    ).toEqual({ teamValue: 1180, startingPspPool: 24 });
  });

  it("LE BUG : une coupe à règlement garde le budget ET le pool du règlement", () => {
    // Sans cette règle, le builder retombait sur le budget natif du roster
    // et sur un pool de 0 PSP — donc aucune compétence achetable.
    expect(
      resolveBuildBudget({
        packRules: PACK_RULES,
        cupRules: EMPTY_CUP,
        roster: ROSTER,
      }),
    ).toEqual({ teamValue: 1180, startingPspPool: 24 });
  });

  it("le règlement prime même sur des budgets de coupe explicites (miroir serveur)", () => {
    expect(
      resolveBuildBudget({
        packRules: PACK_RULES,
        cupRules: {
          ...EMPTY_CUP,
          tierBudgets: { I: 1050 },
          tierStartingPsp: { I: 6 },
          rosterBudgetOverrides: { orc: 1020 },
          rosterStartingPspOverrides: { orc: 4 },
        },
        roster: ROSTER,
      }),
    ).toEqual({ teamValue: 1180, startingPspPool: 24 });
  });

  it("déduit la taxe Star Players du pool du règlement, sans passer sous zéro", () => {
    expect(
      resolveBuildBudget({
        packRules: PACK_RULES,
        packStarTax: 10,
        cupRules: null,
        roster: ROSTER,
      })?.startingPspPool,
    ).toBe(14);
    expect(
      resolveBuildBudget({
        packRules: PACK_RULES,
        packStarTax: 99,
        cupRules: null,
        roster: ROSTER,
      })?.startingPspPool,
    ).toBe(0);
  });

  it("applique les budgets d'une coupe SANS règlement, par tier", () => {
    expect(
      resolveBuildBudget({
        packRules: null,
        cupRules: {
          ...EMPTY_CUP,
          tierBudgets: { I: 1050 },
          tierStartingPsp: { I: 6 },
        },
        roster: ROSTER,
      }),
    ).toEqual({ teamValue: 1050, startingPspPool: 6 });
  });

  it("l'override par roster prime sur le tier", () => {
    expect(
      resolveBuildBudget({
        packRules: null,
        cupRules: {
          tierBudgets: { I: 1050 },
          tierStartingPsp: { I: 6 },
          rosterBudgetOverrides: { orc: 1200 },
          rosterStartingPspOverrides: { orc: 14 },
        },
        roster: ROSTER,
      }),
    ).toEqual({ teamValue: 1200, startingPspPool: 14 });
  });

  it("retombe sur le budget natif du roster et un pool nul quand la coupe ne dit rien", () => {
    expect(
      resolveBuildBudget({
        packRules: null,
        cupRules: EMPTY_CUP,
        roster: ROSTER,
      }),
    ).toEqual({ teamValue: 1000, startingPspPool: 0 });
  });

  it("n'impose rien tant que le roster n'est pas chargé (tier/budget inconnus)", () => {
    expect(
      resolveBuildBudget({
        packRules: null,
        cupRules: EMPTY_CUP,
        roster: null,
      }),
    ).toBeNull();
    expect(
      resolveBuildBudget({
        packRules: null,
        cupRules: EMPTY_CUP,
        roster: { slug: "orc", tier: null, budget: null },
      }),
    ).toBeNull();
  });
});
