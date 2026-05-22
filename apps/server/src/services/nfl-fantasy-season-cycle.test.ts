import { describe, expect, it } from "vitest";

import {
  DEFAULT_CYCLE_SPECS,
  findWeekNumberAt,
  pickCycleForCreation,
  statusOf,
  type CycleDTO,
  type WeekRow,
} from "./nfl-fantasy-season-cycle";

// ────────────────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────────────────

function makeWeeks(): WeekRow[] {
  // 22 semaines NFL : W1 commence le 2025-09-04, chaque semaine dure 7
  // jours (jeudi -> mercredi). Pas representatif au mois pres mais
  // suffit pour le test de la logique date->weekNumber.
  const weeks: WeekRow[] = [];
  const start = new Date("2025-09-04T00:00:00Z");
  for (let i = 1; i <= 22; i++) {
    const startDate = new Date(start.getTime() + (i - 1) * 7 * 24 * 3600 * 1000);
    const endDate = new Date(startDate.getTime() + 7 * 24 * 3600 * 1000);
    weeks.push({ weekNumber: i, startDate, endDate });
  }
  return weeks;
}

function dtoOf(spec: (typeof DEFAULT_CYCLE_SPECS)[number]): CycleDTO {
  return {
    id: `cycle-${spec.cycleNumber}`,
    seasonId: "2025",
    cycleNumber: spec.cycleNumber,
    cycleType: spec.cycleType,
    label: spec.label,
    startWeek: spec.startWeek,
    endWeek: spec.endWeek,
  };
}

const CYCLES = DEFAULT_CYCLE_SPECS.map(dtoOf);

// ────────────────────────────────────────────────────────────────────
// findWeekNumberAt
// ────────────────────────────────────────────────────────────────────

describe("findWeekNumberAt", () => {
  const weeks = makeWeeks();

  it("retourne 0 avant le debut de saison", () => {
    expect(findWeekNumberAt(weeks, new Date("2025-08-01T00:00:00Z"))).toBe(0);
  });

  it("retourne la semaine en cours quand la date est dedans", () => {
    // W3 commence 14 jours apres W1 => 2025-09-18
    expect(findWeekNumberAt(weeks, new Date("2025-09-19T12:00:00Z"))).toBe(3);
  });

  it("retourne last.weekNumber+1 quand la date est apres la saison (tout closed)", () => {
    // 23 (= 22 + 1) signifie "saison terminee" => le dernier cycle
    // (Playoffs W19-W22) doit etre classe closed, pas active.
    expect(findWeekNumberAt(weeks, new Date("2026-06-01T00:00:00Z"))).toBe(23);
  });

  it("retourne 0 si aucune semaine n'existe", () => {
    expect(findWeekNumberAt([], new Date())).toBe(0);
  });

  it("est insensible a l'ordre du tableau d'entree", () => {
    const shuffled = [...weeks].reverse();
    expect(findWeekNumberAt(shuffled, new Date("2025-09-19T12:00:00Z"))).toBe(3);
  });
});

// ────────────────────────────────────────────────────────────────────
// statusOf
// ────────────────────────────────────────────────────────────────────

describe("statusOf", () => {
  it("upcoming quand la saison n'a pas commence (currentWeek=0)", () => {
    for (const c of CYCLES) {
      expect(statusOf(c, 0)).toBe("upcoming");
    }
  });

  it("upcoming pour cycle 2/3/4 en semaine 1", () => {
    expect(statusOf(CYCLES[0], 1)).toBe("active"); // cycle 1 W1-W6
    expect(statusOf(CYCLES[1], 1)).toBe("upcoming"); // cycle 2 W7-W12
    expect(statusOf(CYCLES[2], 1)).toBe("upcoming");
    expect(statusOf(CYCLES[3], 1)).toBe("upcoming");
  });

  it("active pour le cycle qui couvre la semaine courante", () => {
    expect(statusOf(CYCLES[1], 9)).toBe("active"); // W9 dans cycle 2 (W7-W12)
    expect(statusOf(CYCLES[3], 20)).toBe("active"); // W20 dans cycle 4
  });

  it("closed pour les cycles passes", () => {
    expect(statusOf(CYCLES[0], 7)).toBe("closed");
    expect(statusOf(CYCLES[1], 13)).toBe("closed");
  });

  it("frontiere : derniere semaine d'un cycle reste active", () => {
    expect(statusOf(CYCLES[0], 6)).toBe("active");
    expect(statusOf(CYCLES[0], 7)).toBe("closed");
  });
});

// ────────────────────────────────────────────────────────────────────
// pickCycleForCreation (snap-to-next)
// ────────────────────────────────────────────────────────────────────

describe("pickCycleForCreation", () => {
  it("retourne le cycle 1 avant le debut de saison", () => {
    const picked = pickCycleForCreation(CYCLES, 0);
    expect(picked?.cycleNumber).toBe(1);
  });

  it("snap-to-next en W2 (cycle 1 deja demarre) => cycle 2", () => {
    const picked = pickCycleForCreation(CYCLES, 2);
    expect(picked?.cycleNumber).toBe(2);
  });

  it("snap-to-next en W8 (cycle 2 deja demarre) => cycle 3", () => {
    const picked = pickCycleForCreation(CYCLES, 8);
    expect(picked?.cycleNumber).toBe(3);
  });

  it("snap-to-next en W14 => cycle playoffs (4)", () => {
    const picked = pickCycleForCreation(CYCLES, 14);
    expect(picked?.cycleNumber).toBe(4);
  });

  it("retourne null quand tous les cycles sont demarres/termines", () => {
    expect(pickCycleForCreation(CYCLES, 20)).toBeNull();
    expect(pickCycleForCreation(CYCLES, 25)).toBeNull();
  });

  it("est insensible a l'ordre du tableau d'entree", () => {
    const shuffled = [...CYCLES].reverse();
    expect(pickCycleForCreation(shuffled, 2)?.cycleNumber).toBe(2);
  });
});

// ────────────────────────────────────────────────────────────────────
// DEFAULT_CYCLE_SPECS — sanity check
// ────────────────────────────────────────────────────────────────────

describe("DEFAULT_CYCLE_SPECS", () => {
  it("couvre les 22 semaines NFL sans chevauchement ni trou", () => {
    const sorted = [...DEFAULT_CYCLE_SPECS].sort(
      (a, b) => a.cycleNumber - b.cycleNumber,
    );
    expect(sorted[0].startWeek).toBe(1);
    expect(sorted[sorted.length - 1].endWeek).toBe(22);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].startWeek).toBe(sorted[i - 1].endWeek + 1);
    }
  });

  it("a exactement 1 cycle playoffs", () => {
    const playoffs = DEFAULT_CYCLE_SPECS.filter(
      (c) => c.cycleType === "playoffs",
    );
    expect(playoffs).toHaveLength(1);
    expect(playoffs[0].cycleNumber).toBe(4);
  });
});
