/**
 * Générateur de `packages/game-engine/src/rosters/skill-access-season3.ts`.
 *
 * Lit le fichier unique `data/positionnels-bloodbowl-2025.md` (une section
 * `## <Équipe>` par roster, chacune contenant une table de positionnels avec
 * les colonnes Primaire / Secondaire), normalise la notation officielle FR
 * (BB2025) vers les codes canoniques, aligne chaque ligne au slug de position
 * correspondant dans season3-rosters.ts (matching roster par nom + alignement
 * par ordre intra-roster), applique les corrections de l'errata de mai 2026,
 * et émet le map TS.
 *
 * Notation source (officielle FR) → codes canoniques :
 *   G→G, A→A, F→S (Force/Strength), P→P, M→M, S→K (Sournoiserie/Scélérates).
 * ⚠️ Dans la source, `S` = Sournoiserie et `F` = Force. En interne, `S` = Force
 *    et `K` = Sournoiserie — d'où la conversion `F→S` ET `S→K` ci-dessous.
 *
 * Usage :
 *   tsx scripts/generate-skill-access-season3.ts          # rapport (dry-run)
 *   tsx scripts/generate-skill-access-season3.ts --write  # écrit le fichier
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { TEAM_ROSTERS_BY_RULESET } from "../packages/game-engine/src/rosters/positions";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MD_FILE = path.join(ROOT, "data/positionnels-bloodbowl-2025.md");
const OUT_FILE = path.join(
  ROOT,
  "packages/game-engine/src/rosters/skill-access-season3.ts",
);

const WRITE = process.argv.includes("--write");

/** Ordre canonique des codes catégorie. */
const CODE_ORDER = ["G", "A", "S", "P", "M", "K"];

/** Normalise un nom pour matcher titre de section ↔ roster.name. */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Normalise une cellule d'accès (notation source FR) -> CSV de codes canoniques.
 * `F`→`S` (Force), `S`→`K` (Sournoiserie), `G/A/P/M` identité. Dédoublonne et
 * réordonne selon CODE_ORDER.
 */
function normalizeAccessCell(cell: string): string {
  const seen = new Set<string>();
  for (const ch of cell.toUpperCase()) {
    let code: string | null = null;
    if (ch === "F") code = "S"; // Force → Strength
    else if (ch === "S") code = "K"; // Sournoiserie → Scélérates
    else if ("GAPM".includes(ch)) code = ch;
    if (code) seen.add(code);
  }
  return CODE_ORDER.filter((c) => seen.has(c)).join(",");
}

interface MdRow {
  displayName: string;
  primary: string;
  secondary: string;
}

/**
 * Parse le fichier unique en sections `## <Équipe>` -> lignes positionnelles.
 * Chaque table a la structure :
 *   | Qte | Position | M | F | AG | CP | AR | Compétences | Primaire | Secondaire | Coût |
 * cells (après split sur `|`) : [_, Qte, Position, M, F, AG, CP, AR,
 *   Compétences, Primaire, Secondaire, Coût, _] → Primaire=cells[9],
 *   Secondaire=cells[10].
 */
function parseSections(content: string): Map<string, MdRow[]> {
  const sections = new Map<string, MdRow[]>();
  let current: MdRow[] | null = null;
  for (const line of content.split("\n")) {
    // Titre de section d'équipe : `## ...` (pas le H1 `# ...`).
    if (line.startsWith("## ")) {
      const title = line.replace(/^##\s*/, "").trim();
      current = [];
      sections.set(title, current);
      continue;
    }
    if (line.startsWith("# ")) {
      current = null; // H1 doc : hors section équipe
      continue;
    }
    if (!current) continue;
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 12) continue;
    const position = cells[2];
    if (position === "Position" || position.startsWith("-")) continue; // header/sep
    if (!position.includes("(")) continue; // ligne positionnelle = "Nom (Race, Type)"
    current.push({
      displayName: position,
      primary: normalizeAccessCell(cells[9]),
      secondary: normalizeAccessCell(cells[10]),
    });
  }
  return sections;
}

// --- Corrections errata mai 2026 (Designer's Commentary) ---
// Appliquées par slug de position APRÈS l'import (source S3 2025 antérieure).
// add/remove portent sur les codes catégorie d'un pool.
interface ErrataOp {
  primaryAdd?: string[];
  primaryRemove?: string[];
  secondaryAdd?: string[];
  secondaryRemove?: string[];
  note: string;
}
const ERRATA: Record<string, ErrataOp> = {
  // p.167 — Dwarf Teams – Dwarf Runner : ajoute Agilité (A) en secondaire.
  // Source S3 2025 : secondaire = [S] uniquement -> devient [A,S].
  dwarf_coureur_nain: {
    secondaryAdd: ["A"],
    note: "Errata mai 2026 : +Agilité (A) en secondaire (Coureur Nain).",
  },
  // pp.172/173/180 — Human / Imperial Nobility / Old World Alliance – Ogre :
  // retire Mutation (M) du secondaire. Déjà absent dans la source S3 → no-op,
  // override explicite pour tracer l'errata et résister à une dérive source.
  human_ogre: {
    secondaryRemove: ["M"],
    note: "Errata mai 2026 : -Mutation (M) en secondaire (Ogre).",
  },
  imperial_nobility_ogre: {
    secondaryRemove: ["M"],
    note: "Errata mai 2026 : -Mutation (M) en secondaire (Ogre).",
  },
  old_world_alliance_ogre: {
    secondaryRemove: ["M"],
    note: "Errata mai 2026 : -Mutation (M) en secondaire (Ogre).",
  },
};

function applyErrata(
  slug: string,
  access: { primary: string; secondary: string },
): { primary: string; secondary: string } {
  const op = ERRATA[slug];
  if (!op) return access;
  const toSet = (csv: string) => new Set(csv.split(",").filter(Boolean));
  const pri = toSet(access.primary);
  const sec = toSet(access.secondary);
  op.primaryAdd?.forEach((c) => pri.add(c));
  op.primaryRemove?.forEach((c) => pri.delete(c));
  op.secondaryAdd?.forEach((c) => sec.add(c));
  op.secondaryRemove?.forEach((c) => sec.delete(c));
  const order = (s: Set<string>) => CODE_ORDER.filter((c) => s.has(c)).join(",");
  return { primary: order(pri), secondary: order(sec) };
}

// --- Main ---
const season3 = TEAM_ROSTERS_BY_RULESET.season_3;
const rosterByNorm = new Map<string, { key: string; name: string }>();
for (const [key, def] of Object.entries(season3)) {
  rosterByNorm.set(norm(def.name), { key, name: def.name });
}

const content = fs.readFileSync(MD_FILE, "utf8");
const sections = parseSections(content);
const accessMap: Record<string, { primary: string; secondary: string }> = {};
const report: string[] = [];
const unmatchedSections: string[] = [];
const mismatched: string[] = [];

for (const [title, rows] of sections) {
  // Match roster : par titre normalisé, sinon trim 's' final.
  let matched =
    rosterByNorm.get(norm(title)) ?? rosterByNorm.get(norm(title).replace(/s$/, ""));
  if (!matched) {
    unmatchedSections.push(`"${title}"`);
    continue;
  }
  const rosterDef = season3[matched.key];
  const positions = rosterDef.positions;
  if (positions.length !== rows.length) {
    mismatched.push(
      `${matched.key}: ${rows.length} lignes .md vs ${positions.length} positions`,
    );
  }
  const n = Math.min(positions.length, rows.length);
  for (let i = 0; i < n; i++) {
    const pos = positions[i];
    const base = { primary: rows[i].primary, secondary: rows[i].secondary };
    accessMap[pos.slug] = applyErrata(pos.slug, base);
  }
  report.push(
    `${matched.key.padEnd(22)} ${String(n).padStart(2)} pos  ("${title}")`,
  );
}

// --- Sortie ---
console.log("=== Rosters mappés ===");
report.sort().forEach((r) => console.log("  " + r));
console.log(`\nSections .md: ${sections.size}`);
console.log(`Positions mappées: ${Object.keys(accessMap).length}`);
if (unmatchedSections.length) {
  console.log("\n=== Sections .md NON matchées (ignorées) ===");
  unmatchedSections.forEach((f) => console.log("  " + f));
}
if (mismatched.length) {
  console.log("\n=== ⚠️  Désalignements de comptage (à vérifier) ===");
  mismatched.forEach((m) => console.log("  " + m));
}

// Aperçu : positions avec accès Sournoiserie (K)
console.log("\n=== Aperçu (positions avec Sournoiserie K) ===");
let kCount = 0;
for (const slug of Object.keys(accessMap).sort()) {
  const a = accessMap[slug];
  if (a.primary.includes("K") || a.secondary.includes("K")) {
    kCount++;
    if (kCount <= 12) {
      console.log(`  ${slug.padEnd(38)} P=[${a.primary}] S=[${a.secondary}]`);
    }
  }
}
console.log(`  ... total positions avec K: ${kCount}`);

if (WRITE) {
  const entries = Object.keys(accessMap)
    .sort()
    .map(
      (slug) =>
        `  "${slug}": { primary: "${accessMap[slug].primary}", secondary: "${accessMap[slug].secondary}" },`,
    )
    .join("\n");
  const header = `/**
 * Accès compétences Primaire/Secondaire par position — BB Season 3.
 *
 * ⚠️ FICHIER GÉNÉRÉ par scripts/generate-skill-access-season3.ts — NE PAS
 * éditer à la main. Source : data/positionnels-bloodbowl-2025.md (colonnes
 * Primaire/Secondaire), notation officielle FR convertie en codes canoniques
 * (F→S Force, S→K Sournoiserie) et corrigée de l'errata de mai 2026.
 * Pour régénérer : tsx scripts/generate-skill-access-season3.ts --write
 *
 * Format : slug position -> { primary, secondary } en CSV de codes
 * G/A/S/P/M/K (S=Force, K=Sournoiserie).
 * "" = pool vide renseigné (positions animales sans accès primaire).
 */

export interface PositionSkillAccessS3 {
  readonly primary: string;
  readonly secondary: string;
}

export const SKILL_ACCESS_SEASON3: Record<string, PositionSkillAccessS3> = {
${entries}
};
`;
  fs.writeFileSync(OUT_FILE, header, "utf8");
  console.log(`\n✅ Écrit: ${path.relative(ROOT, OUT_FILE)}`);
} else {
  console.log("\n(dry-run — relancer avec --write pour générer le fichier)");
}
