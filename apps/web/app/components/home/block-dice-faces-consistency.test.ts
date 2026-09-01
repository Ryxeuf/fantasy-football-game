/**
 * Les faces du Dé de Blocage vivent à trois endroits qui doivent rester
 * cohérents :
 *  1. `BLOCK_DIE_FACES` / `BLOCK_DIE_FACE_INFO` du `@bb/game-engine` —
 *     source de vérité (moteur + resolver `@bb/sim-engine`) ;
 *  2. `apps/web/app/components/home/block-dice-faces.ts` — miroir du
 *     simulateur de la page d'accueil (le web n'a pas le moteur en
 *     dépendance runtime) ;
 *  3. `apps/web/app/compendium/data/rules-bb-2025.json`, chapitre
 *     `des-de-blocage` — version publiée.
 *
 * Ce test verrouille 1↔2↔3. Le simulateur affichait des noms inventés
 * (« Joueur à terre », « Hésitation », « Tous à terre », « POW ! ») alors
 * que les descriptions de Compétences servies ailleurs sur le site
 * parlaient d'« Attaquant Plaqué », « Bousculé » ou « Les Deux Plaqués ».
 */

import { describe, expect, it } from "vitest";
import {
  BLOCK_DIE_FACES as ENGINE_FACES,
  BLOCK_DIE_FACE_INFO,
  blockResultFromRoll,
} from "@bb/game-engine";
import type { BlockDieFace } from "./NuffleArt";
import { BLOCK_DIE_FACES, BLOCK_DIE_FACE_LABELS } from "./block-dice-faces";
import { getChapter } from "../../compendium/data";

/** Face d'illustration web ↔ résultat moteur. */
const WEB_TO_ENGINE = {
  down: "PLAYER_DOWN",
  bothdown: "BOTH_DOWN",
  push: "PUSH_BACK",
  stumble: "STUMBLE",
  pow: "POW",
} as const satisfies Record<BlockDieFace, keyof typeof BLOCK_DIE_FACE_INFO>;

describe("dé de blocage : simulateur web ↔ game-engine", () => {
  it("expose six faces, comme un D6", () => {
    expect(BLOCK_DIE_FACES).toHaveLength(6);
    expect(ENGINE_FACES).toHaveLength(6);
  });

  it("porte les cinq icônes du livre, dont deux Repoussé", () => {
    const counts = BLOCK_DIE_FACES.reduce<Record<string, number>>((acc, f) => {
      acc[f] = (acc[f] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({
      down: 1,
      bothdown: 1,
      push: 2,
      stumble: 1,
      pow: 1,
    });
  });

  it("garde le même ordre de faces que le moteur", () => {
    expect(BLOCK_DIE_FACES.map((f) => WEB_TO_ENGINE[f])).toEqual([
      ...ENGINE_FACES,
    ]);
  });

  it("chaque face du D6 retombe sur le résultat moteur annoncé", () => {
    BLOCK_DIE_FACES.forEach((face, i) => {
      expect(blockResultFromRoll(i + 1), `D6 = ${i + 1}`).toBe(
        WEB_TO_ENGINE[face],
      );
    });
  });

  it.each(["fr", "en"] as const)(
    "reprend les libellés du moteur (%s)",
    (lang) => {
      for (const [webFace, engineResult] of Object.entries(WEB_TO_ENGINE)) {
        const info = BLOCK_DIE_FACE_INFO[engineResult];
        const label = BLOCK_DIE_FACE_LABELS[lang][webFace as BlockDieFace];
        expect(label.name).toBe(lang === "fr" ? info.nameFr : info.nameEn);
        expect(label.effect).toBe(
          lang === "fr" ? info.effectFr : info.effectEn,
        );
      }
    },
  );

  it("classe les faces de la pire à la meilleure pour l'attaquant", () => {
    const ranks = (["down", "bothdown", "push", "stumble", "pow"] as const).map(
      (f) => BLOCK_DIE_FACE_LABELS.fr[f].attackerRank,
    );
    expect(ranks).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("dé de blocage : compendium ↔ game-engine", () => {
  const chapter = getChapter("des-de-blocage");

  it("publie le chapitre des dés de blocage", () => {
    expect(chapter, "chapitre `des-de-blocage` introuvable").toBeDefined();
  });

  it("liste les cinq icônes avec leur nombre de faces", () => {
    const table = chapter?.blocks.find(
      (b) => b.type === "table" && b.caption === "Faces du Dé de Blocage",
    );
    if (table?.type !== "table") throw new Error("table introuvable");

    const expected = (
      ["PLAYER_DOWN", "BOTH_DOWN", "PUSH_BACK", "STUMBLE", "POW"] as const
    ).map((r) => [
      BLOCK_DIE_FACE_INFO[r].nameFr,
      String(BLOCK_DIE_FACE_INFO[r].faces),
    ]);

    expect(table.rows.map((r) => [r[0], r[1]])).toEqual(expected);
  });

  it("annonce bien six faces au total", () => {
    const total = Object.values(BLOCK_DIE_FACE_INFO).reduce(
      (sum, f) => sum + f.faces,
      0,
    );
    expect(total).toBe(6);
  });
});
