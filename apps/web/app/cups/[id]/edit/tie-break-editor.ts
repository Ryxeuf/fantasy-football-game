/**
 * Manipulation de la liste ordonnée des critères de départage (PUR).
 *
 * L'ORDRE porte le sens : « points puis sorties infligées » ne classe pas
 * comme « sorties infligées puis points ». Les deux opérations de l'écran
 * (cocher / décocher, monter / descendre) vivent donc ici, testables sans
 * DOM — et immuables, comme le reste du code (cf. CLAUDE.md).
 */

/** Ajoute un critère en queue, ou le retire s'il est déjà présent. */
export function toggleRule(
  rules: readonly string[],
  slug: string,
): string[] {
  return rules.includes(slug)
    ? rules.filter((s) => s !== slug)
    : [...rules, slug];
}

/**
 * Déplace un critère de `delta` rangs. Un déplacement hors des bornes ne
 * fait rien (plutôt que de faire disparaître le critère ou de le renvoyer à
 * l'autre bout de la liste, ce qu'un clic répété rendrait imprévisible).
 */
export function moveRule(
  rules: readonly string[],
  slug: string,
  delta: number,
): string[] {
  const from = rules.indexOf(slug);
  if (from < 0) return [...rules];
  const to = from + delta;
  if (to < 0 || to >= rules.length) return [...rules];
  const next = [...rules];
  next.splice(from, 1);
  next.splice(to, 0, slug);
  return next;
}
