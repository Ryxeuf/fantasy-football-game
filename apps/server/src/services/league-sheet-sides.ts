/**
 * Côtés d'une feuille de match et propriété des équipes — PUR.
 *
 * Un coach peut posséder les DEUX équipes d'une rencontre (rien ne
 * l'interdit, ni en ligue ni en coupe). Toute comparaison « mon côté »
 * (`coachSide(...) !== side`) le ramenait à « domicile » : sa soumission
 * n'atteignait jamais `both_submitted`, et la Haine, le mort relevé, les
 * évolutions et le tirage des journaliers lui refusaient l'extérieur. Les
 * contrôles d'appartenance passent donc par `ownsSide`, et une action qui
 * porte UN côté le reçoit explicitement d'un double propriétaire
 * (`resolveActingSide`).
 */

export type SheetSide = "home" | "away";

export interface SideOwners {
  readonly homeOwnerId: string;
  readonly awayOwnerId: string;
}

/** L'utilisateur possède-t-il l'équipe de ce côté ? */
export function ownsSide(
  ctx: SideOwners,
  userId: string,
  side: SheetSide,
): boolean {
  return side === "home"
    ? userId === ctx.homeOwnerId
    : userId === ctx.awayOwnerId;
}

/** Côtés possédés : aucun, un, ou les deux (domicile d'abord). */
export function ownedSides(ctx: SideOwners, userId: string): SheetSide[] {
  return (["home", "away"] as const).filter((s) => ownsSide(ctx, userId, s));
}

/** Les deux équipes appartiennent au même coach. */
export function sameOwner(ctx: SideOwners): boolean {
  return ctx.homeOwnerId === ctx.awayOwnerId;
}

export type ActingSideResult =
  | { readonly ok: true; readonly side: SheetSide }
  | {
      readonly ok: false;
      readonly code: "not_a_participant" | "side_required" | "forbidden";
    };

/**
 * Côté pour lequel un COACH agit (soumission, retrait de soumission…) :
 * celui qu'il demande s'il le possède, son unique côté sinon. Un double
 * propriétaire DOIT préciser — deviner « domicile » est précisément le bug.
 */
export function resolveActingSide(
  owned: readonly SheetSide[],
  requested: SheetSide | undefined,
): ActingSideResult {
  if (owned.length === 0) return { ok: false, code: "not_a_participant" };
  if (requested) {
    return owned.includes(requested)
      ? { ok: true, side: requested }
      : { ok: false, code: "forbidden" };
  }
  if (owned.length > 1) return { ok: false, code: "side_required" };
  return { ok: true, side: owned[0] };
}

/**
 * Côté AFFICHÉ pour le viewer (`viewerRole` / `viewerTeamId`) : celui
 * qu'il choisit (`?side=`) s'il le possède, sinon son premier côté.
 */
export function viewerSide(
  owned: readonly SheetSide[],
  requested: SheetSide | undefined,
): SheetSide | null {
  if (requested && owned.includes(requested)) return requested;
  return owned[0] ?? null;
}
