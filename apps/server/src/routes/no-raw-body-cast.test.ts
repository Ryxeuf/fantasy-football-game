/**
 * Garde anti-regression — change `harden-request-validation` (Brique 3).
 *
 * Invariant : un handler de route NE DOIT PAS recaster `req.body` via un
 * type litteral (`req.body as { ... }`). Le type lu doit etre derive du
 * schema Zod de la route (`const body: z.infer<typeof schema> = req.body`),
 * pour que toute divergence schema/handler echoue a la compilation.
 *
 * Strategie "ratchet" : tout fichier de `routes/` est enforce PAR DEFAUT.
 * Les fichiers pas encore migres (tache 3.4) sont listes dans
 * `LEGACY_NOT_MIGRATED` ; cette liste ne doit que DECROITRE. Un nouveau
 * fichier de route (absent de la liste) doit donc etre clean d'emblee.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROUTES_DIR = __dirname;

/** Cast brut de req.body : `req.body as`, `(req.body ?? {}) as`, etc. */
const RAW_BODY_CAST = /\breq\.body\s*(?:\?\?\s*\{\}\s*\))?\s*as\b/;

/**
 * Fichiers de route contenant encore au moins un cast brut `req.body as`
 * (Bucket B non migre). NE DOIT QUE DECROITRE.
 *
 * ✅ Migration terminee : la liste est VIDE — tout fichier de route est
 * desormais enforce (zero `req.body as`). Tout nouveau cast brut fera
 * echouer ce test ; le pattern attendu est `const x: z.infer<typeof s> =
 * req.body` (ou un type derive du schema).
 */
const LEGACY_NOT_MIGRATED = new Set<string>([]);

function listRouteFiles(): string[] {
  return readdirSync(ROUTES_DIR).filter(
    (f) => f.endsWith(".ts") && !f.endsWith(".test.ts"),
  );
}

function rawBodyCastLines(file: string): string[] {
  const content = readFileSync(join(ROUTES_DIR, file), "utf8");
  return content
    .split("\n")
    .map((line, i) => `${i + 1}: ${line.trim()}`)
    .filter((line) => RAW_BODY_CAST.test(line));
}

describe("routes — garde anti cast brut req.body (harden-request-validation)", () => {
  const files = listRouteFiles();

  for (const file of files) {
    if (LEGACY_NOT_MIGRATED.has(file)) continue;
    it(`${file} — pas de cast brut req.body as (utilise z.infer)`, () => {
      expect(rawBodyCastLines(file)).toEqual([]);
    });
  }

  it("la denylist ne reference que des fichiers existants", () => {
    for (const f of LEGACY_NOT_MIGRATED) {
      expect(files.includes(f), `${f} dans la denylist n'existe plus`).toBe(
        true,
      );
    }
  });

  it("la denylist ne contient pas de fichier deja migre (ratchet)", () => {
    // Un fichier liste DOIT encore contenir un cast brut. Sinon il est
    // migre : le retirer de LEGACY_NOT_MIGRATED.
    for (const f of LEGACY_NOT_MIGRATED) {
      expect(
        rawBodyCastLines(f).length,
        `${f} n'a plus de cast brut → retire-le de LEGACY_NOT_MIGRATED`,
      ).toBeGreaterThan(0);
    }
  });
});
