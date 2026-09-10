/**
 * Moteur de BRACKET d'élimination directe (PUR, sans I/O).
 *
 * Extrait de `league-playoffs` pour que les coupes s'en servent aussi : le
 * seeding, la carte d'avancement et la sélection depuis les quotas de poule
 * ne connaissent que des identifiants OPAQUES — `LeagueParticipant.id` côté
 * ligue, `Team.id` côté coupe. Écrire un second moteur, c'était garantir que
 * les deux brackets divergent (un croisement corrigé d'un côté seulement, et
 * la finale n'oppose plus les deux têtes de série).
 *
 * `league-playoffs` ré-exporte tout ce module : ses appelants et ses tests
 * n'ont pas bougé.
 *
 * Le vocabulaire reste celui de la ligue (`homeParticipantId`) parce que
 * c'est lui qui est déjà écrit partout ; côté coupe, on y met un `teamId`.
 */

export type PlayoffSize = 0 | 2 | 4 | 8;

export interface BracketPairing {
  /** Slot du bracket : "qf1".."qf4", "sf1".."sf2", "final". */
  readonly slot: string;
  /** Round number sequentiel apres la saison reguliere. */
  readonly roundNumber: number;
  /** participantId du seed home (cote haut du pairing). */
  readonly homeParticipantId: string;
  /** participantId du seed away (cote bas du pairing). */
  readonly awayParticipantId: string;
}

export interface BracketSeed {
  readonly participantId: string;
  /** Position dans le classement (1 = champion regulier). */
  readonly seedRank: number;
}

const QUARTER_FINALS = ["qf1", "qf2", "qf3", "qf4"] as const;
const SEMI_FINALS = ["sf1", "sf2"] as const;
const FINAL_SLOT = "final";

/**
 * Slot pattern utilise quand on advance un winner :
 *   - winner of qf1 va dans sf1 (home)
 *   - winner of qf2 va dans sf1 (away)
 *   - winner of qf3 va dans sf2 (home)
 *   - winner of qf4 va dans sf2 (away)
 *   - winner of sf1 va dans final (home)
 *   - winner of sf2 va dans final (away)
 */
export const ADVANCEMENT_SLOTS: Readonly<
  Record<string, { nextSlot: string; side: "home" | "away" }>
> = {
  qf1: { nextSlot: "sf1", side: "home" },
  qf2: { nextSlot: "sf1", side: "away" },
  qf3: { nextSlot: "sf2", side: "home" },
  qf4: { nextSlot: "sf2", side: "away" },
  sf1: { nextSlot: FINAL_SLOT, side: "home" },
  sf2: { nextSlot: FINAL_SLOT, side: "away" },
};

/**
 * PURE — calcule les pairings du PREMIER round playoff d'une taille
 * donnee a partir de la liste des participants seedes (index 0 =
 * meilleur seed = "seed 1").
 *
 * Throws si playoffSize invalide ou si seeds.length < playoffSize.
 *
 * @param size 0 / 2 / 4 / 8
 * @param seeds liste ordonnee par classement (index 0 = seed 1)
 * @param baseRoundNumber numero a partir duquel les rounds playoff sont
 *                       numerotes (ex: si la saison reguliere a 7
 *                       rounds, baseRoundNumber=8).
 */
export function generatePlayoffSeedingFor(
  size: PlayoffSize,
  seeds: readonly string[],
  baseRoundNumber: number,
): BracketPairing[] {
  if (size === 0) return [];
  if (size !== 2 && size !== 4 && size !== 8) {
    throw new Error(`playoffSize non supporte: ${size}`);
  }
  if (seeds.length < size) {
    throw new Error(
      `Seeds insuffisants pour playoffSize=${size} : ${seeds.length} fournis`,
    );
  }
  // Seed fixe : on ne prend que les top-N.
  const top = seeds.slice(0, size);

  switch (size) {
    case 2:
      // Final direct : seed 1 vs seed 2.
      return [
        {
          slot: FINAL_SLOT,
          roundNumber: baseRoundNumber,
          homeParticipantId: top[0],
          awayParticipantId: top[1],
        },
      ];
    case 4:
      // SF : 1v4, 2v3 (cross-bracket : seeds 1 et 2 ne se rencontrent
      // qu'en final).
      return [
        {
          slot: SEMI_FINALS[0],
          roundNumber: baseRoundNumber,
          homeParticipantId: top[0],
          awayParticipantId: top[3],
        },
        {
          slot: SEMI_FINALS[1],
          roundNumber: baseRoundNumber,
          homeParticipantId: top[1],
          awayParticipantId: top[2],
        },
      ];
    case 8:
      // QF : 1v8, 4v5, 2v7, 3v6.
      return [
        {
          slot: QUARTER_FINALS[0],
          roundNumber: baseRoundNumber,
          homeParticipantId: top[0],
          awayParticipantId: top[7],
        },
        {
          slot: QUARTER_FINALS[1],
          roundNumber: baseRoundNumber,
          homeParticipantId: top[3],
          awayParticipantId: top[4],
        },
        {
          slot: QUARTER_FINALS[2],
          roundNumber: baseRoundNumber,
          homeParticipantId: top[1],
          awayParticipantId: top[6],
        },
        {
          slot: QUARTER_FINALS[3],
          roundNumber: baseRoundNumber,
          homeParticipantId: top[2],
          awayParticipantId: top[5],
        },
      ];
  }
}

/**
 * PURE — pour un slot playoff (qf1..final), retourne le slot suivant
 * et le cote (home/away) auquel le winner doit etre place. Renvoie
 * null pour `final` (pas d'advancement).
 */
export function nextSlotFor(
  slot: string,
): { nextSlot: string; side: "home" | "away" } | null {
  return ADVANCEMENT_SLOTS[slot] ?? null;
}

/**
 * PURE — pour une taille playoff donnee, retourne la liste des slots
 * du premier round (les "feuilles" de l'arbre).
 */
export function firstRoundSlotsFor(size: PlayoffSize): readonly string[] {
  if (size === 8) return QUARTER_FINALS;
  if (size === 4) return SEMI_FINALS;
  if (size === 2) return [FINAL_SLOT];
  return [];
}

/**
 * Entree PURE de `selectSeedsFromPools` : une poule avec son quota de
 * qualifies et son classement interne (index 0 = 1er de poule).
 * Les participants `withdrawn` doivent deja avoir ete filtres.
 */
export interface PoolQualificationInput {
  readonly poolId: string;
  readonly poolOrder: number;
  readonly qualifiesForPlayoffs: number;
  readonly ranked: readonly string[];
}

export type PoolSeedOutcome =
  | { readonly ok: true; readonly seeds: readonly string[] }
  | {
      readonly ok: false;
      readonly reason:
        | "pool-qualification-mismatch"
        | "insufficient-participants";
    };

/**
 * PURE — construit la liste des seeds a partir des quotas de poule.
 *
 * Ordre "serpentin" : tous les 1ers de poule (par `poolOrder`
 * croissant), puis tous les 2emes, etc. Combine au seeding croise de
 * `generatePlayoffSeedingFor` (1v8/4v5/2v7/3v6), cet ordre evite les
 * duels intra-poule au premier tour tant que les poules ont le meme
 * quota. En quotas asymetriques un duel intra-poule redevient
 * possible : le commissaire dispose alors de l'editeur de seeds
 * (`overridePlayoffParticipants`).
 *
 * Refus (aucun seed produit) :
 *   - `pool-qualification-mismatch` : somme des quotas != taille du
 *     bracket. On refuse plutot que d'ajuster, pour ne pas produire un
 *     bracket qui contredit les quotas affiches toute la saison.
 *   - `insufficient-participants` : une poule compte moins d'equipes
 *     eligibles que son quota.
 */
export function selectSeedsFromPools(
  pools: readonly PoolQualificationInput[],
  size: PlayoffSize,
): PoolSeedOutcome {
  const totalQualified = pools.reduce(
    (n, p) => n + Math.max(0, p.qualifiesForPlayoffs),
    0,
  );
  if (totalQualified !== size) {
    return { ok: false, reason: "pool-qualification-mismatch" };
  }

  const qualifying = pools
    .filter((p) => p.qualifiesForPlayoffs > 0)
    .slice()
    .sort((a, b) =>
      a.poolOrder !== b.poolOrder
        ? a.poolOrder - b.poolOrder
        : a.poolId.localeCompare(b.poolId),
    );

  for (const p of qualifying) {
    if (p.ranked.length < p.qualifiesForPlayoffs) {
      return { ok: false, reason: "insufficient-participants" };
    }
  }

  const maxQuota = qualifying.reduce(
    (n, p) => Math.max(n, p.qualifiesForPlayoffs),
    0,
  );
  const seeds: string[] = [];
  for (let rank = 0; rank < maxQuota; rank += 1) {
    for (const p of qualifying) {
      if (p.qualifiesForPlayoffs > rank) seeds.push(p.ranked[rank]);
    }
  }

  return { ok: true, seeds };
}
