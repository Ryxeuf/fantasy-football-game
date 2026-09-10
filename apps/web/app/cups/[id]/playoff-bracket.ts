/**
 * Dérivations PURES du bracket de coupe : regroupement des rondes par tour
 * et relecture des têtes de série courantes.
 *
 * Hors composant pour être testable sans DOM — et pour que les deux règles
 * subtiles (l'ordre des tours, le placeholder qui ne compte qu'une fois)
 * soient couvertes en unitaire plutôt que devinées à travers un rendu.
 */

export type BracketStage = "qf" | "sf" | "final";

export interface BracketRoundLike {
  readonly id: string;
  readonly roundNumber: number;
  readonly slot: string;
  readonly placeholder: boolean;
  readonly homeTeam: { readonly id: string } | null;
  readonly awayTeam: { readonly id: string } | null;
  readonly pairingStatus: string | null;
  readonly localMatch: { readonly id: string } | null;
}

export interface BracketStageGroup<T> {
  readonly stage: BracketStage;
  readonly rounds: readonly T[];
}

const STAGE_ORDER: readonly BracketStage[] = ["qf", "sf", "final"];

/** Tour d'un slot (`qf3` → `qf`). `null` pour un slot inconnu. */
export function stageOf(slot: string): BracketStage | null {
  if (slot.startsWith("qf")) return "qf";
  if (slot.startsWith("sf")) return "sf";
  if (slot === "final") return "final";
  return null;
}

/**
 * Range les rondes par tour, des quarts vers la finale, chaque tour trié par
 * numéro de ronde. Un slot inconnu est ignoré : mieux vaut une colonne qui
 * manque qu'une colonne « autre » qui ne veut rien dire.
 */
export function groupRoundsByStage<T extends BracketRoundLike>(
  rounds: readonly T[],
): Array<BracketStageGroup<T>> {
  const buckets = new Map<BracketStage, T[]>();
  for (const round of rounds) {
    const stage = stageOf(round.slot);
    if (!stage) continue;
    const bucket = buckets.get(stage) ?? [];
    bucket.push(round);
    buckets.set(stage, bucket);
  }
  return STAGE_ORDER.filter((stage) => buckets.has(stage)).map((stage) => ({
    stage,
    rounds: (buckets.get(stage) ?? [])
      .slice()
      .sort((a, b) => a.roundNumber - b.roundNumber),
  }));
}

/** Premier tour d'un bracket de cette taille — celui qui porte les têtes. */
export function firstStageOf(size: number): BracketStage {
  return size === 8 ? "qf" : size === 4 ? "sf" : "final";
}

/**
 * Têtes de série courantes, à plat, dans l'ordre (1re, 2e, …).
 *
 * Un placeholder (`home === away`, le second qualifié manque encore) ne
 * compte qu'une fois : le dupliquer proposerait à l'édition un bracket dont
 * deux têtes seraient la même équipe.
 */
export function currentSeeds(
  rounds: readonly BracketRoundLike[],
  size: number,
): string[] {
  const stage = firstStageOf(size);
  const seeds: string[] = [];
  for (const round of rounds
    .filter((r) => stageOf(r.slot) === stage)
    .slice()
    .sort((a, b) => a.roundNumber - b.roundNumber)) {
    if (round.homeTeam) seeds.push(round.homeTeam.id);
    if (round.awayTeam && !round.placeholder) seeds.push(round.awayTeam.id);
  }
  return seeds;
}

/**
 * Têtes de série modifiables : tant qu'aucune rencontre du bracket n'est
 * lancée. Réécrire un bracket dont un match est joué effacerait ce résultat.
 */
export function canEditSeeds(rounds: readonly BracketRoundLike[]): boolean {
  if (rounds.length === 0) return false;
  return rounds.every(
    (r) => r.localMatch === null && r.pairingStatus !== "played",
  );
}
