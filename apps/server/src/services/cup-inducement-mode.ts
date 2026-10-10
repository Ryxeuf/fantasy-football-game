/**
 * Régime des coups de pouce d'une coupe.
 *
 *  - `build` : achetés UNE fois à la création de l'équipe, sur le budget
 *    d'or, valables à chaque ronde (logique de tournoi : le roster
 *    d'inscription rejoue à l'identique) ; aucun achat d'avant-match ;
 *  - `match` : achetés avant chaque rencontre, avec la seule petite monnaie
 *    (une coupe ne débite jamais la trésorerie) ;
 *  - `none`  : aucun coup de pouce.
 *
 * `Cup.inducementMode` est nullable SANS `@default` : `null` (coupe antérieure
 * au réglage) se lit `match`, et c'est la création qui écrit la valeur d'une
 * coupe neuve. Un règlement de tournoi impose `build` (il place ses coups de
 * pouce à la création) ; une coupe à Sept ne peut pas être en `build`.
 *
 * 100 % pur ⇒ testable sans Prisma (`cup-inducement-mode.test.ts`).
 */

export const CUP_INDUCEMENT_MODES = ["build", "match", "none"] as const;
export type CupInducementMode = (typeof CUP_INDUCEMENT_MODES)[number];

/** Ce qui contraint le mode d'une coupe. */
export interface CupInducementModeContext {
  /** La coupe impose-t-elle un règlement de tournoi ? */
  readonly hasTournamentRuleset: boolean;
  /** Format de la coupe (`bb11` | `sevens`). */
  readonly format: string;
}

/** Mode lu tel quel, ou `null` si la valeur n'en est pas un. */
export function parseCupInducementMode(
  raw: unknown,
): CupInducementMode | null {
  return typeof raw === "string" &&
    (CUP_INDUCEMENT_MODES as readonly string[]).includes(raw)
    ? (raw as CupInducementMode)
    : null;
}

/**
 * Mode EFFECTIF d'une coupe : règlement ⇒ `build` ; `build` impossible en
 * Sept ; inconnu ou `null` ⇒ `match` (état historique).
 */
export function resolveCupInducementMode(
  raw: unknown,
  ctx: CupInducementModeContext,
): CupInducementMode {
  if (ctx.hasTournamentRuleset) return "build";
  const parsed = parseCupInducementMode(raw);
  if (parsed === "build" && ctx.format === "sevens") return "match";
  return parsed ?? "match";
}

/** Mode d'une coupe NEUVE créée sans choix explicite. */
export function defaultCupInducementMode(
  ctx: CupInducementModeContext,
): CupInducementMode {
  if (ctx.hasTournamentRuleset) return "build";
  return ctx.format === "sevens" ? "match" : "build";
}

/** Erreur de choix de mode (à mapper en 400). */
export type CupInducementModeError = "build_not_allowed_in_sevens";

/**
 * Mode à ÉCRIRE pour une demande (création ou modification). `undefined` =
 * pas de demande : on garde `current` s'il existe, sinon le défaut d'une
 * coupe neuve. Un règlement impose `build` quelle que soit la demande ; une
 * demande explicite de `build` en Sept est refusée.
 */
export function modeToWrite(
  requested: CupInducementMode | undefined,
  ctx: CupInducementModeContext,
  current: unknown = null,
):
  | { readonly ok: true; readonly mode: CupInducementMode }
  | { readonly ok: false; readonly error: CupInducementModeError } {
  if (ctx.hasTournamentRuleset) return { ok: true, mode: "build" };
  if (requested === "build" && ctx.format === "sevens") {
    return { ok: false, error: "build_not_allowed_in_sevens" };
  }
  if (requested) return { ok: true, mode: requested };
  const existing = parseCupInducementMode(current);
  if (existing) return { ok: true, mode: resolveCupInducementMode(existing, ctx) };
  return { ok: true, mode: defaultCupInducementMode(ctx) };
}

/**
 * Liste de coups de pouce autorisés d'une coupe (colonne `Json?` : tableau
 * natif PG ou chaîne du miroir SQLite). `null` = aucune restriction ; une
 * liste vide ou illisible vaut aussi « aucune restriction » — une ligne
 * corrompue ne doit pas fermer tout le catalogue.
 */
export function parseCupAllowedInducements(raw: unknown): string[] | null {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(value)) return null;
  const slugs = [
    ...new Set(
      value.filter((s): s is string => typeof s === "string" && s.length > 0),
    ),
  ];
  return slugs.length > 0 ? slugs : null;
}
