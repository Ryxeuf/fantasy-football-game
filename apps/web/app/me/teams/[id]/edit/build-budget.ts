/**
 * Budget de construction d'une équipe, côté édition.
 *
 * DEUX monnaies, à ne jamais mélanger :
 *  - l'**or** paie les EMBAUCHES, le staff, les relances, les fans dévoués
 *    et les Star Players. C'est lui que borne `Team.initialBudget` ;
 *  - les **PSP** (pool de construction, ou SPP gagnés en match) paient les
 *    améliorations. Elles montent la VE, jamais la facture en or.
 *
 * Régression couverte (cas prod, équipe Ogre sous NAF World Cup 2027) :
 * l'écran d'édition sommait la VALEUR des joueurs — embauches + surcoûts
 * d'avancement — et la confrontait au budget. Une équipe construite au
 * budget EXACT (995k d'embauches + 185k de staff = 1 180k) s'affichait donc
 * « Budget dépassé ! −240k », soit exactement le prix en VE des compétences
 * qu'elle avait payées avec ses 66 PSP. Le serveur, lui, n'a jamais compté
 * que `pos.cost` (cf. `team-roster-save-handler`) : l'écran mentait seul.
 */

/** Surcoûts de VE par type d'amélioration (po), Élite compris. */
export interface AdvancementSurcharges {
  /** Surcoût du type (`primary` +20k, `secondary` +40k…). 0 si inconnu. */
  readonly byType: Readonly<Record<string, number>>;
  /** Surcoût additionnel d'une compétence Élite (po). */
  readonly eliteExtra: number;
  /** Slugs des compétences Élite du catalogue. */
  readonly eliteSlugs: ReadonlySet<string>;
}

/** Joueur du brouillon d'édition, réduit à ce dont le budget a besoin. */
export interface BudgetPlayer {
  readonly position: string;
  /** Colonne `advancements` (chaîne JSON, tolérante). */
  readonly advancements?: string | null;
}

export interface BuildBudgetInput {
  readonly players: readonly BudgetPlayer[];
  /** Coût d'embauche (po) d'un poste — tarif de la BASE. */
  readonly hireCostOf: (position: string) => number;
  /** Staff + relances + fans dévoués (po). */
  readonly staffSpend: number;
  /** Star Players recrutés (po). */
  readonly starPlayersCost: number;
  /** Budget de construction (po). */
  readonly budgetPo: number;
  readonly surcharges: AdvancementSurcharges;
}

export interface BuildBudget {
  /** Embauches seules — la part payée en or. */
  readonly playersHireCost: number;
  /** Surcoûts d'avancement — payés en PSP, hors budget. */
  readonly advancementsCost: number;
  /** VALEUR des joueurs : embauches + augmentations (ce que compte la VE). */
  readonly playersCost: number;
  /** OR engagé : embauches + staff + Star Players. */
  readonly totalSpent: number;
  /** Reliquat du budget d'or. */
  readonly remaining: number;
  /** Le budget d'OR est-il dépassé ? */
  readonly isOverBudget: boolean;
}

/** Parse tolérant de la colonne `advancements` (chaîne JSON ou tableau). */
export function parseAdvancementsJson(raw: unknown): ReadonlyArray<Record<string, unknown>> {
  const parsed: unknown =
    typeof raw === "string"
      ? (() => {
          try {
            return JSON.parse(raw);
          } catch {
            return [];
          }
        })()
      : raw;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (a): a is Record<string, unknown> => typeof a === "object" && a !== null,
  );
}

/** Surcoûts d'avancement d'un joueur (po), Élite compris. */
export function advancementSurchargePo(
  advancements: unknown,
  surcharges: AdvancementSurcharges,
): number {
  return parseAdvancementsJson(advancements).reduce((sum, adv) => {
    const type = typeof adv.type === "string" ? adv.type : "";
    const base = surcharges.byType[type];
    if (!base) return sum;
    const slug = typeof adv.skillSlug === "string" ? adv.skillSlug : undefined;
    const elite =
      slug && surcharges.eliteSlugs.has(slug) ? surcharges.eliteExtra : 0;
    return sum + base + elite;
  }, 0);
}

/**
 * Ventile le budget d'une équipe en édition. Pur : aucune I/O, aucun accès
 * au catalogue — l'appelant injecte les tarifs déjà résolus.
 */
export function computeBuildBudget(input: BuildBudgetInput): BuildBudget {
  const playersHireCost = input.players.reduce(
    (total, p) => total + input.hireCostOf(p.position),
    0,
  );
  const advancementsCost = input.players.reduce(
    (total, p) => total + advancementSurchargePo(p.advancements, input.surcharges),
    0,
  );
  // SEULES les embauches touchent le budget d'or — même règle que le
  // serveur au PUT /roster.
  const totalSpent = playersHireCost + input.staffSpend + input.starPlayersCost;
  return {
    playersHireCost,
    advancementsCost,
    playersCost: playersHireCost + advancementsCost,
    totalSpent,
    remaining: input.budgetPo - totalSpent,
    isOverBudget: input.budgetPo - totalSpent < 0,
  };
}
