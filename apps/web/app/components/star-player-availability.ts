/**
 * Règles pures de disponibilité d'un Star Player dans le sélecteur.
 *
 * Le sélecteur se contentait de griser la case à cocher (`canSelectMore`
 * renvoyait un booléen) et masquait purement et simplement les Star Players
 * bannis par un règlement de tournoi. Résultat : un coach voyait une ligne
 * inerte, ou pas de ligne du tout, sans jamais savoir pourquoi.
 *
 * Ce module renvoie la RAISON du blocage, avec les montants nécessaires au
 * message ; l'UI n'a plus qu'à l'afficher. Les mêmes règles sont revérifiées
 * côté serveur (`validateStarPlayerHire`) : elles servent ici à ne jamais
 * proposer un choix que l'API refuserait, et à l'expliquer.
 */

/** Raison pour laquelle un Star Player n'est pas recrutable. */
export type StarPlayerBlockReason =
  /** Banni par le règlement de tournoi retenu. */
  | "banned"
  /** Le budget restant ne couvre pas le coût (paire comprise). */
  | "budget"
  /** Le plafond de joueurs de l'équipe serait dépassé (paire comprise). */
  | "roster-cap"
  /** Le partenaire de paire obligatoire n'est pas dans la liste servie. */
  | "pair-unavailable";

export interface StarPlayerBlock {
  readonly reason: StarPlayerBlockReason;
  /** Coût total à couvrir (po), paire comprise. Renseigné pour `budget`. */
  readonly requiredPo?: number;
  /** Budget disponible (po). Renseigné pour `budget`. */
  readonly availablePo?: number;
  /** Nombre de places nécessaires. Renseigné pour `roster-cap`. */
  readonly neededSlots?: number;
  /** Plafond de joueurs de l'équipe. Renseigné pour `roster-cap`. */
  readonly maxPlayers?: number;
  /** Slug du partenaire manquant. Renseigné pour `pair-unavailable`. */
  readonly partnerSlug?: string;
}

export interface StarPlayerLike {
  readonly slug: string;
  readonly cost: number;
}

export interface StarPlayerBlockInput {
  /** Star Player évalué. */
  readonly star: StarPlayerLike;
  /** Catalogue servi (sert à retrouver le partenaire de paire). */
  readonly catalog: readonly StarPlayerLike[];
  /** Sélection courante (slugs). */
  readonly selected: readonly string[];
  /** Coût (po) de la sélection courante. */
  readonly selectedCostPo: number;
  /** Budget disponible (po) pour les Star Players. */
  readonly availableBudgetPo: number;
  /** Joueurs normaux déjà dans l'équipe. */
  readonly currentPlayerCount: number;
  /** Plafond de joueurs (Star Players compris) du format. */
  readonly maxPlayers: number;
  /** Partenaire de paire obligatoire, par slug. */
  readonly pairPartners: Readonly<Record<string, string>>;
  /** Star Players bannis par le règlement de tournoi. */
  readonly bannedSlugs?: readonly string[];
}

/**
 * Raison du blocage, ou `null` si le Star Player est recrutable. Un Star
 * Player DÉJÀ sélectionné n'est jamais bloqué : on doit toujours pouvoir le
 * décocher, même si l'équipe est entre-temps devenue hors budget.
 */
export function starPlayerBlock({
  star,
  catalog,
  selected,
  selectedCostPo,
  availableBudgetPo,
  currentPlayerCount,
  maxPlayers,
  pairPartners,
  bannedSlugs,
}: StarPlayerBlockInput): StarPlayerBlock | null {
  if (selected.includes(star.slug)) return null;

  if (bannedSlugs?.includes(star.slug)) return { reason: "banned" };

  const partnerSlug = pairPartners[star.slug];
  const partnerAlreadyIn = partnerSlug ? selected.includes(partnerSlug) : false;

  let partner: StarPlayerLike | undefined;
  if (partnerSlug && !partnerAlreadyIn) {
    partner = catalog.find((sp) => sp.slug === partnerSlug);
    if (!partner) return { reason: "pair-unavailable", partnerSlug };
    if (bannedSlugs?.includes(partnerSlug)) {
      return { reason: "pair-unavailable", partnerSlug };
    }
  }

  const neededSlots = partner ? 2 : 1;
  const usedSlots = currentPlayerCount + selected.length;
  if (usedSlots + neededSlots > maxPlayers) {
    return { reason: "roster-cap", neededSlots, maxPlayers };
  }

  const requiredPo = star.cost + (partner?.cost ?? 0);
  if (selectedCostPo + requiredPo > availableBudgetPo) {
    return {
      reason: "budget",
      requiredPo,
      availablePo: Math.max(0, availableBudgetPo - selectedCostPo),
    };
  }

  return null;
}

/** Coût affiché en K po (arrondi), sans suffixe. */
function kpo(po: number): string {
  return Math.round(po / 1000).toLocaleString("fr-FR");
}

/** Message court expliquant le blocage, prêt à afficher. */
export function starPlayerBlockLabel(block: StarPlayerBlock): string {
  switch (block.reason) {
    case "banned":
      return "Interdit par le règlement du tournoi";
    case "roster-cap":
      return block.neededSlots && block.neededSlots > 1
        ? `Plus de place pour la paire (maximum ${block.maxPlayers} joueurs)`
        : `Plus de place dans l'équipe (maximum ${block.maxPlayers} joueurs)`;
    case "budget":
      return `Budget insuffisant : ${kpo(block.requiredPo ?? 0)}K po requis, ${kpo(
        block.availablePo ?? 0,
      )}K po disponibles`;
    case "pair-unavailable":
      return "Partenaire de paire obligatoire indisponible pour cette équipe";
  }
}
