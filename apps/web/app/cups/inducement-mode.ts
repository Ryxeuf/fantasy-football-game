/**
 * Régime des coups de pouce d'une coupe, côté formulaire. Miroir des règles
 * du serveur (`services/cup-inducement-mode`) : un règlement de tournoi
 * impose `build`, le Sept l'interdit, une coupe BB11 neuve naît en `build`.
 * Le serveur reste juge (il réécrit le mode sous règlement et refuse `build`
 * en Sept) ; ce module ne fait que proposer les bons choix. 100 % pur.
 */

export const CUP_INDUCEMENT_MODES = ["build", "match", "none"] as const;
export type CupInducementMode = (typeof CUP_INDUCEMENT_MODES)[number];

export interface CupInducementModeContext {
  readonly format: string;
  readonly hasTournamentRuleset: boolean;
}

export interface CupInducementModeChoices {
  /** Modes proposés, dans l'ordre d'affichage. */
  readonly modes: readonly CupInducementMode[];
  /** Imposé par le règlement : un seul choix, grisé. */
  readonly locked: boolean;
}

export function cupInducementModeChoices(
  ctx: CupInducementModeContext,
): CupInducementModeChoices {
  if (ctx.hasTournamentRuleset) return { modes: ["build"], locked: true };
  if (ctx.format === "sevens") return { modes: ["match", "none"], locked: false };
  return { modes: CUP_INDUCEMENT_MODES, locked: false };
}

/** Mode d'une coupe NEUVE (même défaut que le serveur). */
export function defaultCupInducementMode(
  ctx: CupInducementModeContext,
): CupInducementMode {
  if (ctx.hasTournamentRuleset) return "build";
  return ctx.format === "sevens" ? "match" : "build";
}

/**
 * Mode retenu quand le contexte change (format, règlement) : celui du coach
 * s'il reste proposé, le défaut sinon.
 */
export function coerceCupInducementMode(
  mode: CupInducementMode,
  ctx: CupInducementModeContext,
): CupInducementMode {
  return cupInducementModeChoices(ctx).modes.includes(mode)
    ? mode
    : defaultCupInducementMode(ctx);
}

/**
 * La liste autorisée n'a de sens que sans règlement (qui impose sa liste
 * fermée) et quand des coups de pouce existent.
 */
export function showsAllowedInducements(
  mode: CupInducementMode,
  ctx: Pick<CupInducementModeContext, "hasTournamentRuleset">,
): boolean {
  return !ctx.hasTournamentRuleset && mode !== "none";
}

export const CUP_INDUCEMENT_MODE_COPY: Readonly<
  Record<CupInducementMode, { readonly title: string; readonly description: string }>
> = {
  build: {
    title: "À la création de l'équipe",
    description:
      "Achetés sur le budget de construction, ils valent pour chaque ronde. Aucun achat en avant-match.",
  },
  match: {
    title: "En avant-match",
    description:
      "Achetés avant chaque rencontre avec l'écart de VEA (Petite Monnaie), sans trésorerie en coupe.",
  },
  none: {
    title: "Aucun",
    description:
      "Aucun coup de pouce. Les Star Players du roster d'inscription jouent toujours.",
  },
};

/** Valeur servie par l'API (`rulesConfig.inducementMode`), `null` si inconnue. */
export function parseCupInducementMode(raw: unknown): CupInducementMode | null {
  return typeof raw === "string" &&
    (CUP_INDUCEMENT_MODES as readonly string[]).includes(raw)
    ? (raw as CupInducementMode)
    : null;
}
