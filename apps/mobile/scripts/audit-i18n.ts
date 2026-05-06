/**
 * S27.3.10 — CLI d'audit i18n mobile.
 *
 * Scanne tous les fichiers `.tsx`/`.ts` sous `apps/mobile/app/` et
 * `apps/mobile/components/` et imprime les chaines FR hardcodees
 * restantes. Sortie a deux niveaux :
 *  - resume par fichier (count) trie desc ;
 *  - detail line:col -> texte (limite a 5 par fichier pour rester
 *    lisible, sauf si `--full`).
 *
 * Usage : `pnpm exec tsx apps/mobile/scripts/audit-i18n.ts [--full]`
 *
 * Code retour : 0 si zero finding (DoD S27 atteinte), 1 sinon.
 *
 * Le module `lib/i18n-audit` reste pur (pas d'I/O) et est unit-teste.
 * Ce CLI se contente de lire les fichiers via fs et delegue la
 * detection aux helpers purs.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import {
  findHardcodedStrings,
  summarizeAudits,
  type AuditFinding,
  type FileAudit,
} from "../lib/i18n-audit";

const ROOTS: readonly string[] = ["app", "components"];
const SCAN_EXTS: readonly string[] = [".tsx", ".ts"];
const SKIP_NAMES: readonly string[] = [".test.ts", ".test.tsx", ".d.ts"];

function shouldScan(name: string): boolean {
  if (SKIP_NAMES.some((s) => name.endsWith(s))) return false;
  return SCAN_EXTS.some((e) => name.endsWith(e));
}

function walk(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.startsWith(".") || entry === "node_modules") continue;
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      out.push(...walk(full));
    } else if (shouldScan(entry)) {
      out.push(full);
    }
  }
  return out;
}

function auditAll(repoRoot: string, mobileRoot: string): FileAudit[] {
  const audits: FileAudit[] = [];
  for (const root of ROOTS) {
    const dir = join(mobileRoot, root);
    for (const file of walk(dir)) {
      const content = readFileSync(file, "utf8");
      const rel = relative(repoRoot, file);
      audits.push({ file: rel, findings: findHardcodedStrings(content, rel) });
    }
  }
  return audits;
}

function formatFinding(f: AuditFinding): string {
  const text = f.text.length > 80 ? `${f.text.slice(0, 77)}...` : f.text;
  return `  ${f.file}:${f.line}  [${f.reason}]  "${text}"`;
}

function main(): number {
  const args = process.argv.slice(2);
  const full = args.includes("--full");
  const cwd = process.cwd();
  const mobileRoot = cwd.endsWith("apps/mobile") ? cwd : join(cwd, "apps/mobile");
  const repoRoot = mobileRoot.endsWith("apps/mobile")
    ? mobileRoot.slice(0, -"/apps/mobile".length)
    : cwd;

  const audits = auditAll(repoRoot, mobileRoot);
  const summary = summarizeAudits(audits);

  if (summary.totalFindings === 0) {
    process.stdout.write("[i18n-audit] OK — aucune chaine FR hardcodee trouvee.\n");
    return 0;
  }

  process.stdout.write(
    `[i18n-audit] ${summary.totalFindings} chaine(s) FR hardcodee(s) dans ${summary.totalFiles} fichier(s).\n\n`,
  );
  process.stdout.write("Resume par fichier :\n");
  for (const row of summary.perFile) {
    process.stdout.write(`  ${row.count.toString().padStart(4, " ")}  ${row.file}\n`);
  }
  process.stdout.write("\nDetails :\n");
  for (const audit of audits) {
    if (audit.findings.length === 0) continue;
    const shown = full ? audit.findings : audit.findings.slice(0, 5);
    for (const f of shown) {
      process.stdout.write(`${formatFinding(f)}\n`);
    }
    if (!full && audit.findings.length > 5) {
      process.stdout.write(
        `  ... +${audit.findings.length - 5} autre(s) dans ${audit.file} (utiliser --full pour tout voir)\n`,
      );
    }
  }
  return 1;
}

const exitCode = main();
process.exit(exitCode);
