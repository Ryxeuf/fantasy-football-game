/**
 * Blocklist de texte saisi par les utilisateurs — filet de sécurité, pas un
 * filtre complet. Un texte qui correspond est MASQUÉ automatiquement (visible
 * de son auteur et des modérateurs), jamais refusé : l'auteur comprend
 * pourquoi, le modérateur peut rétablir.
 *
 * Extraite de `pro-gazette-comments` (Q.B.2) pour servir aussi le blog des
 * compétitions ; pure, sans I/O.
 *
 * La détection est insensible à la casse et tolère les séparateurs simples
 * entre les lettres (« f-a-g… »).
 */

const BLOCKLIST_PATTERNS: ReadonlyArray<{ name: string; regex: RegExp }> = [
  { name: "slur-1", regex: /\bn[\W_]*i[\W_]*g[\W_]*g[\W_]*(?:e[\W_]*r|a)\b/i },
  { name: "slur-2", regex: /\bf[\W_]*a[\W_]*g[\W_]*g[\W_]*o[\W_]*t\b/i },
  { name: "slur-3", regex: /\br[\W_]*e[\W_]*t[\W_]*a[\W_]*r[\W_]*d\b/i },
  { name: "slur-4", regex: /\bk[\W_]*i[\W_]*k[\W_]*e\b/i },
  // Variantes phonetiques francaises courantes
  { name: "slur-fr-1", regex: /\bsa[\W_]*l[\W_]*o[\W_]*p[\W_]*e\b/i },
];

/** Nom du motif reconnu, ou `null` si le texte passe. */
export function detectBlocklist(body: string): string | null {
  for (const { name, regex } of BLOCKLIST_PATTERNS) {
    if (regex.test(body)) return name;
  }
  return null;
}
