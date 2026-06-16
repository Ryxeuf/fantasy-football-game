/**
 * Générateur de `packages/game-engine/src/rosters/keywords-season3.ts`.
 *
 * Lit le fichier unique `data/positionnels-bloodbowl-2025.md` (une section
 * `## <Équipe>` par roster). Chaque ligne positionnelle a la forme
 * `Nom (Mot-clé1, Mot-clé2, …)` dans la colonne Position — la parenthèse
 * contient les **mots-clés** officiels BB2025 (lignée/race + type de joueur,
 * ex: `Elfe, Trois-quart`). On extrait cette parenthèse, on aligne chaque ligne
 * au slug de position correspondant dans season3-rosters.ts (matching roster
 * par nom + alignement par ordre intra-roster, identique à
 * generate-skill-access-season3.ts), et on émet le map TS.
 *
 * Usage :
 *   tsx scripts/generate-keywords-season3.ts          # rapport (dry-run)
 *   tsx scripts/generate-keywords-season3.ts --write  # écrit le fichier
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
  "packages/game-engine/src/rosters/keywords-season3.ts",
);

const WRITE = process.argv.includes("--write");

/** Normalise un nom pour matcher titre de section ↔ roster.name. */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Extrait les mots-clés d'une cellule Position `Nom (kw1, kw2, …)`.
 * Renvoie une chaîne CSV normalisée `"kw1, kw2"` (trim + espace après virgule),
 * ou `""` si pas de parenthèse. Gère un `*` éventuel avant la parenthèse
 * (annotation source, ex: `Homme-arbre * (Homme-Arbre, Gros Bras)`).
 */
function extractKeywords(positionCell: string): string {
  const m = positionCell.match(/\(([^)]*)\)/);
  if (!m) return "";
  return m[1]
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .join(", ");
}

interface MdRow {
  keywords: string;
}

/**
 * Parse le fichier en sections `## <Équipe>` -> lignes positionnelles.
 * Table : | Qte | Position | M | F | AG | CP | AR | Compétences | Primaire |
 * Secondaire | Coût | → Position = cells[2].
 */
function parseSections(content: string): Map<string, MdRow[]> {
  const sections = new Map<string, MdRow[]>();
  let current: MdRow[] | null = null;
  for (const line of content.split("\n")) {
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
    current.push({ keywords: extractKeywords(position) });
  }
  return sections;
}

// --- Main ---
const season3 = TEAM_ROSTERS_BY_RULESET.season_3;
const rosterByNorm = new Map<string, { key: string; name: string }>();
for (const [key, def] of Object.entries(season3)) {
  rosterByNorm.set(norm(def.name), { key, name: def.name });
}

const content = fs.readFileSync(MD_FILE, "utf8");
const sections = parseSections(content);
const keywordsMap: Record<string, string> = {};
const report: string[] = [];
const unmatchedSections: string[] = [];
const mismatched: string[] = [];

for (const [title, rows] of sections) {
  let matched =
    rosterByNorm.get(norm(title)) ??
    rosterByNorm.get(norm(title).replace(/s$/, ""));
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
    keywordsMap[positions[i].slug] = rows[i].keywords;
  }
  report.push(
    `${matched.key.padEnd(22)} ${String(n).padStart(2)} pos  ("${title}")`,
  );
}

// --- Sortie ---
console.log("=== Rosters mappés ===");
report.sort().forEach((r) => console.log("  " + r));
console.log(`\nSections .md: ${sections.size}`);
console.log(`Positions mappées: ${Object.keys(keywordsMap).length}`);
if (unmatchedSections.length) {
  console.log("\n=== Sections .md NON matchées (ignorées) ===");
  unmatchedSections.forEach((f) => console.log("  " + f));
}
if (mismatched.length) {
  console.log("\n=== ⚠️  Désalignements de comptage (à vérifier) ===");
  mismatched.forEach((m) => console.log("  " + m));
}

console.log("\n=== Aperçu (10 premières) ===");
Object.keys(keywordsMap)
  .sort()
  .slice(0, 10)
  .forEach((slug) => console.log(`  ${slug.padEnd(38)} [${keywordsMap[slug]}]`));

if (WRITE) {
  const entries = Object.keys(keywordsMap)
    .sort()
    .map((slug) => `  "${slug}": "${keywordsMap[slug]}",`)
    .join("\n");
  const header = `/**
 * Mots-clés par position — BB Season 3.
 *
 * ⚠️ FICHIER GÉNÉRÉ par scripts/generate-keywords-season3.ts — NE PAS éditer à
 * la main. Source : data/positionnels-bloodbowl-2025.md (parenthèse de la
 * colonne Position, ex: "Elfe, Trois-quart"). Les mots-clés officiels BB2025
 * décrivent la lignée/race et le type de joueur d'une position.
 * Pour régénérer : tsx scripts/generate-keywords-season3.ts --write
 *
 * Format : slug position -> CSV de mots-clés ("Race, Type").
 */

export const KEYWORDS_SEASON3: Record<string, string> = {
${entries}
};
`;
  fs.writeFileSync(OUT_FILE, header, "utf8");
  console.log(`\n✅ Écrit: ${path.relative(ROOT, OUT_FILE)}`);
} else {
  console.log("\n(dry-run — relancer avec --write pour générer le fichier)");
}
