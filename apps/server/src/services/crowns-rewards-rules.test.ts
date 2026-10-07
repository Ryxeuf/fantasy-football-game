import { describe, expect, it } from "vitest";
import {
  DEFAULT_CROWNS_REWARD_SCHEDULE,
  achievementRewardKey,
  cupPeriodKey,
  eligibleSheetSides,
  planCrownsRewards,
  seasonPeriodKey,
  sheetRewardKey,
  signupRewardKey,
  summarizeCrownsRewards,
  type CrownsRewardCandidate,
  type CrownsRewardSchedule,
  type SheetRewardCandidate,
} from "./crowns-rewards-rules";

const S = DEFAULT_CROWNS_REWARD_SCHEDULE;

function sheet(
  id: string,
  period: string,
  day: number,
  side: "home" | "away" = "home",
): SheetRewardCandidate {
  return {
    kind: "sheet",
    sourceKey: sheetRewardKey(id, side),
    periodKey: period,
    sheetId: id,
    validatedAt: new Date(Date.UTC(2026, 8, day)),
  };
}

describe("clés de source et de période", () => {
  it("construit des clés stables et distinctes", () => {
    expect(sheetRewardKey("s1", "home")).toBe("sheet:s1:home");
    expect(sheetRewardKey("s1", "away")).toBe("sheet:s1:away");
    expect(achievementRewardKey("u1", "first-td")).toBe("achievement:u1:first-td");
    expect(signupRewardKey("u1")).toBe("signup:u1");
    expect(seasonPeriodKey("se1")).toBe("season:se1");
    expect(cupPeriodKey("c1")).toBe("cup:c1");
  });

  it("une clé de feuille ne contient pas l'utilisateur", () => {
    expect(sheetRewardKey("s1", "home")).not.toContain("u1");
  });
});

describe("eligibleSheetSides", () => {
  it("rend le côté possédé par le coach", () => {
    expect(eligibleSheetSides("a", "a", "b")).toEqual(["home"]);
    expect(eligibleSheetSides("b", "a", "b")).toEqual(["away"]);
  });

  it("ne rend rien quand le même compte possède les deux côtés", () => {
    expect(eligibleSheetSides("a", "a", "a")).toEqual([]);
  });

  it("ne rend rien sans adversaire connu", () => {
    expect(eligibleSheetSides("a", "a", null)).toEqual([]);
    expect(eligibleSheetSides("a", null, "a")).toEqual([]);
  });

  it("ne rend rien à un coach étranger à la feuille", () => {
    expect(eligibleSheetSides("c", "a", "b")).toEqual([]);
  });
});

describe("planCrownsRewards — barème", () => {
  it("verse le barème de chaque source", () => {
    const plan = planCrownsRewards(
      [
        { kind: "signup", sourceKey: signupRewardKey("u"), alreadyGranted: false },
        { kind: "achievement", sourceKey: achievementRewardKey("u", "x") },
        sheet("s1", seasonPeriodKey("se1"), 1),
      ],
      new Map(),
    );
    expect(plan.rewards.map((r) => [r.kind, r.amount])).toEqual([
      ["signup", S.signup],
      ["achievement", S.achievement],
      ["sheet", S.sheet],
    ]);
    expect(plan.total).toBe(S.signup + S.achievement + S.sheet);
  });

  it("le bonus déjà perçu en Pro League devient un marqueur à 0", () => {
    const plan = planCrownsRewards(
      [{ kind: "signup", sourceKey: signupRewardKey("u"), alreadyGranted: true }],
      new Map(),
    );
    expect(plan.rewards).toEqual([
      {
        sourceKey: "signup:u",
        kind: "signup",
        periodKey: null,
        amount: 0,
        baseAmount: S.signup,
      },
    ]);
    expect(plan.total).toBe(0);
  });

  it("le même montant pour chaque côté, quel que soit le résultat", () => {
    const plan = planCrownsRewards(
      [sheet("s1", "season:a", 1, "home"), sheet("s1", "season:a", 1, "away")],
      new Map(),
    );
    expect(plan.rewards.map((r) => r.amount)).toEqual([S.sheet, S.sheet]);
  });

  it("aucun candidat : plan vide", () => {
    expect(planCrownsRewards([], new Map())).toEqual({ rewards: [], total: 0 });
  });
});

describe("planCrownsRewards — plafond par saison", () => {
  const small: CrownsRewardSchedule = { ...S, sheet: 25, seasonSheetCap: 60 };

  it("tronque au reliquat puis annule, et le consigne", () => {
    const plan = planCrownsRewards(
      [sheet("s1", "season:a", 1), sheet("s2", "season:a", 2), sheet("s3", "season:a", 3), sheet("s4", "season:a", 4)],
      new Map(),
      small,
    );
    expect(plan.rewards.map((r) => r.amount)).toEqual([25, 25, 10, 0]);
    expect(plan.rewards.every((r) => r.baseAmount === 25)).toBe(true);
    expect(plan.total).toBe(60);
  });

  it("tient compte de ce qui a déjà été versé dans la période", () => {
    const plan = planCrownsRewards(
      [sheet("s9", "season:a", 9)],
      new Map([["season:a", 50]]),
      small,
    );
    expect(plan.rewards[0].amount).toBe(10);
  });

  it("une saison plafonnée n'affecte pas une autre saison ni une coupe", () => {
    const plan = planCrownsRewards(
      [sheet("s1", "season:a", 1), sheet("s2", "season:b", 1), sheet("s3", "cup:c", 1)],
      new Map([["season:a", 60]]),
      small,
    );
    expect(plan.rewards.map((r) => [r.periodKey, r.amount])).toEqual([
      ["season:a", 0],
      ["season:b", 25],
      ["cup:c", 25],
    ]);
  });

  it("succès et bonus restent hors plafond", () => {
    const plan = planCrownsRewards(
      [
        { kind: "achievement", sourceKey: achievementRewardKey("u", "x") },
        { kind: "signup", sourceKey: signupRewardKey("u"), alreadyGranted: false },
        sheet("s1", "season:a", 1),
      ],
      new Map([["season:a", 60]]),
      small,
    );
    const byKind = Object.fromEntries(plan.rewards.map((r) => [r.kind, r.amount]));
    expect(byKind).toEqual({ signup: S.signup, achievement: S.achievement, sheet: 0 });
  });

  it("applique le plafond dans l'ordre de validation, pas dans l'ordre reçu", () => {
    const late = sheet("s-late", "season:a", 20);
    const early = sheet("s-early", "season:a", 2);
    const middle = sheet("s-mid", "season:a", 10);
    const plan = planCrownsRewards([late, middle, early], new Map(), small);
    expect(plan.rewards.map((r) => [r.sourceKey, r.amount])).toEqual([
      ["sheet:s-early:home", 25],
      ["sheet:s-mid:home", 25],
      ["sheet:s-late:home", 10],
    ]);
  });

  it("à entrée égale, plan égal (mêmes dates : départage par id puis côté)", () => {
    const candidates: CrownsRewardCandidate[] = [
      sheet("b", "season:a", 1, "away"),
      sheet("a", "season:a", 1, "home"),
      sheet("b", "season:a", 1, "home"),
    ];
    const first = planCrownsRewards(candidates, new Map(), small);
    const second = planCrownsRewards([...candidates].reverse(), new Map(), small);
    expect(second).toEqual(first);
    expect(first.rewards.map((r) => r.sourceKey)).toEqual([
      "sheet:a:home",
      "sheet:b:away",
      "sheet:b:home",
    ]);
  });

  it("ne modifie pas la carte des gains reçue", () => {
    const earned = new Map([["season:a", 10]]);
    planCrownsRewards([sheet("s1", "season:a", 1)], earned, small);
    expect(earned.get("season:a")).toBe(10);
  });
});

describe("summarizeCrownsRewards", () => {
  it("compte les feuilles et succès payés, le bonus et les plafonnées", () => {
    expect(
      summarizeCrownsRewards([
        { kind: "sheet", amount: 25, baseAmount: 25 },
        { kind: "sheet", amount: 10, baseAmount: 25 },
        { kind: "sheet", amount: 0, baseAmount: 25 },
        { kind: "achievement", amount: 50, baseAmount: 50 },
        { kind: "signup", amount: 250, baseAmount: 250 },
      ]),
    ).toEqual({ sheets: 2, achievements: 1, signup: true, capped: 2 });
  });

  it("un bonus marqueur à 0 n'est pas annoncé", () => {
    expect(
      summarizeCrownsRewards([{ kind: "signup", amount: 0, baseAmount: 250 }]),
    ).toEqual({ sheets: 0, achievements: 0, signup: false, capped: 0 });
  });
});
