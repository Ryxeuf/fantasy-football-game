/**
 * Récompenses en Couronnes (change `crowns-earning`) — module PUR.
 *
 * Les Couronnes se GAGNENT en jouant : chaque côté d'une feuille de match
 * validée (ligue ou coupe) rapporte au propriétaire de l'équipe, chaque succès
 * débloqué rapporte une fois, et le bonus de bienvenue est versé une fois.
 * C'est la PARTICIPATION qui paie, jamais la victoire : une invalidation ne
 * change donc rien à une récompense déjà versée.
 *
 * Ce module décide QUOI verser — barème, clés, plafond par saison — sans rien
 * lire ni écrire. `services/crowns-rewards` charge les candidats, appelle
 * `planCrownsRewards` et écrit le passage (registre `CrownsReward` + opération
 * du wallet) dans une seule transaction.
 *
 * Clés de source (`CrownsReward.sourceKey`, UNIQUE et GLOBALE) :
 *  - `sheet:<sheetId>:home|away` — par CÔTÉ, sans l'utilisateur : un côté ne
 *    paie qu'une fois, même si l'équipe change de propriétaire ;
 *  - `achievement:<userId>:<slug>` ;
 *  - `signup:<userId>`.
 */

/**
 * Barème. Valeurs de DÉPART, à calibrer en recette sur le rythme réel de
 * feuilles validées (design D4) : le calibrage tient en une ligne ici.
 */
export interface CrownsRewardSchedule {
  /** Par côté de feuille validée. */
  readonly sheet: number;
  /** Par succès débloqué, une fois. */
  readonly achievement: number;
  /** Bonus de bienvenue, une fois par coach. */
  readonly signup: number;
  /** Plafond des gains de FEUILLES par saison de ligue (une coupe = une saison). */
  readonly seasonSheetCap: number;
}

export const DEFAULT_CROWNS_REWARD_SCHEDULE: CrownsRewardSchedule = {
  sheet: 25,
  achievement: 50,
  signup: 250,
  // ≈ 20 feuilles : une saison normale n'y arrive pas, c'est un filet anti-farm.
  seasonSheetCap: 500,
};

/**
 * Préfixe de la référence de l'opération `REWARD` d'un passage de rattrapage
 * (`ProTransaction.ref = "rewards:<id>"`). Miroir web : `apps/web/app/lib/crowns.ts`.
 */
export const REWARDS_TX_REF_PREFIX = "rewards:";

export type CrownsRewardKind = "sheet" | "achievement" | "signup";
export type SheetSide = "home" | "away";

export function sheetRewardKey(sheetId: string, side: SheetSide): string {
  return `sheet:${sheetId}:${side}`;
}

export function achievementRewardKey(userId: string, slug: string): string {
  return `achievement:${userId}:${slug}`;
}

export function signupRewardKey(userId: string): string {
  return `signup:${userId}`;
}

export function seasonPeriodKey(seasonId: string): string {
  return `season:${seasonId}`;
}

export function cupPeriodKey(cupId: string): string {
  return `cup:${cupId}`;
}

/**
 * Côtés d'une feuille qui rapportent à `userId` : ceux dont il possède
 * l'équipe, à condition que l'AUTRE côté appartienne à un autre compte. Une
 * feuille sans adversaire connu ne rapporte rien.
 */
export function eligibleSheetSides(
  userId: string,
  homeOwnerId: string | null,
  awayOwnerId: string | null,
): SheetSide[] {
  if (!homeOwnerId || !awayOwnerId) return [];
  if (homeOwnerId === awayOwnerId) return [];
  if (homeOwnerId === userId) return ["home"];
  if (awayOwnerId === userId) return ["away"];
  return [];
}

export interface SheetRewardCandidate {
  readonly kind: "sheet";
  readonly sourceKey: string;
  readonly periodKey: string;
  readonly sheetId: string;
  readonly validatedAt: Date;
}

export interface AchievementRewardCandidate {
  readonly kind: "achievement";
  readonly sourceKey: string;
}

export interface SignupRewardCandidate {
  readonly kind: "signup";
  readonly sourceKey: string;
  /** Vrai si le coach a déjà touché le bonus de bienvenue de la Pro League. */
  readonly alreadyGranted: boolean;
}

export type CrownsRewardCandidate =
  | SheetRewardCandidate
  | AchievementRewardCandidate
  | SignupRewardCandidate;

export interface PlannedCrownsReward {
  readonly sourceKey: string;
  readonly kind: CrownsRewardKind;
  readonly periodKey: string | null;
  /** Versé (0 = plafonnée ou bonus déjà perçu : écrite, jamais retentée). */
  readonly amount: number;
  /** Barème avant plafond. */
  readonly baseAmount: number;
}

export interface CrownsRewardPlan {
  readonly rewards: readonly PlannedCrownsReward[];
  readonly total: number;
}

function compareSheets(a: SheetRewardCandidate, b: SheetRewardCandidate): number {
  const byDate = a.validatedAt.getTime() - b.validatedAt.getTime();
  if (byDate !== 0) return byDate;
  if (a.sheetId !== b.sheetId) return a.sheetId < b.sheetId ? -1 : 1;
  return a.sourceKey < b.sourceKey ? -1 : a.sourceKey > b.sourceKey ? 1 : 0;
}

function compareKeys(a: { sourceKey: string }, b: { sourceKey: string }): number {
  return a.sourceKey < b.sourceKey ? -1 : a.sourceKey > b.sourceKey ? 1 : 0;
}

/**
 * Plan d'un passage : les candidats NON encore au registre deviennent des
 * récompenses. `earnedByPeriod` donne, par période, ce qui a DÉJÀ été versé
 * pour des feuilles. Le plafond s'applique dans un ordre déterministe (date de
 * validation, puis id de feuille, puis côté) : à entrée égale, plan égal.
 * Succès et bonus de bienvenue sont hors plafond.
 */
export function planCrownsRewards(
  candidates: readonly CrownsRewardCandidate[],
  earnedByPeriod: ReadonlyMap<string, number>,
  schedule: CrownsRewardSchedule = DEFAULT_CROWNS_REWARD_SCHEDULE,
): CrownsRewardPlan {
  const signups = candidates
    .filter((c): c is SignupRewardCandidate => c.kind === "signup")
    .sort(compareKeys);
  const achievements = candidates
    .filter((c): c is AchievementRewardCandidate => c.kind === "achievement")
    .sort(compareKeys);
  const sheets = candidates
    .filter((c): c is SheetRewardCandidate => c.kind === "sheet")
    .sort(compareSheets);

  const rewards: PlannedCrownsReward[] = [];

  for (const c of signups) {
    rewards.push({
      sourceKey: c.sourceKey,
      kind: "signup",
      periodKey: null,
      amount: c.alreadyGranted ? 0 : schedule.signup,
      baseAmount: schedule.signup,
    });
  }

  for (const c of achievements) {
    rewards.push({
      sourceKey: c.sourceKey,
      kind: "achievement",
      periodKey: null,
      amount: schedule.achievement,
      baseAmount: schedule.achievement,
    });
  }

  const earned = new Map(earnedByPeriod);
  for (const c of sheets) {
    const already = earned.get(c.periodKey) ?? 0;
    const remaining = Math.max(0, schedule.seasonSheetCap - already);
    const amount = Math.min(schedule.sheet, remaining);
    earned.set(c.periodKey, already + amount);
    rewards.push({
      sourceKey: c.sourceKey,
      kind: "sheet",
      periodKey: c.periodKey,
      amount,
      baseAmount: schedule.sheet,
    });
  }

  const total = rewards.reduce((sum, r) => sum + r.amount, 0);
  return { rewards, total };
}

export interface CrownsRewardBreakdown {
  /** Feuilles ayant rapporté quelque chose. */
  readonly sheets: number;
  /** Succès ayant rapporté. */
  readonly achievements: number;
  /** Bonus de bienvenue versé dans ce passage. */
  readonly signup: boolean;
  /** Feuilles tronquées ou annulées par le plafond. */
  readonly capped: number;
}

/** Détail d'un passage, tel que servi au journal du coach. */
export function summarizeCrownsRewards(
  rows: ReadonlyArray<{ kind: string; amount: number; baseAmount: number }>,
): CrownsRewardBreakdown {
  let sheets = 0;
  let achievements = 0;
  let signup = false;
  let capped = 0;
  for (const r of rows) {
    if (r.kind === "sheet") {
      if (r.amount > 0) sheets += 1;
      if (r.amount < r.baseAmount) capped += 1;
    } else if (r.kind === "achievement" && r.amount > 0) {
      achievements += 1;
    } else if (r.kind === "signup" && r.amount > 0) {
      signup = true;
    }
  }
  return { sheets, achievements, signup, capped };
}
