/**
 * Garde anti-regression — filtre « joueur au roster actif ».
 *
 * Invariant : un `where` Prisma qui exclut les joueurs sortis du roster DOIT
 * exclure les DEUX sorties possibles — mort (`dead: false`) ET licenciement
 * (`firedAt: null`) — via `ACTIVE_PLAYER_WHERE` (cf. `player-status.ts`).
 * Filtrer une seule des deux laisse passer la moitie des joueurs sortis :
 * c'est le bug qui laissait un mort s'inscrire en coupe et un licencie
 * prendre un level-up.
 *
 * Strategie "ratchet" : tout fichier de `services/` et `routes/` est enforce
 * PAR DEFAUT. Les fichiers qui filtrent VOLONTAIREMENT une seule dimension
 * sont listes dans `INTENTIONAL_PARTIAL` avec leur justification ; cette
 * liste ne doit que DECROITRE.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SERVICES_DIR = __dirname;
const ROUTES_DIR = join(__dirname, "..", "routes");

const DEAD_FILTER = /\bdead:\s*false\b/;
const FIRED_FILTER = /\bfiredAt:\s*null\b/;
/** Fenetre de contexte : un `where` Prisma tient largement en 8 lignes. */
const CONTEXT_LINES = 8;

/**
 * Fichiers autorises a filtrer une seule dimension, avec la raison.
 * NE DOIT QUE DECROITRE.
 */
const INTENTIONAL_PARTIAL = new Map<string, string>([
  [
    "league-player-stats.ts",
    "classement des joueurs de la saison : un licencie garde ses stats acquises, seuls les morts sortent du catalogue courant",
  ],
  [
    "commissioner-team-edit.ts",
    "editeur commissaire : affiche les morts (badge ☠) pour permettre la correction d'une saisie, exclut seulement les licencies",
  ],
  [
    "league-match-sheet.ts",
    "feuille de match : les morts sont affiches (badge ☠) tant qu'ils figurent aux evenements du match",
  ],
  [
    "league-offline-result.ts",
    "purge des suspensions + filtre firedAt de validation des licenciements (le joueur vise est vivant par construction)",
  ],
  [
    "team-player-handlers.ts",
    "edition cosmetique (nom/numero) : autorisee sur un joueur mort, refusee sur un licencie (sorti du roster)",
  ],
]);

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).filter(
    (f) => f.endsWith(".ts") && !f.endsWith(".test.ts"),
  );
}

/**
 * Lignes portant un filtre partiel : `dead: false` sans `firedAt: null` a
 * proximite (ou l'inverse), et sans `ACTIVE_PLAYER_WHERE` dans la fenetre.
 */
function partialFilterLines(dir: string, file: string): string[] {
  const lines = readFileSync(join(dir, file), "utf8").split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const hasDead = DEAD_FILTER.test(line);
    const hasFired = FIRED_FILTER.test(line);
    if (!hasDead && !hasFired) continue;
    const from = Math.max(0, i - CONTEXT_LINES);
    const to = Math.min(lines.length, i + CONTEXT_LINES + 1);
    const before = lines.slice(from, i + 1).join("\n");
    // Seuls les FILTRES comptent : `{ dead: false }` en `data:` d'un update
    // (reversion) n'est pas un filtre de roster.
    if (!/\bwhere\b/.test(before)) continue;
    const window = lines.slice(from, to).join("\n");
    if (window.includes("ACTIVE_PLAYER_WHERE")) continue;
    const counterpart = hasDead ? FIRED_FILTER : DEAD_FILTER;
    if (counterpart.test(window)) continue;
    out.push(`${i + 1}: ${line.trim()}`);
  }
  return out;
}

describe("filtre roster actif — morts ET licencies", () => {
  for (const [dir, label] of [
    [SERVICES_DIR, "services"],
    [ROUTES_DIR, "routes"],
  ] as const) {
    for (const file of listSourceFiles(dir)) {
      if (INTENTIONAL_PARTIAL.has(file)) continue;
      it(`${label}/${file} — pas de filtre partiel dead/firedAt`, () => {
        expect(partialFilterLines(dir, file)).toEqual([]);
      });
    }
  }

  it("la liste des exceptions ne reference que des fichiers existants", () => {
    const all = new Set([
      ...listSourceFiles(SERVICES_DIR),
      ...listSourceFiles(ROUTES_DIR),
    ]);
    for (const f of INTENTIONAL_PARTIAL.keys()) {
      expect(all.has(f), `${f} dans la liste d'exceptions n'existe plus`).toBe(
        true,
      );
    }
  });

  it("chaque exception porte une justification", () => {
    for (const [file, reason] of INTENTIONAL_PARTIAL) {
      expect(reason.length, `${file} sans justification`).toBeGreaterThan(20);
    }
  });
});
