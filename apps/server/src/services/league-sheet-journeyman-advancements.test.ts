/**
 * Évolution d'un journalier stagée sur la feuille : vérification (même
 * contrat qu'`applyAdvancementChoice`), revue par côté, trace du résultat.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./skill-access", async () => {
  const actual =
    await vi.importActual<typeof import("./skill-access")>("./skill-access");
  return { ...actual, getSkillSelectionInfo: vi.fn() };
});
vi.mock("./random-primary-pool", () => ({
  resolveRandomPrimaryPool: vi.fn(),
}));

import {
  RANDOM_PRIMARY_SKILL_TABLE_2025,
  rollRandomPrimaryCandidates,
} from "@bb/game-engine";
import { getSkillSelectionInfo } from "./skill-access";
import { resolveRandomPrimaryPool } from "./random-primary-pool";
import {
  clearAdvancementTrace,
  mergeAdvancementTraces,
  reviewJourneymanAdvancements,
  traceJourneymanAdvancements,
  verifyJourneymanAdvancement,
} from "./league-sheet-journeyman-advancements";
import {
  journeymanRandomPrimarySeed,
  type SheetJourneyman,
} from "./league-sheet-journeymen";
import type { StagedAdvancement } from "./league-sheet-advancements";

const mockSkillInfo = getSkillSelectionInfo as ReturnType<typeof vi.fn>;
const mockPool = resolveRandomPrimaryPool as ReturnType<typeof vi.fn>;

/** Trois-quart Orque (Principale G,S — Secondaire A,K), aucune compétence. */
const ORC: SheetJourneyman = {
  id: "journeyman-home-1",
  number: 12,
  name: "Journalier 1",
  position: "orc_trois_quart_orque",
  positionName: "Journalier (Trois-quart Orque)",
  stats: { ma: 5, st: 3, ag: 3, pa: 4, av: 10 },
  skills: "loner-4",
  cost: 50_000,
};

/** Trois-quart Gobelin (Principale A,K) : Esquive déjà possédée. */
const GOBLIN: SheetJourneyman = {
  ...ORC,
  id: "journeyman-home-2",
  position: "orc_trois_quart_gobelin",
  positionName: "Journalier (Trois-quart Gobelin)",
  stats: { ma: 6, st: 2, ag: 3, pa: 4, av: 8 },
  skills: "stunty,right-stuff,dodge,loner-4",
  cost: 40_000,
};

function entry(over: Partial<StagedAdvancement> = {}): StagedAdvancement {
  return { playerId: ORC.id, type: "primary", skillSlug: "block", ...over };
}

/** Les deux candidats exacts du tirage serveur pour ce journalier. */
function candidatesFor(j: SheetJourneyman, category: "G" | "S" | "A"): string[] {
  return rollRandomPrimaryCandidates({
    category,
    ownedSlugs: j.skills.split(","),
    seed: journeymanRandomPrimarySeed("ms1", j, category),
    pool: RANDOM_PRIMARY_SKILL_TABLE_2025[category],
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mockPool.mockImplementation(
    async (category: "G" | "A" | "S" | "P" | "M" | "K") =>
      RANDOM_PRIMARY_SKILL_TABLE_2025[category],
  );
  mockSkillInfo.mockImplementation(async (slug: string) => ({
    categoryCode:
      slug === "block" ? "G" : slug === "dodge" ? "A" : slug === "guard" ? "S" : null,
    excludedFromSelection: slug === "mighty-blow-2",
  }));
});

describe("verifyJourneymanAdvancement", () => {
  const base = { sheetId: "ms1", ruleset: "season_3", journeyman: ORC };

  // Le schéma ne valide que la FORME de la caractéristique (stat parmi les
  // cinq, D8 de 1 à 8) : la cohérence D8 / caractéristique et les bornes
  // BB2025 sont celles d'`applyAdvancementChoice` pour un joueur du roster.
  describe("amélioration de caractéristique", () => {
    const characteristic = (over: Partial<StagedAdvancement>) =>
      entry({ type: "characteristic", skillSlug: null, ...over });

    it("accepte une caractéristique permise par le jet D8", async () => {
      // 5 → MA ou PA.
      await expect(
        verifyJourneymanAdvancement({
          ...base,
          entry: characteristic({ stat: "ma", d8: 5 }),
        }),
      ).resolves.toEqual({ ok: true });
    });

    it("refuse une caractéristique que le jet n'autorise pas (stat-roll-mismatch)", async () => {
      // 1 → AV seulement : pas de Force choisie à la main.
      await expect(
        verifyJourneymanAdvancement({
          ...base,
          entry: characteristic({ stat: "st", d8: 1 }),
        }),
      ).resolves.toEqual({ ok: false, reason: "stat-roll-mismatch" });
    });

    it("exige la caractéristique et un D8 valide", async () => {
      await expect(
        verifyJourneymanAdvancement({
          ...base,
          entry: characteristic({ stat: null, d8: 5 }),
        }),
      ).resolves.toEqual({ ok: false, reason: "missing-stat" });
      await expect(
        verifyJourneymanAdvancement({
          ...base,
          entry: characteristic({ stat: "ma", d8: null }),
        }),
      ).resolves.toEqual({ ok: false, reason: "missing-d8" });
      await expect(
        verifyJourneymanAdvancement({
          ...base,
          entry: characteristic({ stat: "ma", d8: 9 }),
        }),
      ).resolves.toEqual({ ok: false, reason: "missing-d8" });
    });

    it("refuse une caractéristique déjà à sa limite ou sans valeur (stat-not-improvable)", async () => {
      // Force déjà à 5 (limite BB2025), même sur un 8 « au choix ».
      await expect(
        verifyJourneymanAdvancement({
          ...base,
          journeyman: { ...ORC, stats: { ...ORC.stats, st: 5 } },
          entry: characteristic({ stat: "st", d8: 8 }),
        }),
      ).resolves.toEqual({ ok: false, reason: "stat-not-improvable" });
      // Passe « — » (null) : rien à améliorer.
      await expect(
        verifyJourneymanAdvancement({
          ...base,
          journeyman: { ...ORC, stats: { ...ORC.stats, pa: null } },
          entry: characteristic({ stat: "pa", d8: 2 }),
        }),
      ).resolves.toEqual({ ok: false, reason: "stat-not-improvable" });
    });
  });

  it("refuse une compétence absente ou déjà possédée", async () => {
    await expect(
      verifyJourneymanAdvancement({ ...base, entry: entry({ skillSlug: null }) }),
    ).resolves.toEqual({ ok: false, reason: "missing-skill" });
    await expect(
      verifyJourneymanAdvancement({
        ...base,
        journeyman: GOBLIN,
        entry: entry({ playerId: GOBLIN.id, skillSlug: "dodge" }),
      }),
    ).resolves.toEqual({ ok: false, reason: "skill-already-owned" });
  });

  describe("tirage « Hasard » (random-primary)", () => {
    it("exige une catégorie connue, Principale pour le poste", async () => {
      await expect(
        verifyJourneymanAdvancement({
          ...base,
          entry: entry({ type: "random-primary", category: null }),
        }),
      ).resolves.toEqual({ ok: false, reason: "missing-category" });
      await expect(
        verifyJourneymanAdvancement({
          ...base,
          entry: entry({ type: "random-primary", category: "Z" }),
        }),
      ).resolves.toEqual({ ok: false, reason: "invalid-category" });
      // Agilité n'est pas Principale pour un Trois-quart Orque (G,S).
      await expect(
        verifyJourneymanAdvancement({
          ...base,
          entry: entry({ type: "random-primary", category: "A", skillSlug: "dodge" }),
        }),
      ).resolves.toEqual({ ok: false, reason: "category-not-primary" });
    });

    it("n'accepte que l'un des DEUX candidats du tirage (anti-triche)", async () => {
      const candidates = candidatesFor(ORC, "G");
      const other = RANDOM_PRIMARY_SKILL_TABLE_2025.G.find(
        (slug) => !candidates.includes(slug),
      ) as string;
      await expect(
        verifyJourneymanAdvancement({
          ...base,
          entry: entry({
            type: "random-primary",
            category: "G",
            skillSlug: candidates[0],
          }),
        }),
      ).resolves.toEqual({ ok: true });
      await expect(
        verifyJourneymanAdvancement({
          ...base,
          entry: entry({ type: "random-primary", category: "G", skillSlug: other }),
        }),
      ).resolves.toEqual({ ok: false, reason: "random-not-in-candidates" });
      // Même pool filtré en base que l'endpoint de tirage.
      expect(mockPool).toHaveBeenCalledWith("G", "season_3");
    });

    it("suit le POSTE du journalier : les candidats du Gobelin ne sont pas ceux de l'Orque", async () => {
      const [first] = candidatesFor(GOBLIN, "A");
      await expect(
        verifyJourneymanAdvancement({
          ...base,
          journeyman: GOBLIN,
          entry: entry({
            playerId: GOBLIN.id,
            type: "random-primary",
            category: "A",
            skillSlug: first,
          }),
        }),
      ).resolves.toEqual({ ok: true });
      expect(first).not.toBe("dodge");
    });
  });

  describe("choix libre (Principale / Secondaire)", () => {
    it("accepte une compétence du pool du poste", async () => {
      await expect(
        verifyJourneymanAdvancement({ ...base, entry: entry({ skillSlug: "block" }) }),
      ).resolves.toEqual({ ok: true });
      await expect(
        verifyJourneymanAdvancement({
          ...base,
          entry: entry({ type: "secondary", skillSlug: "dodge" }),
        }),
      ).resolves.toEqual({ ok: true });
    });

    it("refuse une compétence hors du pool pour ce type", async () => {
      // Esquive (A) n'est pas Principale pour un Trois-quart Orque.
      await expect(
        verifyJourneymanAdvancement({ ...base, entry: entry({ skillSlug: "dodge" }) }),
      ).resolves.toEqual({ ok: false, reason: "skill-not-in-pool" });
    });

    it("refuse une compétence exclue de la sélection", async () => {
      await expect(
        verifyJourneymanAdvancement({
          ...base,
          entry: entry({ skillSlug: "mighty-blow-2" }),
        }),
      ).resolves.toEqual({ ok: false, reason: "skill-excluded-from-selection" });
    });

    it("reste souple quand le catalogue de compétences est injoignable", async () => {
      mockSkillInfo.mockRejectedValue(new Error("db down"));
      await expect(
        verifyJourneymanAdvancement({ ...base, entry: entry({ skillSlug: "dodge" }) }),
      ).resolves.toEqual({ ok: true });
    });

    it("lit l'accès du poste EN BASE quand il est fourni", async () => {
      // La base ouvre Agilité en Principale pour ce poste : Esquive passe.
      await expect(
        verifyJourneymanAdvancement({
          ...base,
          entry: entry({ skillSlug: "dodge" }),
          positions: [
            {
              slug: "orc_trois_quart_orque",
              displayName: "Trois-quart Orque",
              cost: 50,
              max: 16,
              ma: 5,
              st: 3,
              ag: 3,
              pa: 4,
              av: 10,
              skills: "",
              primarySkills: "G,A",
              secondarySkills: "S",
            },
          ],
        }),
      ).resolves.toEqual({ ok: true });
    });
  });
});

describe("reviewJourneymanAdvancements", () => {
  it("laisse passer le roster, garde les journaliers vérifiés, écarte et trace les autres", async () => {
    const roster = entry({ playerId: "h1", skillSlug: "block" });
    const okJourneyman = entry({ skillSlug: "block" });
    const badJourneyman = entry({ playerId: GOBLIN.id, skillSlug: "dodge" });
    const ghost = entry({ playerId: "journeyman-home-9", skillSlug: "block" });
    const review = await reviewJourneymanAdvancements({
      sheetId: "ms1",
      ruleset: "season_3",
      journeymen: [ORC, GOBLIN],
      staged: [roster, okJourneyman, badJourneyman, ghost],
    });
    expect(review.staged).toEqual([roster, okJourneyman]);
    expect([...review.refused.entries()]).toEqual([
      [GOBLIN.id, "skill-already-owned"],
      ["journeyman-home-9", "journeyman-not-found"],
    ]);
  });
});

describe("traceJourneymanAdvancements / mergeAdvancementTraces", () => {
  const refusedEntry = entry({ playerId: GOBLIN.id, skillSlug: "dodge" });
  const hiredEntry = entry({ type: "random-primary", category: "G", skillSlug: "block" });
  const notHired = entry({ playerId: "journeyman-home-3" });
  const rosterEntry = entry({ playerId: "h1" });

  it("trace refus, non-recrutement, PSP insuffisants et application", () => {
    const traced = traceJourneymanAdvancements({
      staged: [rosterEntry, refusedEntry, hiredEntry, notHired],
      review: { staged: [], refused: new Map([[GOBLIN.id, "skill-already-owned"]]) },
      hires: new Map([[ORC.id, { advancementTaken: true, pspCost: 3 }]]),
    });
    // Le roster n'est pas tracé ici (c'est `applyStagedAdvancements`).
    expect(traced.has("h1")).toBe(false);
    expect(traced.get(GOBLIN.id)).toEqual({
      ...refusedEntry,
      applied: false,
      cost: undefined,
      skipReason: "skill-already-owned",
    });
    expect(traced.get(ORC.id)).toEqual({
      ...hiredEntry,
      applied: true,
      cost: 3,
      skipReason: undefined,
    });
    expect(traced.get("journeyman-home-3")).toEqual({
      ...notHired,
      applied: false,
      cost: undefined,
      skipReason: "journeyman-not-hired",
    });
  });

  it("PSP du match insuffisants : recruté sans son évolution", () => {
    const traced = traceJourneymanAdvancements({
      staged: [hiredEntry],
      review: { staged: [hiredEntry], refused: new Map() },
      hires: new Map([[ORC.id, { advancementTaken: false, pspCost: 3 }]]),
    });
    expect(traced.get(ORC.id)).toMatchObject({
      applied: false,
      skipReason: "insufficient-spp",
    });
  });

  it("fusionne roster + journaliers dans l'ORDRE de la saisie", () => {
    const applied = { ...rosterEntry, applied: true, cost: 6 };
    const merged = mergeAdvancementTraces(
      [hiredEntry, rosterEntry, notHired],
      [applied],
      new Map([[ORC.id, { ...hiredEntry, applied: true, cost: 3 }]]),
    );
    expect(merged).toEqual([
      { ...hiredEntry, applied: true, cost: 3 },
      applied,
      notHired,
    ]);
  });

  it("clearAdvancementTrace retire les marqueurs d'application", () => {
    expect(
      clearAdvancementTrace({
        ...rosterEntry,
        applied: true,
        cost: 6,
        skipReason: "x",
      }),
    ).toEqual({ ...rosterEntry, applied: undefined, cost: undefined, skipReason: undefined });
  });
});
