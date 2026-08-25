/**
 * Les règles spéciales d'équipe et les Ligues régionales existent à DEUX
 * endroits qui doivent rester cohérents :
 *  1. le moteur — `TEAM_SPECIAL_RULES` / `REGIONAL_LEAGUES` (@bb/game-engine),
 *     source des fiches d'équipe, du builder et des feuilles de match ;
 *  2. le compendium publié — chapitre `equipes-ligues-regles-speciales` de
 *     `data/rules-bb-2025.json` (page `/compendium/equipes-ligues-regles-speciales`).
 *
 * Ce test verrouille la correspondance : le compendium ne publiait que 3 des
 * 7 règles spéciales du moteur (Capitaine, Déferlement, Maîtres de la
 * Non-vie et Trois-quarts à vil prix manquaient à l'appel).
 *
 * Rappel : les TEXTES doivent rester distincts (le compendium reformule, cf.
 * CLAUDE.md) — seuls les intitulés et la couverture sont comparés ici.
 */

import { describe, expect, it } from "vitest";
import { REGIONAL_LEAGUES, TEAM_SPECIAL_RULES } from "@bb/game-engine";
import { getChapter } from "./data";
import type { CompendiumBlock } from "./types";

const CHAPTER_SLUG = "equipes-ligues-regles-speciales";
const SPECIAL_RULES_HEADING = "Les règles spéciales d'équipe";
const LEAGUES_HEADING = "Liste des ligues";

/** `Favori de...` (moteur) et `Favori de…` (publié) désignent la même règle. */
function normalize(name: string): string {
  return name
    .replace(/\.\.\./g, "…")
    .replace(/[\s  ]+([!?:;])/g, "$1")
    .trim();
}

const chapter = getChapter(CHAPTER_SLUG);

/** Blocs situés APRÈS le heading de niveau 2 donné (fin de chapitre incluse). */
function blocksAfterH2(blocks: readonly CompendiumBlock[], text: string) {
  const start = blocks.findIndex(
    (b) => b.type === "heading" && b.level === 2 && b.text === text,
  );
  expect(start, `heading "${text}" introuvable`).toBeGreaterThanOrEqual(0);
  return blocks.slice(start + 1);
}

describe("équipes & ligues : compendium ↔ game-engine", () => {
  it("le chapitre est publié", () => {
    expect(chapter, `chapitre "${CHAPTER_SLUG}" introuvable`).toBeDefined();
  });

  it("publie exactement les règles spéciales du moteur, en h3", () => {
    if (!chapter) throw new Error("chapitre introuvable");
    const published = blocksAfterH2(chapter.blocks, SPECIAL_RULES_HEADING)
      .filter((b) => b.type === "heading" && b.level === 3)
      .map((b) => normalize((b as { text: string }).text));

    const engine = TEAM_SPECIAL_RULES.map((r) => normalize(r.nameFr));

    // Couverture exacte dans les deux sens : aucune règle oubliée, aucune
    // section orpheline (règle retirée du moteur mais toujours publiée).
    expect([...published].sort()).toEqual([...engine].sort());
  });

  it("publie exactement les Ligues du moteur", () => {
    if (!chapter) throw new Error("chapitre introuvable");
    const list = blocksAfterH2(chapter.blocks, "Les ligues d'équipes").find(
      (b) => b.type === "list",
    );
    expect(list, `liste sous "${LEAGUES_HEADING}" introuvable`).toBeDefined();
    if (list?.type !== "list") throw new Error("liste introuvable");

    // Chaque puce commence par le nom de la Ligue en gras : `**Nom** : …`.
    const published = list.items.map((item) =>
      normalize(item.match(/^\*\*(.+?)\*\*/)?.[1] ?? item),
    );
    const engine = REGIONAL_LEAGUES.map((l) => normalize(l.nameFr));
    expect([...published].sort()).toEqual([...engine].sort());
  });
});
