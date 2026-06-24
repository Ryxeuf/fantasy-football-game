import { describe, it, expect } from "vitest";
import {
  BONUS_PRESETS,
  MAX_BONUS_RULES,
  BOOLEAN_CONDITIONS,
  parseBonusRulesFromApi,
  serializeBonusRules,
  parseBonusBreakdown,
  presetToRule,
  emptyBonusRule,
  nextBonusRuleId,
  type BonusRuleValue,
} from "./bonus-rules";

describe("E1 — bonus-rules presets", () => {
  it("expose les 4 presets attendus", () => {
    expect(BONUS_PRESETS).toHaveLength(4);
    expect(BONUS_PRESETS.map((p) => p.key)).toEqual([
      "3tds",
      "3cas",
      "cleanSheet",
      "shutoutWin",
    ]);
  });

  it("couvre les conditions demandees (3 TD / 3 sorties / 0 TD encaisse)", () => {
    const byKey = Object.fromEntries(BONUS_PRESETS.map((p) => [p.key, p]));
    expect(byKey["3tds"].condition).toEqual({ type: "tds_scored_gte", value: 3 });
    expect(byKey["3cas"].condition).toEqual({ type: "cas_inflicted_gte", value: 3 });
    expect(byKey["cleanSheet"].condition).toEqual({ type: "clean_sheet" });
  });

  it("MAX_BONUS_RULES est aligne sur le schema serveur (20)", () => {
    expect(MAX_BONUS_RULES).toBe(20);
  });
});

describe("E1 — id / factory helpers", () => {
  it("genere des ids uniques et non vides", () => {
    const a = nextBonusRuleId();
    const b = nextBonusRuleId();
    expect(a).not.toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it("presetToRule pose un id frais + le libelle fourni", () => {
    const preset = BONUS_PRESETS[0];
    const rule = presetToRule(preset, "3 TD marques");
    expect(rule.label).toBe("3 TD marques");
    expect(rule.condition).toEqual({ type: "tds_scored_gte", value: 3 });
    expect(rule.id.length).toBeGreaterThan(0);
  });

  it("emptyBonusRule retourne une regle 3 TD / both / +1", () => {
    const rule = emptyBonusRule("Nouvelle");
    expect(rule.condition).toEqual({ type: "tds_scored_gte", value: 3 });
    expect(rule.appliesTo).toBe("both");
    expect(rule.points).toBe(1);
  });
});

describe("E1 — parseBonusRulesFromApi (PG array + sqlite string + null)", () => {
  const valid = [
    {
      id: "r1",
      label: "3 TD",
      condition: { type: "tds_scored_gte", value: 3 },
      points: 1,
      appliesTo: "both",
    },
    {
      id: "r2",
      label: "Clean sheet",
      condition: { type: "clean_sheet" },
      points: 2,
      appliesTo: "winner",
    },
  ];

  it("parse un array natif (Postgres)", () => {
    const out = parseBonusRulesFromApi(valid);
    expect(out).toHaveLength(2);
    expect(out[0].condition).toEqual({ type: "tds_scored_gte", value: 3 });
    expect(out[1].condition).toEqual({ type: "clean_sheet" });
  });

  it("parse une string JSON (mirror sqlite)", () => {
    const out = parseBonusRulesFromApi(JSON.stringify(valid));
    expect(out).toHaveLength(2);
    expect(out[1].appliesTo).toBe("winner");
  });

  it("retourne [] pour null / undefined / garbage / JSON invalide", () => {
    expect(parseBonusRulesFromApi(null)).toEqual([]);
    expect(parseBonusRulesFromApi(undefined)).toEqual([]);
    expect(parseBonusRulesFromApi(42)).toEqual([]);
    expect(parseBonusRulesFromApi("not-json")).toEqual([]);
    expect(parseBonusRulesFromApi("{}")).toEqual([]);
  });

  it("ignore silencieusement les entrees malformees", () => {
    const mixed = [
      valid[0],
      { id: "x", condition: { type: "bogus" }, points: 1, appliesTo: "both" },
      { id: "y", condition: { type: "tds_scored_gte", value: 1 }, points: "nope", appliesTo: "both" },
      { id: "z", condition: { type: "tds_scored_gte", value: 1 }, points: 1, appliesTo: "sideways" },
      "garbage",
      null,
    ];
    const out = parseBonusRulesFromApi(mixed);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("r1");
  });

  it("normalise une condition booleenne sans value en droppant le seuil", () => {
    const out = parseBonusRulesFromApi([
      { id: "r", label: "cs", condition: { type: "clean_sheet", value: 9 }, points: 1, appliesTo: "both" },
    ]);
    expect(out[0].condition).toEqual({ type: "clean_sheet" });
  });
});

describe("E1 — serializeBonusRules", () => {
  it("retourne null quand aucune regle", () => {
    expect(serializeBonusRules([])).toBeNull();
  });

  it("drop value pour les conditions booleennes", () => {
    const rules: BonusRuleValue[] = [
      { id: "r1", label: "cs", condition: { type: "clean_sheet" }, points: 1, appliesTo: "both" },
    ];
    const out = serializeBonusRules(rules);
    expect(out).not.toBeNull();
    expect(out![0].condition).toEqual({ type: "clean_sheet" });
    expect(BOOLEAN_CONDITIONS.has("clean_sheet")).toBe(true);
  });

  it("conserve value (entier) pour les conditions a seuil", () => {
    const rules: BonusRuleValue[] = [
      { id: "r1", label: "3 TD", condition: { type: "tds_scored_gte", value: 3.9 }, points: 1.5, appliesTo: "home" },
    ];
    const out = serializeBonusRules(rules)!;
    expect(out[0].condition).toEqual({ type: "tds_scored_gte", value: 3 });
    expect(out[0].points).toBe(1);
  });

  it("remplace un libelle vide par un fallback non vide (schema Zod min 1)", () => {
    const rules: BonusRuleValue[] = [
      { id: "r1", label: "   ", condition: { type: "clean_sheet" }, points: 1, appliesTo: "both" },
    ];
    const out = serializeBonusRules(rules)!;
    expect(out[0].label.length).toBeGreaterThan(0);
  });

  it("round-trip parse(serialize(x)) preserve les regles valides", () => {
    const rules: BonusRuleValue[] = [
      { id: "r1", label: "3 TD", condition: { type: "tds_scored_gte", value: 3 }, points: 1, appliesTo: "both" },
      { id: "r2", label: "cs", condition: { type: "clean_sheet" }, points: 2, appliesTo: "winner" },
    ];
    const round = parseBonusRulesFromApi(serializeBonusRules(rules));
    expect(round).toHaveLength(2);
    expect(round[0].condition).toEqual({ type: "tds_scored_gte", value: 3 });
    expect(round[1].condition).toEqual({ type: "clean_sheet" });
  });
});

describe("E3 — parseBonusBreakdown (PG array + sqlite string + null)", () => {
  const valid = [
    { ruleId: "r1", label: "3 TD marques", side: "home", points: 1 },
    { ruleId: "r2", label: "Aucun TD encaisse", side: "away", points: 1 },
  ];

  it("parse un array natif (Postgres)", () => {
    const out = parseBonusBreakdown(valid);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ ruleId: "r1", label: "3 TD marques", side: "home", points: 1 });
    expect(out[1].side).toBe("away");
  });

  it("parse une string JSON (mirror sqlite)", () => {
    const out = parseBonusBreakdown(JSON.stringify(valid));
    expect(out).toHaveLength(2);
    expect(out[0].side).toBe("home");
  });

  it("retourne [] pour null / undefined / garbage / JSON invalide", () => {
    expect(parseBonusBreakdown(null)).toEqual([]);
    expect(parseBonusBreakdown(undefined)).toEqual([]);
    expect(parseBonusBreakdown(42)).toEqual([]);
    expect(parseBonusBreakdown("not-json")).toEqual([]);
    expect(parseBonusBreakdown('{"a":1}')).toEqual([]);
  });

  it("ignore les entrees malformees (side invalide, points non numerique)", () => {
    const mixed = [
      valid[0],
      { ruleId: "x", label: "bad side", side: "middle", points: 1 },
      { ruleId: "y", label: "bad points", side: "home", points: "1" },
      null,
      "garbage",
    ];
    const out = parseBonusBreakdown(mixed);
    expect(out).toHaveLength(1);
    expect(out[0].ruleId).toBe("r1");
  });
});
