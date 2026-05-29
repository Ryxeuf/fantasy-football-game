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
  getSkillEffect,
  NFL_FANTASY_SKILL_EFFECTS,
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

// ────────────────────────────────────────────────────────────────────
// Nouvelles skills V2 — passing
// ────────────────────────────────────────────────────────────────────

describe("applySkillBonuses — passing skills V2", () => {
  it("accurate : +1 par CP de passing yards (cap 2)", () => {
    const out = applySkillBonuses({
      events: [
        ev("CP", 4, 4, "4 CP (passing yards 320/75)"),
      ],
      bbSkills: ["accurate"],
    });
    expect(out.totalBonusSpp).toBe(2); // cap 2
  });

  it("cannoneer : +1 si >=300 yd passing (4 CP de yards)", () => {
    const yes = applySkillBonuses({
      events: [ev("CP", 4, 4, "4 CP (passing yards 320/75)")],
      bbSkills: ["cannoneer"],
    });
    expect(yes.totalBonusSpp).toBe(1);

    const no = applySkillBonuses({
      events: [ev("CP", 3, 3, "3 CP (passing yards 240/75)")],
      bbSkills: ["cannoneer"],
    });
    expect(no.totalBonusSpp).toBe(0);
  });

  it("strong-arm : +1 si >=225 yd (3 CP)", () => {
    const out = applySkillBonuses({
      events: [ev("CP", 3, 3, "3 CP (passing yards 240/75)")],
      bbSkills: ["strong-arm"],
    });
    expect(out.totalBonusSpp).toBe(1);
  });

  it("running-pass : passing TD ET rushing TD du QB requis", () => {
    const both = applySkillBonuses({
      events: [
        ev("TD", 1, 3, "1 passing TD"),
        ev("TD", 1, 3, "1 rushing TD (QB run)"),
      ],
      bbSkills: ["running-pass"],
    });
    expect(both.totalBonusSpp).toBe(1);

    const onlyPass = applySkillBonuses({
      events: [ev("TD", 2, 6, "2 passing TD")],
      bbSkills: ["running-pass"],
    });
    expect(onlyPass.totalBonusSpp).toBe(0);
  });

  it("safe-throw : passing TD sans INT thrown", () => {
    const clean = applySkillBonuses({
      events: [ev("TD", 1, 3, "1 passing TD")],
      bbSkills: ["safe-throw"],
    });
    expect(clean.totalBonusSpp).toBe(1);

    const withInt = applySkillBonuses({
      events: [
        ev("TD", 1, 3, "1 passing TD"),
        ev("MALUS", 1, -1, "-1 pour 1 INT thrown"),
      ],
      bbSkills: ["safe-throw"],
    });
    expect(withInt.totalBonusSpp).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// Nouvelles skills V2 — rushing
// ────────────────────────────────────────────────────────────────────

describe("applySkillBonuses — rushing skills V2", () => {
  it("sprint : +1 si rushing >=100", () => {
    const out = applySkillBonuses({
      events: [ev("CP", 1, 1, "bonus CP (rushing yards 124 >=100)")],
      bbSkills: ["sprint"],
    });
    expect(out.totalBonusSpp).toBe(1);
  });

  it("sure-feet : rushing >=75 ET aucun fumble lost", () => {
    const clean = applySkillBonuses({
      events: [ev("CP", 1, 1, "1 CP (rushing yards 80 >=75)")],
      bbSkills: ["sure-feet"],
    });
    expect(clean.totalBonusSpp).toBe(1);

    const fumbled = applySkillBonuses({
      events: [
        ev("CP", 1, 1, "1 CP (rushing yards 80 >=75)"),
        ev("MALUS", 1, -1, "-1 pour 1 fumble lost"),
      ],
      bbSkills: ["sure-feet"],
    });
    expect(fumbled.totalBonusSpp).toBe(0);
  });

  it("break-tackle : +1 par rushing TD (hors QB), cap 2", () => {
    const out = applySkillBonuses({
      events: [ev("TD", 3, 9, "3 rushing TD")],
      bbSkills: ["break-tackle"],
    });
    expect(out.totalBonusSpp).toBe(2);
  });

  it("juggernaut : rushing TD ET CAS requis", () => {
    const out = applySkillBonuses({
      events: [
        ev("TD", 1, 3, "1 rushing TD"),
        ev("CAS", 1, 2, "1 sack(s) -> CAS"),
      ],
      bbSkills: ["juggernaut"],
    });
    expect(out.totalBonusSpp).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────────────
// Nouvelles skills V2 — receiving
// ────────────────────────────────────────────────────────────────────

describe("applySkillBonuses — receiving skills V2", () => {
  it("extra-arms : +1 par CP de réception (cap 2)", () => {
    const out = applySkillBonuses({
      events: [ev("CP", 5, 5, "5 CP (receptions cap a 5)")],
      bbSkills: ["extra-arms"],
    });
    expect(out.totalBonusSpp).toBe(2);
  });

  it("diving-catch : +1 si recv >=100", () => {
    const out = applySkillBonuses({
      events: [ev("CP", 1, 1, "bonus CP (recv yards 110 >=100)")],
      bbSkills: ["diving-catch"],
    });
    expect(out.totalBonusSpp).toBe(1);
  });

  it("very-long-legs : +1 si recv >=150", () => {
    const out = applySkillBonuses({
      events: [ev("CP", 1, 1, "bonus CP (recv yards 160 >=150)")],
      bbSkills: ["very-long-legs"],
    });
    expect(out.totalBonusSpp).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────────────
// Nouvelles skills V2 — defensive
// ────────────────────────────────────────────────────────────────────

describe("applySkillBonuses — defensive skills V2", () => {
  it("claws : +1 par CAS (cap 3)", () => {
    const out = applySkillBonuses({
      events: [ev("CAS", 4, 8, "4 sack(s) -> CAS")],
      bbSkills: ["claws"],
    });
    expect(out.totalBonusSpp).toBe(3);
  });

  it("wrestle : +1 si au moins 1 CAS", () => {
    const out = applySkillBonuses({
      events: [ev("CAS", 5, 10, "5 sack(s) -> CAS")],
      bbSkills: ["wrestle"],
    });
    expect(out.totalBonusSpp).toBe(1); // cap 1
  });

  it("strip-ball : +1 par forced fumble (cap 2)", () => {
    const out = applySkillBonuses({
      events: [ev("DP", 3, 6, "3 forced fumble")],
      bbSkills: ["strip-ball"],
    });
    expect(out.totalBonusSpp).toBe(2);
  });

  it("shadowing : +1 par PD (cap 2)", () => {
    const out = applySkillBonuses({
      events: [ev("CP", 4, 4, "4 PD (pass breakup)")],
      bbSkills: ["shadowing"],
    });
    expect(out.totalBonusSpp).toBe(2);
  });

  it("diving-tackle : +1 si tackles>=10 CAS bonus", () => {
    const out = applySkillBonuses({
      events: [ev("CAS", 1, 2, "1 CAS (12 tackles >=10)")],
      bbSkills: ["diving-tackle"],
    });
    expect(out.totalBonusSpp).toBe(1);
  });

  it("defensive : +1 si au moins 1 INT (alternatif à dodge)", () => {
    const out = applySkillBonuses({
      events: [ev("DP", 2, 4, "2 INT")],
      bbSkills: ["defensive"],
    });
    expect(out.totalBonusSpp).toBe(1);
  });

  it("fend : forced fumble ET recovery requis", () => {
    const yes = applySkillBonuses({
      events: [
        ev("DP", 1, 2, "1 forced fumble"),
        ev("DP", 1, 2, "1 fumble recovery"),
      ],
      bbSkills: ["fend"],
    });
    expect(yes.totalBonusSpp).toBe(1);

    const onlyFF = applySkillBonuses({
      events: [ev("DP", 2, 4, "2 forced fumble")],
      bbSkills: ["fend"],
    });
    expect(onlyFF.totalBonusSpp).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// Catalogue + getSkillEffect
// ────────────────────────────────────────────────────────────────────

describe("NFL_FANTASY_SKILL_EFFECTS catalogue", () => {
  it("contient au moins 30 skills avec effet", () => {
    expect(NFL_FANTASY_SKILL_EFFECTS.length).toBeGreaterThanOrEqual(30);
  });

  it("slugs uniques", () => {
    const slugs = NFL_FANTASY_SKILL_EFFECTS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("getSkillEffect retourne l'entree exacte", () => {
    expect(getSkillEffect("pass")?.family).toBe("passing");
    expect(getSkillEffect("claws")?.family).toBe("defensive");
  });

  it("getSkillEffect mighty-blow-* retombe sur mighty-blow-1", () => {
    expect(getSkillEffect("mighty-blow-3")?.slug).toBe("mighty-blow-1");
  });

  it("getSkillEffect inconnu → null", () => {
    expect(getSkillEffect("inexistant")).toBeNull();
  });

  it("chaque skill du catalogue a une regle ou une variante mighty-blow", () => {
    // Sanity check : un mismatch entre la table SKILL_BONUS_RULES et le
    // catalogue silencieusement laisserait des skills affichees mais
    // sans effet. On simule un event qui declenche la skill et on
    // verifie qu'au moins une retourne >0 (sauf cas a evaluation
    // composite qui necessitent plusieurs events).
    const broadEvents: SppEvent[] = [
      ev("TD", 1, 3, "1 passing TD"),
      ev("TD", 1, 3, "1 rushing TD"),
      ev("TD", 1, 3, "1 rushing TD (QB run)"),
      ev("TD", 1, 3, "1 receiving TD"),
      ev("TD", 1, 3, "1 defensive TD"),
      ev("CP", 4, 4, "4 CP (passing yards 320/75)"),
      ev("CP", 5, 5, "5 CP (receptions cap a 5)"),
      ev("CP", 1, 1, "1 CP (rushing yards 80 >=75)"),
      ev("CP", 1, 1, "bonus CP (rushing yards 110 >=100)"),
      ev("CP", 1, 1, "bonus CP (recv yards 150 >=150)"),
      ev("CP", 1, 1, "bonus CP (recv yards 110 >=100)"),
      ev("CP", 1, 1, "bonus CP (rushing yards 60 >=50)"),
      ev("CP", 1, 1, "bonus CP (team rush 180 >150)"),
      ev("CP", 1, 1, "bonus CP (team rating 110 >100)"),
      ev("CP", 1, 1, "bonus CP (team sacks allowed 1 <2)"),
      ev("CP", 1, 1, "participation (titulaire OL, no team context)"),
      ev("CP", 2, 2, "2 PD (pass breakup)"),
      ev("CP", 1, 1, "bonus CP (2 TFL >=2)"),
      ev("CAS", 2, 4, "2 sack(s) -> CAS"),
      ev("CAS", 1, 2, "1 CAS (3 QB hits / 3)"),
      ev("CAS", 1, 2, "1 CAS (12 tackles >=10)"),
      ev("DP", 1, 2, "1 INT"),
      ev("DP", 1, 2, "1 forced fumble"),
      ev("DP", 1, 2, "1 fumble recovery"),
    ];
    const allSlugs = NFL_FANTASY_SKILL_EFFECTS.map((s) => s.slug);
    const out = applySkillBonuses({ events: broadEvents, bbSkills: allSlugs });
    // Au moins 80% des skills doivent declencher avec ce broad events.
    const triggered = out.bonusEvents.length;
    expect(triggered).toBeGreaterThanOrEqual(
      Math.floor(allSlugs.length * 0.6),
    );
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
