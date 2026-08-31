/**
 * Valeur affichée d'un joueur dans la composition d'équipe.
 *
 * La colonne « Coût » montrait le tarif d'EMBAUCHE du poste. Un Bloqueur
 * Ogre recruté 140k et augmenté de deux compétences y restait donc à 140k,
 * alors qu'il pesait 230k dans la VE affichée juste au-dessus : « les
 * joueurs ont été augmentés, pourquoi leur valeur ne change pas ? ».
 *
 * La valeur fait foi côté SERVEUR (`GET /team/:id` → `playerValues`), qui la
 * calcule avec la même résolution que la VE : coûts de poste en base, barème
 * de l'édition, surcoût Élite. Le repli local ne sert qu'à rester lisible
 * face à un serveur pré-correctif (cf. « Backwards-compat sur champs API
 * ajoutes ») et ignore volontairement le surcoût Élite, qu'il ne peut pas
 * connaître sans le catalogue des compétences.
 */

/** Valeur d'un joueur servie par l'API, en po. */
export interface PlayerValueView {
  readonly hireCost: number;
  readonly advancementsCost: number;
  readonly value: number;
}

/** Joueur de la composition, réduit à ce dont la valorisation a besoin. */
export interface ValuedPlayer {
  readonly id?: string;
  readonly position: string;
  readonly advancements?: string | null;
}

/**
 * Surcoûts d'avancement (po) au barème de type — REPLI. `byType` vient de
 * `SURCHARGE_PER_ADVANCEMENT` (moteur).
 */
export function advancementSurchargeFallbackPo(
  advancementsJson: unknown,
  byType: Readonly<Record<string, number>>,
): number {
  const parsed: unknown =
    typeof advancementsJson === "string"
      ? (() => {
          try {
            return JSON.parse(advancementsJson);
          } catch {
            return [];
          }
        })()
      : advancementsJson;
  if (!Array.isArray(parsed)) return 0;
  return parsed.reduce((sum: number, adv: unknown) => {
    if (typeof adv !== "object" || adv === null) return sum;
    const type = (adv as { type?: unknown }).type;
    if (typeof type !== "string") return sum;
    return sum + (byType[type] ?? 0);
  }, 0);
}

export interface PlayerValueResolverInput {
  /** `team.playerValues` servi par l'API, indexé par `TeamPlayer.id`. */
  readonly served: Readonly<Record<string, PlayerValueView>> | undefined;
  /** Coût d'embauche (po) d'un poste — base d'abord, moteur en repli. */
  readonly hireCostOf: (position: string) => number;
  /** Barème des surcoûts par type d'amélioration (po). */
  readonly surchargeByType: Readonly<Record<string, number>>;
}

/**
 * Construit le résolveur de valeur : la valeur servie par le serveur si
 * elle existe pour ce joueur, sinon « embauche + surcoûts standards ».
 */
export function makePlayerValueResolver(
  input: PlayerValueResolverInput,
): (player: ValuedPlayer) => number {
  return (player) => {
    const exact = player.id ? input.served?.[player.id] : undefined;
    if (exact && typeof exact.value === "number") return exact.value;
    return (
      input.hireCostOf(player.position) +
      advancementSurchargeFallbackPo(
        player.advancements,
        input.surchargeByType,
      )
    );
  };
}
