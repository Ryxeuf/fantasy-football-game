/**
 * Tests : bonus SPP des skills BB sur le scoring NFL Fantasy.
 * Couvre le mapping curé skill→règle (pass, catch, sure-hands,
 * safe-pair-of-hands, block, mighty-blow, dodge, tackle, frenzy),
 * les caps, l'idempotence (skill duplique), et les parsers tolérants
 * PG/sqlite.
 */

import { describe, it, expect } from "vitest";
import type { SppEvent } from "@bb/nfl-mapper";
import {
  applySkillBonuses,
  parseBbSkills,
  parseSppEvents,
} from "./nfl-fantasy-skill-bonus";

function ev(type: SppEvent["type"], count: number, spp: number, reason: string): SppEvent {
  return { type, count, spp, reason };
}

describe("applySkillBonuses", () => {
  it("aucun bonus si bbSkills vide", () => {
    const out = applySkillBonuses({
      events: [ev("TD", 1, 3, "1 passing TD")],
      bbSkills: [],
    });
    expect(out.bonusEvents).toEqual([]);
    expect(out.totalBonusSpp).toBe(0);
  });

  it("aucun bonus si events vide", () => {
    const out = applySkillBonuses({
      events: [],
      bbSkills: ["pass", "block"],
    });
    expect(out.bonusEvents).toEqual([]);
    expect(out.totalBonusSpp).toBe(0);
  });

  it("pass : +1 par TD passing, capé à 3", () => {
    const a = applySkillBonuses({
      events: [ev("TD", 1, 3, "1 passing TD")],
      bbSkills: ["pass"],
    });
    expect(a.totalBonusSpp).toBe(1);
    expect(a.bonusEvents[0]?.skill).toBe("pass");

    // 5 passing TD → cap à 3
    const b = applySkillBonuses({
      events: [ev("TD", 5, 15, "5 passing TD")],
      bbSkills: ["pass"],
    });
    expect(b.totalBonusSpp).toBe(3);
  });

  it("pass : ignore rushing TD", () => {
    const out = applySkillBonuses({
      events: [ev("TD", 2, 6, "2 rushing TD (QB run)")],
      bbSkills: ["pass"],
    });
    expect(out.totalBonusSpp).toBe(0);
  });

  it("catch : bonus unique si au moins 1 receiving TD", () => {
    const a = applySkillBonuses({
      events: [ev("TD", 3, 9, "3 receiving TD")],
      bbSkills: ["catch"],
    });
    expect(a.totalBonusSpp).toBe(1);

    const b = applySkillBonuses({
      events: [ev("TD", 1, 3, "1 rushing TD")],
      bbSkills: ["catch"],
    });
    expect(b.totalBonusSpp).toBe(0);
  });

  it("sure-hands : compense fumble lost (cap 2)", () => {
    const a = applySkillBonuses({
      events: [ev("MALUS", 1, -1, "-1 pour 1 fumble lost")],
      bbSkills: ["sure-hands"],
    });
    expect(a.totalBonusSpp).toBe(1);

    const b = applySkillBonuses({
      events: [ev("MALUS", 5, -5, "-5 pour 5 fumble lost")],
      bbSkills: ["sure-hands"],
    });
    expect(b.totalBonusSpp).toBe(2);
  });

  it("safe-pair-of-hands : compense drop (cap 2)", () => {
    const a = applySkillBonuses({
      events: [ev("MALUS", 3, -3, "-3 pour 3 drop(s)")],
      bbSkills: ["safe-pair-of-hands"],
    });
    expect(a.totalBonusSpp).toBe(2);
  });

  it("block : +1 par CAS, capé à 3", () => {
    const a = applySkillBonuses({
      events: [ev("CAS", 2, 4, "2 sack(s) -> CAS")],
      bbSkills: ["block"],
    });
    expect(a.totalBonusSpp).toBe(2);

    const b = applySkillBonuses({
      events: [ev("CAS", 5, 10, "5 sack(s) -> CAS")],
      bbSkills: ["block"],
    });
    expect(b.totalBonusSpp).toBe(3);
  });

  it("mighty-blow (toutes variantes) : +1 par CAS, capé à 3", () => {
    for (const slug of ["mighty-blow", "mighty-blow-1", "mighty-blow-2"]) {
      const out = applySkillBonuses({
        events: [ev("CAS", 2, 4, "2 sack(s) -> CAS")],
        bbSkills: [slug],
      });
      expect(out.totalBonusSpp, slug).toBe(2);
    }
  });

  it("dodge : +1 par INT (DP)", () => {
    const out = applySkillBonuses({
      events: [ev("DP", 2, 4, "2 INT")],
      bbSkills: ["dodge"],
    });
    expect(out.totalBonusSpp).toBe(2);
  });

  it("dodge : ignore pass defended (cible INT spécifique)", () => {
    const out = applySkillBonuses({
      events: [ev("CP", 1, 1, "1 PD (pass breakup)")],
      bbSkills: ["dodge"],
    });
    expect(out.totalBonusSpp).toBe(0);
  });

  it("tackle : bonus unique si au moins 1 forced fumble", () => {
    const a = applySkillBonuses({
      events: [ev("DP", 2, 4, "2 forced fumble")],
      bbSkills: ["tackle"],
    });
    expect(a.totalBonusSpp).toBe(1);

    const b = applySkillBonuses({
      events: [ev("DP", 1, 2, "1 INT")],
      bbSkills: ["tackle"],
    });
    expect(b.totalBonusSpp).toBe(0);
  });

  it("frenzy : déclenche seulement si au moins 2 CAS", () => {
    const a = applySkillBonuses({
      events: [ev("CAS", 1, 2, "1 sack(s) -> CAS")],
      bbSkills: ["frenzy"],
    });
    expect(a.totalBonusSpp).toBe(0);

    const b = applySkillBonuses({
      events: [ev("CAS", 2, 4, "2 sack(s) -> CAS")],
      bbSkills: ["frenzy"],
    });
    expect(b.totalBonusSpp).toBe(1);

    // Multiple CAS events agrégés
    const c = applySkillBonuses({
      events: [
        ev("CAS", 1, 2, "1 sack(s) -> CAS"),
        ev("CAS", 2, 4, "2 CAS (6 QB hits / 3)"),
      ],
      bbSkills: ["frenzy"],
    });
    expect(c.totalBonusSpp).toBe(1);
  });

  it("plusieurs skills : bonus cumulés", () => {
    const out = applySkillBonuses({
      events: [
        ev("TD", 2, 6, "2 passing TD"),
        ev("CAS", 1, 2, "1 sack(s) -> CAS"),
      ],
      bbSkills: ["pass", "block"],
    });
    expect(out.totalBonusSpp).toBe(3); // 2 (pass) + 1 (block)
    expect(out.bonusEvents).toHaveLength(2);
  });

  it("skill dupliqué : compté une seule fois", () => {
    const out = applySkillBonuses({
      events: [ev("TD", 2, 6, "2 passing TD")],
      bbSkills: ["pass", "pass"],
    });
    expect(out.totalBonusSpp).toBe(2);
    expect(out.bonusEvents).toHaveLength(1);
  });

  it("skill inconnu : ignoré silencieusement", () => {
    const out = applySkillBonuses({
      events: [ev("TD", 1, 3, "1 passing TD")],
      bbSkills: ["unknown-skill", "pass"],
    });
    expect(out.totalBonusSpp).toBe(1);
  });
});

describe("parseSppEvents", () => {
  it("array PG natif → events typés", () => {
    const raw = { events: [{ type: "TD", count: 1, spp: 3, reason: "1 passing TD" }] };
    expect(parseSppEvents(raw)).toHaveLength(1);
  });

  it("string sqlite serialisé → parse", () => {
    const json = JSON.stringify({ events: [{ type: "TD", count: 1, spp: 3, reason: "x" }] });
    expect(parseSppEvents(json)).toHaveLength(1);
  });

  it("string invalide → []", () => {
    expect(parseSppEvents("not json")).toEqual([]);
  });

  it("null/undefined → []", () => {
    expect(parseSppEvents(null)).toEqual([]);
    expect(parseSppEvents(undefined)).toEqual([]);
  });

  it("forme inattendue → filtre les events invalides", () => {
    const raw = {
      events: [
        { type: "TD", count: 1, spp: 3, reason: "ok" },
        { foo: "bar" }, // skipped
        null, // skipped
      ],
    };
    expect(parseSppEvents(raw)).toHaveLength(1);
  });

  it("pas de clé events → []", () => {
    expect(parseSppEvents({ totalSpp: 5 })).toEqual([]);
  });
});

describe("parseBbSkills", () => {
  it("array natif", () => {
    expect(parseBbSkills(["pass", "block"])).toEqual(["pass", "block"]);
  });

  it("string serialisé", () => {
    expect(parseBbSkills(JSON.stringify(["pass"]))).toEqual(["pass"]);
  });

  it("null/undefined → []", () => {
    expect(parseBbSkills(null)).toEqual([]);
    expect(parseBbSkills(undefined)).toEqual([]);
  });

  it("string invalide → []", () => {
    expect(parseBbSkills("not json")).toEqual([]);
  });

  it("non-array décodé → []", () => {
    expect(parseBbSkills('{"foo":"bar"}')).toEqual([]);
  });

  it("filtre les non-strings", () => {
    expect(parseBbSkills(["pass", 42, null, "block"])).toEqual(["pass", "block"]);
  });
});
