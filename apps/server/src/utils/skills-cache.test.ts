/**
 * Régression : une ligne `Skill` créée à chaud doit être visible tout de
 * suite de `GET /api/skills`.
 *
 * Le cas réel est « Haine (X) » (`services/league-hate-trait`), créée à la
 * volée à la validation d'une feuille de match : sans purge, le catalogue
 * mémoïsé restait périmé jusqu'à 5 min et le badge fraîchement posé
 * s'affichait en slug brut (`hate-homme-lezard`) sur la fiche du joueur.
 *
 * On teste le COMPORTEMENT (le mémo recalcule après purge), pas le simple
 * fait que la fonction soit appelée : c'est la purge effective du namespace
 * réellement utilisé par la route qui protège du bug.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { memoizeAsync, invalidateAllMemo } from "./memoize-async";
import {
  SKILLS_CACHE_NS,
  SKILLS_CACHE_TTL_MS,
  invalidatePublicSkillsCache,
} from "./skills-cache";

afterEach(() => {
  invalidateAllMemo();
  vi.useRealTimers();
});

describe("invalidatePublicSkillsCache", () => {
  it("force le recalcul du catalogue mémoïsé", async () => {
    invalidateAllMemo();
    let calls = 0;
    const compute = () => Promise.resolve(++calls);

    // 1er appel : calcule et met en cache ; 2e : sert le cache. Sans cette
    // 2e assertion, le test passerait même si rien n'était jamais mémoïsé.
    expect(
      await memoizeAsync(
        SKILLS_CACHE_NS,
        "season_3::",
        SKILLS_CACHE_TTL_MS,
        compute,
      ),
    ).toBe(1);
    expect(
      await memoizeAsync(
        SKILLS_CACHE_NS,
        "season_3::",
        SKILLS_CACHE_TTL_MS,
        compute,
      ),
    ).toBe(1);

    invalidatePublicSkillsCache();

    expect(
      await memoizeAsync(
        SKILLS_CACHE_NS,
        "season_3::",
        SKILLS_CACHE_TTL_MS,
        compute,
      ),
    ).toBe(2);
  });

  it("purge toutes les clés du namespace (chaque édition × catégorie)", async () => {
    invalidateAllMemo();
    let calls = 0;
    const compute = () => Promise.resolve(++calls);

    // La route mémoïse une clé par `ruleset::category` : une purge partielle
    // laisserait la Saison 2 (ou une catégorie filtrée) sur du périmé.
    await memoizeAsync(
      SKILLS_CACHE_NS,
      "season_3::",
      SKILLS_CACHE_TTL_MS,
      compute,
    );
    await memoizeAsync(
      SKILLS_CACHE_NS,
      "season_2::",
      SKILLS_CACHE_TTL_MS,
      compute,
    );
    await memoizeAsync(
      SKILLS_CACHE_NS,
      "season_3::Trait",
      SKILLS_CACHE_TTL_MS,
      compute,
    );
    expect(calls).toBe(3);

    invalidatePublicSkillsCache();

    await memoizeAsync(
      SKILLS_CACHE_NS,
      "season_3::",
      SKILLS_CACHE_TTL_MS,
      compute,
    );
    await memoizeAsync(
      SKILLS_CACHE_NS,
      "season_2::",
      SKILLS_CACHE_TTL_MS,
      compute,
    );
    await memoizeAsync(
      SKILLS_CACHE_NS,
      "season_3::Trait",
      SKILLS_CACHE_TTL_MS,
      compute,
    );
    expect(calls).toBe(6);
  });

  it("ne touche pas les autres namespaces", async () => {
    invalidateAllMemo();
    let calls = 0;
    const compute = () => Promise.resolve(++calls);

    await memoizeAsync(SKILLS_CACHE_NS, "k", SKILLS_CACHE_TTL_MS, compute);
    await memoizeAsync(
      "public-rosters-list",
      "k",
      SKILLS_CACHE_TTL_MS,
      compute,
    );
    expect(calls).toBe(2);

    invalidatePublicSkillsCache();

    // Le catalogue recalcule…
    await memoizeAsync(SKILLS_CACHE_NS, "k", SKILLS_CACHE_TTL_MS, compute);
    expect(calls).toBe(3);
    // …les rosters, non : la purge reste chirurgicale.
    await memoizeAsync(
      "public-rosters-list",
      "k",
      SKILLS_CACHE_TTL_MS,
      compute,
    );
    expect(calls).toBe(3);
  });

  it("est sans effet quand rien n'est en cache", () => {
    invalidateAllMemo();
    // Purge appelée avant toute lecture (création d'un trait sur une instance
    // fraîche) : ne doit pas lever.
    expect(() => invalidatePublicSkillsCache()).not.toThrow();
  });
});

describe("fenêtre de péremption du catalogue", () => {
  it("sert le cache pendant le TTL, recalcule après", async () => {
    // Documente la fenêtre exacte dans laquelle vivait le bug du slug brut.
    invalidateAllMemo();
    vi.useFakeTimers();
    let calls = 0;
    const compute = () => Promise.resolve(++calls);

    await memoizeAsync(SKILLS_CACHE_NS, "k", SKILLS_CACHE_TTL_MS, compute);
    vi.setSystemTime(new Date(Date.now() + SKILLS_CACHE_TTL_MS - 1_000));
    await memoizeAsync(SKILLS_CACHE_NS, "k", SKILLS_CACHE_TTL_MS, compute);
    expect(calls).toBe(1);

    vi.setSystemTime(new Date(Date.now() + 2_000));
    await memoizeAsync(SKILLS_CACHE_NS, "k", SKILLS_CACHE_TTL_MS, compute);
    expect(calls).toBe(2);
  });

  it("expose un TTL de 5 minutes", () => {
    expect(SKILLS_CACHE_TTL_MS).toBe(5 * 60 * 1000);
  });
});
