/**
 * Générateur de `packages/game-engine/src/rosters/skill-access-season3.ts`.
 *
 * Lit les tables « Positionnels » de `data/saison3/team/*.md` (colonnes
 * Primaire / Secondaire), normalise la notation (F→S, dédoublonnage), aligne
 * chaque ligne au slug de position correspondant dans season3-rosters.ts
 * (matching roster par nom + alignement par ordre intra-roster), applique les
 * corrections de l'errata de mai 2026, et émet le map TS.
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
const MD_DIR = path.join(ROOT, "data/saison3/team");
const OUT_FILE = path.join(
  ROOT,
  "packages/game-engine/src/rosters/skill-access-season3.ts",
);

const WRITE = process.argv.includes("--write");

/** Normalise un nom pour matcher fichier/titre ↔ roster.name. */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Normalise une cellule d'accès -> CSV de codes canoniques (F→S, dédup). */
function normalizeAccessCell(cell: string): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ch of cell.toUpperCase()) {
    let code: string | null = null;
    if (ch === "F") code = "S";
    else if ("GASPM".includes(ch)) code = ch;
    if (code && !seen.has(code)) {
      seen.add(code);
      out.push(code);
    }
  }
  return out.join(",");
}

interface MdRow {
  displayName: string;
  primary: string;
  secondary: string;
}

/** Parse les lignes positionnelles d'un .md. Retourne titre + lignes. */
function parseMd(content: string): { title: string; rows: MdRow[] } {
  const lines = content.split("\n");
  const title = (lines.find((l) => l.startsWith("# ")) ?? "").replace(/^#\s*/, "").trim();
  const rows: MdRow[] = [];
  let inPositionnels = false;
  for (const line of lines) {
    if (line.startsWith("## ")) {
      inPositionnels = norm(line).includes("positionnels");
      continue;
    }
    if (!inPositionnels) continue;
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    // cells[0]='' (avant 1er |). Structure: [_, Qte, Position, M, F, AG, CP, AR, Compétences, Primaire, Secondaire, Coût, _]
    if (cells.length < 12) continue;
    const position = cells[2];
    if (position === "Position" || position.startsWith("-")) continue; // header / séparateur
    if (!position.includes("(")) continue; // ligne positionnelle = "Nom *(Race, Type)*"
    rows.push({
      displayName: position,
      primary: normalizeAccessCell(cells[9]),
      secondary: normalizeAccessCell(cells[10]),
    });
  }
  return { title, rows };
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
  const order = (s: Set<string>) =>
    ["G", "A", "S", "P", "M"].filter((c) => s.has(c)).join(",");
  return { primary: order(pri), secondary: order(sec) };
}

// --- Main ---
const season3 = TEAM_ROSTERS_BY_RULESET.season_3;
const rosterByNorm = new Map<string, { key: string; name: string }>();
for (const [key, def] of Object.entries(season3)) {
  rosterByNorm.set(norm(def.name), { key, name: def.name });
}

const files = fs.readdirSync(MD_DIR).filter((f) => f.endsWith(".md"));
const accessMap: Record<string, { primary: string; secondary: string }> = {};
const report: string[] = [];
const unmatchedFiles: string[] = [];
const mismatched: string[] = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(MD_DIR, file), "utf8");
  const { title, rows } = parseMd(content);
  // Match roster : par titre, sinon par nom de fichier, + trim 's' final.
  const candidates = [norm(title), norm(file.replace(/\.md$/, ""))];
  let matched = candidates.map((c) => rosterByNorm.get(c)).find(Boolean);
  if (!matched) {
    matched = candidates
      .map((c) => rosterByNorm.get(c.replace(/s$/, "")))
      .find(Boolean);
  }
  if (!matched) {
    unmatchedFiles.push(`${file} (titre="${title}")`);
    continue;
  }
  const rosterDef = season3[matched.key];
  const positions = rosterDef.positions;
  if (positions.length !== rows.length) {
    mismatched.push(
      `${file} -> ${matched.key}: ${rows.length} lignes .md vs ${positions.length} positions`,
    );
  }
  const n = Math.min(positions.length, rows.length);
  for (let i = 0; i < n; i++) {
    const pos = positions[i];
    const base = { primary: rows[i].primary, secondary: rows[i].secondary };
    accessMap[pos.slug] = applyErrata(pos.slug, base);
  }
  report.push(
    `${matched.key.padEnd(22)} ${String(n).padStart(2)} pos  (${file})`,
  );
}

// --- Sortie ---
console.log("=== Rosters mappés ===");
report.sort().forEach((r) => console.log("  " + r));
console.log(`\nPositions mappées: ${Object.keys(accessMap).length}`);
if (unmatchedFiles.length) {
  console.log("\n=== Fichiers .md NON matchés (ignorés) ===");
  unmatchedFiles.forEach((f) => console.log("  " + f));
}
if (mismatched.length) {
  console.log("\n=== ⚠️  Désalignements de comptage (à vérifier) ===");
  mismatched.forEach((m) => console.log("  " + m));
}

// Aperçu errata-relevant
console.log("\n=== Aperçu (slugs errata) ===");
for (const slug of Object.keys(accessMap)) {
  if (/runner|ogre/i.test(slug)) {
    const a = accessMap[slug];
    console.log(`  ${slug.padEnd(34)} P=[${a.primary}] S=[${a.secondary}]`);
  }
}

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
 * éditer à la main. Source : data/saison3/team/*.md (colonnes Primaire/
 * Secondaire), normalisée (F→S) et corrigée de l'errata de mai 2026.
 * Pour régénérer : tsx scripts/generate-skill-access-season3.ts --write
 *
 * Format : slug position -> { primary, secondary } en CSV de codes G/A/S/P/M.
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
