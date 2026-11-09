/**
 * Audit de cohérence : descriptions de compétences SERVIES en Saison 3 ↔
 * transcription du livre Blood Bowl 2025.
 *
 * Pour chaque compétence/trait de `docs/reference/extraction_competences*.md`
 * (titres `## Nom (Type)`), on retrouve la description Saison 3 que le seed
 * écrit en base — même précédence que `seed.ts` : surcharge
 * `SEASON_3_SKILL_DESCRIPTIONS`, sinon `STATIC_SKILLS_DATA` (par nom
 * anglais), sinon le canon du moteur — et on compare les jetons chiffrés
 * qui portent la RÈGLE : modificateurs (+N / -N), seuils (N+),
 * caractéristiques citées (« Force de 4 ») et limites d'usage (« une fois
 * par Tour / activation / match… »).
 *
 * Ce n'est pas une comparaison de texte : le référentiel peut reformuler,
 * mais pas changer un chiffre. Né du cas Esquive en Force, qui servait le
 * texte 2020 (+1 / +2, une fois par activation) en Saison 3.
 *
 * Les exceptions sont des faux positifs JUSTIFIÉS (transcription tronquée,
 * chiffre d'exemple du livre…), jamais une divergence de règle.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { SKILLS_DEFINITIONS } from "../../../packages/game-engine/src/skills/index";
import { STATIC_SKILLS_DATA } from "./static-skills-data";
import {
  SEASON_3_RENAMED_SKILLS,
  SEASON_3_SKILL_DESCRIPTIONS,
} from "./static-skills-data-s3";

const REFERENCE_FILES = [
  "extraction_competences_blood_bowl.md",
  "extraction_competences_traits_blood_bowl.md",
];
const REFERENCE_DIR = join(__dirname, "../../../docs/reference");

interface ReferenceEntry {
  readonly name: string;
  readonly body: string;
}

/** `## Nom (Type)` : le type est la DERNIÈRE parenthèse du titre. */
const ENTRY_TITLE = /^##\s+(.+?)\s*\((?:Actif|Active|Passif|Passive)\)\s*$/;

function parseReference(markdown: string): ReferenceEntry[] {
  const entries: ReferenceEntry[] = [];
  let current: { name: string; lines: string[] } | null = null;
  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith("#")) {
      if (current) {
        entries.push({ name: current.name, body: current.lines.join("\n") });
      }
      const m = ENTRY_TITLE.exec(line);
      current = m ? { name: m[1], lines: [] } : null;
      continue;
    }
    current?.lines.push(line);
  }
  if (current) entries.push({ name: current.name, body: current.lines.join("\n") });
  return entries;
}

/**
 * Nom comparable : sans astérisque ni parenthèse (« (X) », « (+1) »), casse,
 * accents et ponctuation ignorés (« Timmm-Ber ! » = « Timmm-ber!* »).
 */
function normalizeName(name: string): string {
  return name
    .replace(/\([^)]*\)/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase();
}

/**
 * Nom FR → slug. Plusieurs slugs pour un nom (Joueur Déloyal +1 / +2) :
 * tous sont audités contre la même entrée du livre.
 */
function slugsByFrenchName(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const add = (name: string | undefined, slug: string) => {
    if (!name) return;
    const key = normalizeName(name);
    const list = map.get(key) ?? [];
    if (!list.includes(slug)) list.push(slug);
    map.set(key, list);
  };
  for (const def of SKILLS_DEFINITIONS) {
    add(def.nameFr, def.slug);
    add(STATIC_SKILLS_DATA[def.nameEn]?.nameFr, def.slug);
    add(SEASON_3_RENAMED_SKILLS[def.slug]?.nameFr, def.slug);
  }
  return map;
}

/** Description FR servie en Saison 3 (précédence de `seed.ts`). */
function servedSeason3Description(slug: string): string {
  const def = SKILLS_DEFINITIONS.find((s) => s.slug === slug);
  const override = SEASON_3_SKILL_DESCRIPTIONS[slug];
  if (override) return override.description;
  const staticData = def ? STATIC_SKILLS_DATA[def.nameEn] : undefined;
  return staticData?.description || def?.description || "";
}

/** Jetons chiffrés qui portent la règle. */
function ruleTokens(text: string): Set<string> {
  const t = text
    .replace(/[−–]/g, "-")
    .replace(/[’]/g, "'")
    .normalize("NFC");
  const tokens = new Set<string>();
  // Modificateurs : « +1 », « -2 » (pas une plage « 1-2 », pas « D6+1 »).
  for (const m of t.matchAll(/(?<![\w\d])([+-])\s?(\d+)(?!\s*\+)(?![\d])/g)) {
    tokens.add(`mod:${m[1]}${m[2]}`);
  }
  // Seuils : « 2+ », « (4+) ».
  for (const m of t.matchAll(/(?<![\w\d+-])(\d+)\+/g)) {
    tokens.add(`seuil:${m[1]}+`);
  }
  // Caractéristiques citées : « Force de 4 », « Caractéristique de Force
  // de 3 ou moins ».
  for (const m of t.matchAll(
    /\b(Force|Agilité|Mouvement|Armure|Capacité de Passe)\s+(?:est\s+)?(?:de|à)\s+(\d+)/gi,
  )) {
    tokens.add(`carac:${m[1].toLowerCase()}=${m[2]}`);
  }
  // Limites d'usage.
  for (const m of t.matchAll(
    /une fois (?:par|pendant (?:son|chaque|la|le)) (tour|activation|match|mi-temps|phase|action|drive)/gi,
  )) {
    tokens.add(`limite:${m[1].toLowerCase()}`);
  }
  return tokens;
}

/**
 * Faux positifs justifiés : jetons à ignorer pour un slug, de part
 * (`reference`) ou d'autre (`served`). Jamais une divergence de règle.
 */
const EXCEPTIONS: Record<
  string,
  { reference?: readonly string[]; served?: readonly string[]; why: string }
> = {
  "mighty-blow-2": {
    reference: ["mod:+1"],
    why: "Variante (+2) des fiches de Star Players : le livre ne décrit que Châtaigne (+1), auditée sous mighty-blow-1.",
  },
  "dirty-player-2": {
    reference: ["mod:+1"],
    why: "Variante (+2) des fiches de Star Players : le livre ne décrit que Joueur Déloyal (+1), audité sous dirty-player-1.",
  },
};

interface Divergence {
  readonly name: string;
  readonly slug: string;
  readonly missing: string[];
  readonly extra: string[];
}

interface AuditResult {
  readonly divergences: Divergence[];
  readonly unmatched: string[];
  /** Slugs confrontés à une entrée du livre. */
  readonly audited: ReadonlySet<string>;
  /** Exceptions qui ont effectivement écarté un jeton. */
  readonly usedExceptions: ReadonlySet<string>;
}

function audit(): AuditResult {
  const bySlug = slugsByFrenchName();
  const divergences: Divergence[] = [];
  const unmatched: string[] = [];
  const audited = new Set<string>();
  const usedExceptions = new Set<string>();
  for (const file of REFERENCE_FILES) {
    const md = readFileSync(join(REFERENCE_DIR, file), "utf8");
    for (const entry of parseReference(md)) {
      const slugs = bySlug.get(normalizeName(entry.name));
      if (!slugs) {
        unmatched.push(entry.name);
        continue;
      }
      const reference = ruleTokens(entry.body);
      for (const slug of slugs) {
        audited.add(slug);
        const served = ruleTokens(servedSeason3Description(slug));
        const ex = EXCEPTIONS[slug];
        const excused = (list: readonly string[] | undefined, tok: string) => {
          const hit = list?.includes(tok) ?? false;
          if (hit) usedExceptions.add(slug);
          return hit;
        };
        const missing = [...reference].filter(
          (tok) => !served.has(tok) && !excused(ex?.reference, tok),
        );
        const extra = [...served].filter(
          (tok) => !reference.has(tok) && !excused(ex?.served, tok),
        );
        if (missing.length > 0 || extra.length > 0) {
          divergences.push({ name: entry.name, slug, missing, extra });
        }
      }
    }
  }
  return { divergences, unmatched, audited, usedExceptions };
}

describe("ruleTokens", () => {
  it("lit modificateurs, seuils, caractéristiques et limites d'usage", () => {
    expect([
      ...ruleTokens(
        "Une fois par Tour, +1 s'il a une Caractéristique de Force de 3 ou moins ; sur 2+, −2 au jet. Sur 1-2, rien.",
      ),
    ].sort()).toEqual(
      ["carac:force=3", "limite:tour", "mod:+1", "mod:-2", "seuil:2+"].sort(),
    );
  });

  it("ne lit ni une plage (1-2) ni un dé (D6) comme un modificateur", () => {
    expect([...ruleTokens("Sur 1-2, jetez un D6.")]).toEqual([]);
  });
});

describe("Audit — descriptions S3 servies ↔ livre 2025 (jetons chiffrés)", () => {
  const { divergences, unmatched, audited, usedExceptions } = audit();

  it("chaque entrée du livre retrouve une compétence du référentiel", () => {
    expect(unmatched).toEqual([]);
    // Garde-fou : l'analyse du livre ne s'est pas vidée en silence.
    expect(audited.size).toBeGreaterThan(70);
  });

  it("aucune divergence de chiffre, de seuil ou de limite d'usage", () => {
    expect(divergences).toEqual([]);
  });

  it("Esquive en Force sert bien le texte 2025", () => {
    expect(audited.has("break-tackle")).toBe(true);
    expect([...ruleTokens(servedSeason3Description("break-tackle"))].sort()).toEqual(
      [
        "carac:force=3",
        "carac:force=4",
        "carac:force=5",
        "limite:tour",
        "mod:+1",
        "mod:+2",
        "mod:+3",
      ].sort(),
    );
  });

  it("chaque exception est justifiée, vise un slug audité et sert encore", () => {
    for (const [slug, ex] of Object.entries(EXCEPTIONS)) {
      expect(ex.why.length).toBeGreaterThan(20);
      expect(audited.has(slug)).toBe(true);
      expect(usedExceptions.has(slug)).toBe(true);
    }
  });
});
