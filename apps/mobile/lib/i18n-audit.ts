/**
 * S27.3.10 — Audit i18n mobile.
 *
 * Helpers purs (pas d'I/O) pour detecter les chaines FR hardcodees
 * restantes dans le source mobile. Le CLI `scripts/audit-i18n.ts`
 * applique ces helpers a tous les fichiers `.tsx`/`.ts` de `apps/mobile`
 * et imprime un rapport.
 *
 * Heuristique :
 *  - une string litterale est consideree FR si elle contient un
 *    caractere accentue (a, e, e, i, o, u, c, ...) OU un mot-cle FR
 *    courant (Profil, Erreur, Annuler, ...) ;
 *  - on ignore les chaines deja passees a `t(...)`, les chemins
 *    d'import/export, et les commentaires simples / JSDoc.
 *
 * Pas un parser TypeScript : c'est une heuristique regex volontairement
 * simple. Les rares faux positifs sont a fixer cas par cas (ajouter le
 * fichier en exception, ou migrer la chaine vers `t()`).
 */

const FRENCH_ACCENTS = /[À-ÿ]/;

const FRENCH_KEYWORDS: readonly string[] = [
  "Profil",
  "Erreur",
  "Annuler",
  "Supprimer",
  "Veuillez",
  "Connexion",
  "Deconnexion",
  "Inscription",
  "Mot de passe",
  "Equipe",
  "Joueur",
  "Match",
  "Tour",
  "Defaite",
  "Victoire",
  "Bienvenue",
  "Chargement",
  "Reessayer",
  "Retour",
  "Confirmer",
  "Enregistrer",
  "Modifier",
];

export type AuditReason = "accents" | "keyword";

export interface AuditFinding {
  readonly file: string;
  readonly line: number;
  readonly text: string;
  readonly reason: AuditReason;
}

export interface FileAudit {
  readonly file: string;
  readonly findings: readonly AuditFinding[];
}

export interface AuditSummary {
  readonly totalFiles: number;
  readonly totalFindings: number;
  readonly perFile: ReadonlyArray<{ readonly file: string; readonly count: number }>;
}

const STRING_LITERAL = /(['"])((?:\\.|(?!\1).)*?)\1/g;

function classify(text: string): AuditReason | null {
  if (FRENCH_ACCENTS.test(text)) return "accents";
  if (FRENCH_KEYWORDS.some((k) => text.includes(k))) return "keyword";
  return null;
}

function isImportOrPath(line: string): boolean {
  const trimmed = line.trimStart();
  return (
    trimmed.startsWith("import ") ||
    trimmed.startsWith("import(") ||
    trimmed.startsWith("export ") ||
    trimmed.startsWith("require(") ||
    /\bfrom\s+(['"])/.test(trimmed)
  );
}

function isCommentLine(line: string, col: number): boolean {
  const slashIdx = line.indexOf("//");
  if (slashIdx >= 0 && slashIdx < col) return true;
  const t = line.trimStart();
  if (t.startsWith("*") || t.startsWith("/*")) return true;
  return false;
}

function isInsideTCall(content: string, startIdx: number): boolean {
  // Walk backwards from the start of the literal looking for `(`. Only
  // whitespace allowed between the literal and the `(`. The `(` must be
  // preceded (after any whitespace) by an identifier `t` (word boundary
  // before).
  let i = startIdx - 1;
  while (i >= 0) {
    const ch = content[i];
    if (ch === "\n") return false;
    if (ch === "(") {
      let j = i - 1;
      while (j >= 0 && (content[j] === " " || content[j] === "\t")) j--;
      if (j >= 0 && content[j] === "t") {
        const before = j > 0 ? content[j - 1] : "";
        if (!/[A-Za-z0-9_$]/.test(before)) return true;
      }
      return false;
    }
    if (ch !== " " && ch !== "\t") return false;
    i--;
  }
  return false;
}

function buildLineOffsets(content: string): number[] {
  const offsets: number[] = [0];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === "\n") offsets.push(i + 1);
  }
  return offsets;
}

function locate(offsets: number[], idx: number): { line: number; col: number } {
  let lo = 0;
  let hi = offsets.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offsets[mid] <= idx) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, col: idx - offsets[lo] };
}

export function findHardcodedStrings(
  content: string,
  filename: string,
): AuditFinding[] {
  if (content.length === 0) return [];
  const offsets = buildLineOffsets(content);
  const lines = content.split("\n");
  const findings: AuditFinding[] = [];

  STRING_LITERAL.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = STRING_LITERAL.exec(content)) !== null) {
    const text = match[2];
    const reason = classify(text);
    if (!reason) continue;

    const { line, col } = locate(offsets, match.index);
    const lineText = lines[line - 1] ?? "";

    if (isImportOrPath(lineText)) continue;
    if (isCommentLine(lineText, col)) continue;
    if (isInsideTCall(content, match.index)) continue;

    findings.push({ file: filename, line, text, reason });
  }
  return findings;
}

export function summarizeAudits(audits: readonly FileAudit[]): AuditSummary {
  const perFile = audits
    .map((a) => ({ file: a.file, count: a.findings.length }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
  const totalFindings = perFile.reduce((s, f) => s + f.count, 0);
  return {
    totalFiles: perFile.length,
    totalFindings,
    perFile,
  };
}
