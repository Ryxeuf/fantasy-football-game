/**
 * Côté saisi par un coach qui possède les DEUX équipes d'une rencontre — PUR.
 *
 * Le serveur sert `viewerSides` (côtés possédés). Avec deux entrées, la
 * feuille propose « Je saisis pour : [A] / [B] » ; le choix vit dans l'URL
 * (`?side=`) pour survivre à un rechargement et se partager tel quel. Les
 * panneaux par côté, la soumission et son retrait suivent ce côté.
 */

export type SheetSide = "home" | "away";

/** Côté lu dans la query (`?side=home|away`), `null` sinon. */
export function parseSideParam(search: string): SheetSide | null {
  const value = new URLSearchParams(search).get("side");
  return value === "home" || value === "away" ? value : null;
}

/** Query avec `side` posé (les autres paramètres sont conservés). */
export function searchWithSide(search: string, side: SheetSide): string {
  const params = new URLSearchParams(search);
  params.set("side", side);
  return `?${params.toString()}`;
}

/**
 * Côté du viewer : le côté choisi s'il le possède, sinon le repli (dérivé
 * de `viewerTeamId`, comportement historique).
 */
export function pickMySide(
  viewerSides: readonly SheetSide[] | undefined,
  selected: SheetSide | null,
  fallback: SheetSide | null,
): SheetSide | null {
  if (selected && viewerSides?.includes(selected)) return selected;
  return fallback;
}

/** Double propriétaire : la feuille doit lui demander pour quel côté il saisit. */
export function ownsBothSides(
  viewerSides: readonly SheetSide[] | undefined,
): boolean {
  return (viewerSides?.length ?? 0) >= 2;
}
