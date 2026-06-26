/**
 * Lot G — Service de feuille de match v2.
 *
 * Gere le cycle de vie collaboratif d'une feuille de match :
 *   draft -> submitted_home/away -> both_submitted -> validated
 *   (-> invalidated dans la fenetre de correction).
 *
 * Responsabilites G.1 (ce fichier) :
 *   - createMatchSheet (lazy, a l'ouverture de la feuille) ;
 *   - addEvent / removeEvent (journal) ;
 *   - updatePreMatch (meteo, popularite, inducements, prieres) ;
 *   - submitByCoach / unsubmitByCoach (saisie joueur) ;
 *   - validateByCommissioner (fige le score derive ; l'application des
 *     effets sur le classement est branchee en G.2).
 *
 * L'autorisation fine (coach home/away vs commissaire) est resolue ici
 * en lisant le pairing : owner des teams home/away + creator de la ligue.
 * Le summarizer pur (`league-match-summary`) derive score + blesses.
 */

import { prisma } from "../prisma";
import {
  summarizeMatchSheet,
  isMatchEventKind,
  computeWinnings,
  type MatchEventInput,
  type MatchSummary,
  type InjurySeverity,
} from "./league-match-summary";
import {
  recordOfflineLeagueResult,
  type OfflinePlayerStatInput,
  type OfflineInjuryInput,
  type OfflineInjuryType,
} from "./league-offline-result";
import { parsePurchases } from "./league-offline-purchases";
import { reverseOfflineLeagueResult } from "./league-offline-edit";
import { recordForfeit } from "./league-forfeit";
import { sendLeagueMatchValidationPush } from "./push-notifications";
import { serverLog } from "../utils/server-log";
import {
  WEATHER_TYPES,
  INDUCEMENT_CATALOGUE,
  calculatePettyCash,
  getInducementCost,
  getAvailableStarPlayers,
  getRegionalRulesForTeam,
  APOTHECARY_FORBIDDEN_ROSTERS,
  getTeamColors,
  TEAM_ROSTERS,
} from "@bb/game-engine";

export type MatchSheetStatus =
  | "draft"
  | "submitted_home"
  | "submitted_away"
  | "both_submitted"
  | "validated"
  | "invalidated";

export class MatchSheetError extends Error {
  constructor(
    public readonly code:
      | "pairing_not_found"
      | "sheet_not_found"
      | "forbidden"
      | "not_a_participant"
      | "already_validated"
      | "not_validated"
      | "invalid_status"
      | "invalid_event"
      | "event_not_found"
      | "invalidation_window_closed"
      | "invalidation_failed"
      | "inducement_over_budget",
    message: string,
  ) {
    super(message);
    this.name = "MatchSheetError";
  }
}

export type CoachSide = "home" | "away";

interface PairingContext {
  pairingId: string;
  leagueId: string;
  creatorId: string;
  homeOwnerId: string;
  awayOwnerId: string;
}

/**
 * Resout le contexte d'autorisation d'un pairing : ligue, commissaire,
 * owners des deux equipes. Source unique pour tous les checks de role.
 */
async function loadPairingContext(
  pairingId: string,
): Promise<PairingContext> {
  const pairing = (await prisma.leaguePairing.findUnique({
    where: { id: pairingId },
    select: {
      id: true,
      round: {
        select: {
          season: {
            select: { league: { select: { id: true, creatorId: true } } },
          },
        },
      },
      homeParticipant: { select: { team: { select: { ownerId: true } } } },
      awayParticipant: { select: { team: { select: { ownerId: true } } } },
    },
  })) as {
    id: string;
    round: { season: { league: { id: string; creatorId: string } } };
    homeParticipant: { team: { ownerId: string } } | null;
    awayParticipant: { team: { ownerId: string } } | null;
  } | null;

  if (!pairing) {
    throw new MatchSheetError(
      "pairing_not_found",
      `Pairing introuvable: ${pairingId}`,
    );
  }
  const league = pairing.round.season.league;
  return {
    pairingId: pairing.id,
    leagueId: league.id,
    creatorId: league.creatorId,
    homeOwnerId: pairing.homeParticipant?.team.ownerId ?? "",
    awayOwnerId: pairing.awayParticipant?.team.ownerId ?? "",
  };
}

/** Determine le cote (home/away) d'un coach, ou null s'il n'est pas joueur. */
function coachSide(ctx: PairingContext, userId: string): CoachSide | null {
  if (userId === ctx.homeOwnerId) return "home";
  if (userId === ctx.awayOwnerId) return "away";
  return null;
}

function isCommissioner(ctx: PairingContext, userId: string): boolean {
  return userId === ctx.creatorId;
}

/**
 * Crée (ou retourne) la feuille de match d'un pairing. Idempotent :
 * si elle existe deja, on la retourne. Accessible aux 2 coachs + au
 * commissaire.
 */
export async function createMatchSheet(input: {
  pairingId: string;
  userId: string;
}) {
  const ctx = await loadPairingContext(input.pairingId);
  const side = coachSide(ctx, input.userId);
  if (!side && !isCommissioner(ctx, input.userId)) {
    throw new MatchSheetError(
      "not_a_participant",
      "Seuls les 2 coachs et le commissaire peuvent ouvrir la feuille",
    );
  }
  const existing = await prisma.leagueMatchSheet.findUnique({
    where: { pairingId: input.pairingId },
  });
  if (existing) return existing;

  return prisma.leagueMatchSheet.create({
    data: { pairingId: input.pairingId, status: "draft" },
  });
}

async function loadSheetOrThrow(pairingId: string) {
  const sheet = await prisma.leagueMatchSheet.findUnique({
    where: { pairingId },
  });
  if (!sheet) {
    throw new MatchSheetError(
      "sheet_not_found",
      "Feuille de match inexistante (ouvrez-la d'abord)",
    );
  }
  return sheet;
}

function ensureEditable(status: string): void {
  if (status === "validated") {
    throw new MatchSheetError(
      "already_validated",
      "Feuille validee : editez via invalidation (commissaire)",
    );
  }
}

/** Ajoute un evenement au journal. Coachs + commissaire, avant validation. */
export async function addEvent(input: {
  pairingId: string;
  userId: string;
  event: MatchEventInput & {
    meta?: Record<string, unknown> | null;
    /** Mi-temps (1|2) — fusionnee dans meta.half. */
    half?: number | null;
    /** Tour (1..16) — fusionne dans meta.turn. */
    turn?: number | null;
  };
}) {
  const ctx = await loadPairingContext(input.pairingId);
  const side = coachSide(ctx, input.userId);
  if (!side && !isCommissioner(ctx, input.userId)) {
    throw new MatchSheetError("forbidden", "Action reservee aux participants");
  }
  if (!isMatchEventKind(input.event.kind)) {
    throw new MatchSheetError(
      "invalid_event",
      `Type d'evenement invalide: ${String(input.event.kind)}`,
    );
  }
  const sheet = await loadSheetOrThrow(input.pairingId);
  ensureEditable(sheet.status);

  // Mi-temps / tour : portes via meta (pas de colonne dediee). On fusionne
  // les champs explicites half/turn dans meta sans ecraser un meta fourni.
  const baseMeta =
    input.event.meta && typeof input.event.meta === "object"
      ? { ...input.event.meta }
      : {};
  if (input.event.half != null) baseMeta.half = input.event.half;
  if (input.event.turn != null) baseMeta.turn = input.event.turn;
  const meta = Object.keys(baseMeta).length > 0 ? baseMeta : undefined;

  return prisma.leagueMatchEvent.create({
    data: {
      matchSheetId: sheet.id,
      kind: input.event.kind,
      team: input.event.team ?? null,
      actorPlayerId: input.event.actorPlayerId ?? null,
      targetPlayerId: input.event.targetPlayerId ?? null,
      causeDetail: input.event.causeDetail ?? null,
      injurySeverity: (input.event.injurySeverity as string | null) ?? null,
      meta: meta as object | undefined,
    },
  });
}

/** Supprime un evenement (correction de saisie). */
export async function removeEvent(input: {
  pairingId: string;
  userId: string;
  eventId: string;
}) {
  const ctx = await loadPairingContext(input.pairingId);
  if (
    !coachSide(ctx, input.userId) &&
    !isCommissioner(ctx, input.userId)
  ) {
    throw new MatchSheetError("forbidden", "Action reservee aux participants");
  }
  const sheet = await loadSheetOrThrow(input.pairingId);
  ensureEditable(sheet.status);

  const ev = await prisma.leagueMatchEvent.findUnique({
    where: { id: input.eventId },
    select: { id: true, matchSheetId: true },
  });
  if (!ev || ev.matchSheetId !== sheet.id) {
    throw new MatchSheetError("event_not_found", "Evenement introuvable");
  }
  await prisma.leagueMatchEvent.delete({ where: { id: input.eventId } });
  return { deleted: true };
}

export interface PreMatchPayload {
  weatherTable?: string | null;
  weather?: string | null;
  popularityHome?: number | null;
  popularityAway?: number | null;
  forfeitSide?: "home" | "away" | null;
  inducementsHome?: unknown;
  inducementsAway?: unknown;
  prayersHome?: unknown;
  prayersAway?: unknown;
}

/** Met a jour les infos d'avant-match. */
export async function updatePreMatch(input: {
  pairingId: string;
  userId: string;
  payload: PreMatchPayload;
}) {
  const ctx = await loadPairingContext(input.pairingId);
  if (
    !coachSide(ctx, input.userId) &&
    !isCommissioner(ctx, input.userId)
  ) {
    throw new MatchSheetError("forbidden", "Action reservee aux participants");
  }
  const sheet = await loadSheetOrThrow(input.pairingId);
  ensureEditable(sheet.status);

  const p = input.payload;

  // Coups de pouce : on borne la depense au budget officiel (petty cash +
  // tresorerie). Le petty cash depend des 2 CTV -> on charge les equipes et
  // calcule le budget une seule fois si une selection est presente.
  if (p.inducementsHome !== undefined || p.inducementsAway !== undefined) {
    const teams = await loadSheetTeams(input.pairingId);
    const { budget } = buildMatchSheetReference(teams);
    if (p.inducementsHome !== undefined) {
      const spent = sumGold(p.inducementsHome);
      if (spent > budget.home.maxBudget) {
        throw new MatchSheetError(
          "inducement_over_budget",
          `Budget de coups de pouce dépassé (domicile) : ${spent.toLocaleString("fr-FR")} po pour un budget de ${budget.home.maxBudget.toLocaleString("fr-FR")} po (petty cash ${budget.home.pettyCash.toLocaleString("fr-FR")} + trésorerie ${budget.home.treasury.toLocaleString("fr-FR")}).`,
        );
      }
    }
    if (p.inducementsAway !== undefined) {
      const spent = sumGold(p.inducementsAway);
      if (spent > budget.away.maxBudget) {
        throw new MatchSheetError(
          "inducement_over_budget",
          `Budget de coups de pouce dépassé (extérieur) : ${spent.toLocaleString("fr-FR")} po pour un budget de ${budget.away.maxBudget.toLocaleString("fr-FR")} po (petty cash ${budget.away.pettyCash.toLocaleString("fr-FR")} + trésorerie ${budget.away.treasury.toLocaleString("fr-FR")}).`,
        );
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (p.weatherTable !== undefined) data.weatherTable = p.weatherTable;
  if (p.weather !== undefined) data.weather = p.weather;
  if (p.forfeitSide !== undefined) data.forfeitSide = p.forfeitSide;
  if (p.popularityHome !== undefined) {
    data.popularityHome = p.popularityHome;
    // Polish — auto-calcul du gain de tresorerie depuis le facteur de
    // popularite (override manuel possible cote post-match).
    data.winningsHome = computeWinnings(p.popularityHome);
  }
  if (p.popularityAway !== undefined) {
    data.popularityAway = p.popularityAway;
    data.winningsAway = computeWinnings(p.popularityAway);
  }
  if (p.inducementsHome !== undefined) data.inducementsHome = p.inducementsHome ?? undefined;
  if (p.inducementsAway !== undefined) data.inducementsAway = p.inducementsAway ?? undefined;
  if (p.prayersHome !== undefined) data.prayersHome = p.prayersHome ?? undefined;
  if (p.prayersAway !== undefined) data.prayersAway = p.prayersAway ?? undefined;

  return prisma.leagueMatchSheet.update({
    where: { id: sheet.id },
    data,
  });
}

export interface PostMatchPayload {
  /** Override manuel du gain de tresorerie (prioritaire sur l'auto). */
  winningsHomeManual?: number | null;
  winningsAwayManual?: number | null;
  /** Variation de fans devoues (-1/0/+1 typiquement, clampe a la validation). */
  dedicatedFansDeltaHome?: number | null;
  dedicatedFansDeltaAway?: number | null;
  /** Bonus au classement (points) accorde par le commissaire. */
  rankingBonusHome?: number | null;
  rankingBonusAway?: number | null;
  /** SPP bonus "Nuffle" par joueur : [{ playerId, spp }]. */
  sppBonus?: unknown;
  /** Erreurs couteuses : [{ playerId?, cost, reason }]. */
  costlyErrorsHome?: unknown;
  costlyErrorsAway?: unknown;
  /** Achats post-match : [{ kind, name, cost }]. */
  purchasesHome?: unknown;
  purchasesAway?: unknown;
  /** Joueurs du match (MVP) : [playerId]. */
  motmPlayerIds?: readonly string[];
  /** Licenciements de fin de match : [teamPlayerId]. */
  firedPlayerIds?: readonly string[] | null;
}

/**
 * Polish — Met a jour les infos d'apres-match (override tresorerie,
 * fans, erreurs couteuses, achats, MVP). Coachs + commissaire, avant
 * validation.
 */
export async function updatePostMatch(input: {
  pairingId: string;
  userId: string;
  payload: PostMatchPayload;
}) {
  const ctx = await loadPairingContext(input.pairingId);
  if (
    !coachSide(ctx, input.userId) &&
    !isCommissioner(ctx, input.userId)
  ) {
    throw new MatchSheetError("forbidden", "Action reservee aux participants");
  }
  const sheet = await loadSheetOrThrow(input.pairingId);
  ensureEditable(sheet.status);

  const p = input.payload;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (p.winningsHomeManual !== undefined)
    data.winningsHomeManual = p.winningsHomeManual;
  if (p.winningsAwayManual !== undefined)
    data.winningsAwayManual = p.winningsAwayManual;
  if (p.dedicatedFansDeltaHome !== undefined)
    data.dedicatedFansDeltaHome = p.dedicatedFansDeltaHome;
  if (p.dedicatedFansDeltaAway !== undefined)
    data.dedicatedFansDeltaAway = p.dedicatedFansDeltaAway;
  if (p.rankingBonusHome !== undefined)
    data.rankingBonusHome = p.rankingBonusHome;
  if (p.rankingBonusAway !== undefined)
    data.rankingBonusAway = p.rankingBonusAway;
  if (p.sppBonus !== undefined) data.sppBonus = p.sppBonus ?? undefined;
  if (p.costlyErrorsHome !== undefined)
    data.costlyErrorsHome = p.costlyErrorsHome ?? undefined;
  if (p.costlyErrorsAway !== undefined)
    data.costlyErrorsAway = p.costlyErrorsAway ?? undefined;
  if (p.purchasesHome !== undefined)
    data.purchasesHome = p.purchasesHome ?? undefined;
  if (p.purchasesAway !== undefined)
    data.purchasesAway = p.purchasesAway ?? undefined;
  if (p.motmPlayerIds !== undefined)
    data.motmPlayerIds = [...p.motmPlayerIds];
  if (p.firedPlayerIds !== undefined)
    data.firedPlayerIds = [...(p.firedPlayerIds ?? [])];

  return prisma.leagueMatchSheet.update({
    where: { id: sheet.id },
    data,
  });
}

function nextStatusOnSubmit(
  current: string,
  side: CoachSide,
): MatchSheetStatus {
  // home submit
  if (side === "home") {
    if (current === "submitted_away") return "both_submitted";
    return "submitted_home";
  }
  // away submit
  if (current === "submitted_home") return "both_submitted";
  return "submitted_away";
}

/**
 * Un coach valide sa saisie. Met a jour `submittedByHomeAt/AwayAt` et
 * transitionne le status. Quand les 2 ont valide -> `both_submitted`
 * (le commissaire sera notifie en G.H/Lot H).
 */
export async function submitByCoach(input: {
  pairingId: string;
  userId: string;
}) {
  const ctx = await loadPairingContext(input.pairingId);
  const side = coachSide(ctx, input.userId);
  if (!side) {
    throw new MatchSheetError(
      "not_a_participant",
      "Seuls les 2 coachs peuvent soumettre leur saisie",
    );
  }
  const sheet = await loadSheetOrThrow(input.pairingId);
  if (sheet.status === "validated") {
    throw new MatchSheetError("already_validated", "Feuille deja validee");
  }

  const next = nextStatusOnSubmit(sheet.status, side);
  const updated = await prisma.leagueMatchSheet.update({
    where: { id: sheet.id },
    data: {
      status: next,
      ...(side === "home"
        ? { submittedByHomeAt: new Date() }
        : { submittedByAwayAt: new Date() }),
    },
  });

  // Lot H — quand les 2 coachs ont soumis, alerte le commissaire
  // (fire-and-forget, non-bloquant). On a deja `ctx` (creator + teams).
  if (next === "both_submitted") {
    notifyCommissionerSheetReady(ctx).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : "unknown";
      serverLog.error(`[league-match-sheet] notify commissioner failed: ${msg}`);
    });
  }

  return updated;
}

/**
 * Lot H — Resout les noms d'equipe et declenche le push commissaire.
 * Isole pour rester testable / non-bloquant.
 */
async function notifyCommissionerSheetReady(
  ctx: PairingContext,
): Promise<void> {
  const pairing = (await prisma.leaguePairing.findUnique({
    where: { id: ctx.pairingId },
    select: {
      homeParticipant: { select: { team: { select: { name: true } } } },
      awayParticipant: { select: { team: { select: { name: true } } } },
    },
  })) as {
    homeParticipant: { team: { name: string } } | null;
    awayParticipant: { team: { name: string } } | null;
  } | null;
  sendLeagueMatchValidationPush({
    commissionerUserId: ctx.creatorId,
    leagueId: ctx.leagueId,
    pairingId: ctx.pairingId,
    homeTeamName: pairing?.homeParticipant?.team.name ?? "?",
    awayTeamName: pairing?.awayParticipant?.team.name ?? "?",
  });
}

/** Un coach retire sa soumission (revient en arriere). */
export async function unsubmitByCoach(input: {
  pairingId: string;
  userId: string;
}) {
  const ctx = await loadPairingContext(input.pairingId);
  const side = coachSide(ctx, input.userId);
  if (!side) {
    throw new MatchSheetError("not_a_participant", "Reserve aux coachs");
  }
  const sheet = await loadSheetOrThrow(input.pairingId);
  if (sheet.status === "validated") {
    throw new MatchSheetError("already_validated", "Feuille deja validee");
  }

  // Determine le status apres retrait : si l'autre coach a soumis,
  // on retombe sur son submitted_*, sinon draft.
  const homeStill = side === "home" ? false : sheet.submittedByHomeAt != null;
  const awayStill = side === "away" ? false : sheet.submittedByAwayAt != null;
  const next: MatchSheetStatus = homeStill
    ? "submitted_home"
    : awayStill
      ? "submitted_away"
      : "draft";

  return prisma.leagueMatchSheet.update({
    where: { id: sheet.id },
    data: {
      status: next,
      ...(side === "home"
        ? { submittedByHomeAt: null }
        : { submittedByAwayAt: null }),
    },
  });
}

/**
 * Lot G.2 — Mappe la severite du summarizer vers le type de blessure
 * du pipeline offline. `badly_hurt` n'a pas d'effet durable (BB) ⇒
 * non mappe. `stat_loss` necessite la carac visee : on la lit dans
 * `meta.stat` (ma/st/ag/pa/av), sinon la blessure est ignoree.
 */
function mapInjurySeverity(
  severity: InjurySeverity,
  metaStat: string | null,
): OfflineInjuryType | null {
  switch (severity) {
    case "mng":
      return "mng";
    case "niggling":
      return "niggling";
    case "dead":
      return "dead";
    case "stat_loss": {
      const stat = (metaStat ?? "").toLowerCase();
      if (
        stat === "ma" ||
        stat === "st" ||
        stat === "ag" ||
        stat === "pa" ||
        stat === "av"
      ) {
        return stat as OfflineInjuryType;
      }
      return null;
    }
    case "badly_hurt":
    default:
      return null;
  }
}

/**
 * Lot G.2 — Construit l'input du pipeline offline a partir du summary
 * derive + des champs de la feuille (winnings override, fans, MVP).
 * Pur (testable). Les statLines portent deja le `side` ; le pipeline
 * offline resout l'equipe via le teamPlayerId.
 */
/**
 * Somme tolerante des couts (or) d'une liste JSON `[{ cost, qty? }]`
 * (coups de pouce / erreurs couteuses / achats). Accepte array natif (PG)
 * ou string serialisee (sqlite mirror). Ignore les entrees illisibles.
 */
function sumGold(raw: unknown): number {
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      return 0;
    }
  }
  if (!Array.isArray(arr)) return 0;
  let total = 0;
  for (const entry of arr) {
    if (!entry || typeof entry !== "object") continue;
    const cost = (entry as { cost?: unknown }).cost;
    const qty = (entry as { qty?: unknown }).qty;
    const c = typeof cost === "number" && Number.isFinite(cost) ? cost : 0;
    const q = typeof qty === "number" && Number.isFinite(qty) && qty > 0 ? qty : 1;
    total += Math.max(0, Math.floor(c)) * q;
  }
  return total;
}

export function buildOfflineInputFromSummary(
  pairingId: string,
  summary: MatchSummary,
  sheet: {
    motmPlayerIds?: unknown;
    /** Polish — gain auto calcule (depuis popularite). */
    winningsHome?: number | null;
    winningsAway?: number | null;
    /** Override manuel commissaire (prioritaire). */
    winningsHomeManual?: number | null;
    winningsAwayManual?: number | null;
    dedicatedFansDeltaHome?: number | null;
    dedicatedFansDeltaAway?: number | null;
    /** Bonus au classement (points) commissaire. */
    rankingBonusHome?: number | null;
    rankingBonusAway?: number | null;
    /** SPP bonus "Nuffle" par joueur : [{ playerId, spp }]. */
    sppBonus?: unknown;
    /** Depenses post/avant-match (debit treasury). */
    inducementsHome?: unknown;
    inducementsAway?: unknown;
    costlyErrorsHome?: unknown;
    costlyErrorsAway?: unknown;
    purchasesHome?: unknown;
    purchasesAway?: unknown;
    /** Licenciements de fin de match : [teamPlayerId]. */
    firedPlayerIds?: unknown;
  },
  eventsForMeta: ReadonlyArray<MatchEventInput & { meta?: unknown }>,
  /**
   * Petty cash recu par chaque equipe (regles BB). Les coups de pouce sont
   * d'abord payes avec le petty cash : seul l'excedent debite la tresorerie.
   * Defaut 0/0 (retro-compat) : tout le cout des coups de pouce debite alors
   * la tresorerie comme avant.
   */
  pettyCash: { home: number; away: number } = { home: 0, away: 0 },
) {
  const motm = parseStringArray(sheet.motmPlayerIds);
  const motmSet = new Set(motm);

  const playerStats: OfflinePlayerStatInput[] = summary.playerStats.map(
    (p) => ({
      teamPlayerId: p.playerId,
      touchdowns: p.touchdowns,
      casualties: p.casualtiesInflicted,
      completions: p.completions,
      interceptions: p.interceptions,
      mvp: motmSet.has(p.playerId),
    }),
  );

  // Les MVP sans stat-line (joueur primé sans event) doivent quand meme
  // recevoir le flag mvp -> on les ajoute.
  for (const id of motm) {
    if (!playerStats.some((p) => p.teamPlayerId === id)) {
      playerStats.push({ teamPlayerId: id, mvp: true });
    }
  }

  // Map stat de blessure via meta de l'event source (best-effort : on
  // associe par targetPlayerId+severity au 1er event matchant).
  const injuries: OfflineInjuryInput[] = [];
  for (const inj of summary.injuries) {
    const src = eventsForMeta.find(
      (e) =>
        e.targetPlayerId === inj.playerId &&
        (e.injurySeverity as string | null) === inj.severity,
    );
    const metaStat =
      src && src.meta && typeof src.meta === "object"
        ? ((src.meta as Record<string, unknown>).stat as string | undefined) ??
          null
        : null;
    const type = mapInjurySeverity(inj.severity, metaStat);
    if (type) {
      injuries.push({ teamPlayerId: inj.playerId, type });
    }
  }

  return {
    pairingId,
    scoreHome: summary.scoreHome,
    scoreAway: summary.scoreAway,
    casualtiesHome: summary.casualtiesHome,
    casualtiesAway: summary.casualtiesAway,
    playerStats,
    // Polish — override manuel prioritaire, sinon gain auto-calcule.
    winningsHome: sheet.winningsHomeManual ?? sheet.winningsHome ?? undefined,
    winningsAway: sheet.winningsAwayManual ?? sheet.winningsAway ?? undefined,
    // Depenses = coups de pouce + erreurs couteuses + achats -> debit treasury.
    // Les coups de pouce sont d'abord couverts par le petty cash : seul
    // l'excedent debite la tresorerie (regle officielle BB).
    treasuryDebitHome:
      Math.max(0, sumGold(sheet.inducementsHome) - pettyCash.home) +
      sumGold(sheet.costlyErrorsHome) +
      sumGold(sheet.purchasesHome),
    treasuryDebitAway:
      Math.max(0, sumGold(sheet.inducementsAway) - pettyCash.away) +
      sumGold(sheet.costlyErrorsAway) +
      sumGold(sheet.purchasesAway),
    dedicatedFansDeltaHome: sheet.dedicatedFansDeltaHome ?? undefined,
    dedicatedFansDeltaAway: sheet.dedicatedFansDeltaAway ?? undefined,
    rankingBonusHome: sheet.rankingBonusHome ?? undefined,
    rankingBonusAway: sheet.rankingBonusAway ?? undefined,
    sppBonus: parseSppBonus(sheet.sppBonus),
    injuries,
    // Achats -> materialisation roster (le debit treasury est deja porte
    // par treasuryDebit ci-dessus : pas de double-debit).
    purchasesHome: parsePurchases(sheet.purchasesHome),
    purchasesAway: parsePurchases(sheet.purchasesAway),
    // Licenciements -> firedAt (retire du roster actif, reversible).
    firedPlayerIds: parseStringArray(sheet.firedPlayerIds),
  };
}

/**
 * Parse tolerant du SPP bonus stocke (array PG / string sqlite) :
 * [{ playerId, spp }] -> [{ teamPlayerId, spp }].
 */
function parseSppBonus(raw: unknown): Array<{ teamPlayerId: string; spp: number }> {
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  const out: Array<{ teamPlayerId: string; spp: number }> = [];
  for (const e of arr) {
    if (!e || typeof e !== "object") continue;
    const id = (e as { playerId?: unknown }).playerId;
    const spp = (e as { spp?: unknown }).spp;
    if (typeof id === "string" && typeof spp === "number" && Number.isFinite(spp)) {
      out.push({ teamPlayerId: id, spp: Math.floor(spp) });
    }
  }
  return out;
}

function parseStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((s): s is string => typeof s === "string");
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((s): s is string => typeof s === "string")
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Le commissaire valide la feuille.
 *
 * Lot G.2 — Applique les effets via `recordOfflineLeagueResult`
 * (classement W/D/L + points + bonus Lot E, SPP + level-up, blessures
 * durables, tresorerie, fans devoues, pairing -> played). Le pipeline
 * est idempotent : si le match a deja ete compte (skip), on marque
 * quand meme la feuille validee.
 *
 * Si l'application des effets echoue (throw), la feuille reste en
 * `both_submitted` et l'erreur est propagee — pas de validation
 * partielle.
 */
export async function validateByCommissioner(input: {
  pairingId: string;
  userId: string;
}): Promise<{
  sheet: unknown;
  summary: MatchSummary;
  effects: { applied: boolean; reason?: string };
}> {
  const ctx = await loadPairingContext(input.pairingId);
  if (!isCommissioner(ctx, input.userId)) {
    throw new MatchSheetError(
      "forbidden",
      "Seul le commissaire peut valider la feuille",
    );
  }
  const sheet = await loadSheetOrThrow(input.pairingId);
  if (sheet.status === "validated") {
    throw new MatchSheetError("already_validated", "Feuille deja validee");
  }

  const events = (await prisma.leagueMatchEvent.findMany({
    where: { matchSheetId: sheet.id },
    orderBy: { occurredAt: "asc" },
  })) as Array<MatchEventInput & { meta?: unknown }>;
  const summary = summarizeMatchSheet(events);

  // Forfait declare a l'avant-match : on route vers recordForfeit (le cote
  // adverse gagne 2-0, bareme forfeit) au lieu de la saisie normale. Pas de
  // SPP/tresorerie : un match forfait n'a pas de stats.
  const forfeitSide = (sheet as { forfeitSide?: string | null }).forfeitSide;
  if (forfeitSide === "home" || forfeitSide === "away") {
    const ff = await recordForfeit({
      pairingId: input.pairingId,
      side: forfeitSide,
    });
    const updatedFf = await prisma.leagueMatchSheet.update({
      where: { id: sheet.id },
      data: {
        status: "validated",
        validatedAt: new Date(),
        validatedById: input.userId,
        scoreHome: forfeitSide === "home" ? 0 : 2,
        scoreAway: forfeitSide === "away" ? 0 : 2,
      },
    });
    return {
      sheet: updatedFf,
      summary,
      effects: { applied: "recorded" in ff && ff.recorded },
    };
  }

  // Petty cash par equipe (regles BB) : sert a ne debiter la tresorerie que
  // de l'excedent de coups de pouce au-dela du petty cash recu.
  const teamsForBudget = await loadSheetTeams(input.pairingId);
  const { budget } = buildMatchSheetReference(teamsForBudget);

  // Applique les effets (peut throw -> on ne valide pas).
  const offlineInput = buildOfflineInputFromSummary(
    input.pairingId,
    summary,
    sheet as {
      motmPlayerIds?: unknown;
      winningsHome?: number | null;
      winningsAway?: number | null;
      winningsHomeManual?: number | null;
      winningsAwayManual?: number | null;
      dedicatedFansDeltaHome?: number | null;
      dedicatedFansDeltaAway?: number | null;
      rankingBonusHome?: number | null;
      rankingBonusAway?: number | null;
      sppBonus?: unknown;
      inducementsHome?: unknown;
      inducementsAway?: unknown;
      costlyErrorsHome?: unknown;
      costlyErrorsAway?: unknown;
      purchasesHome?: unknown;
      purchasesAway?: unknown;
      firedPlayerIds?: unknown;
    },
    events,
    { home: budget.home.pettyCash, away: budget.away.pettyCash },
  );
  const outcome = await recordOfflineLeagueResult(offlineInput);

  let effects: { applied: boolean; reason?: string };
  if ("recorded" in outcome && outcome.recorded) {
    effects = { applied: true };
  } else if ("skipped" in outcome) {
    // already-scored / not-terminal-eligible : effets deja en place.
    effects = { applied: false, reason: outcome.reason };
    serverLog.info(
      `[league-match-sheet] validate: offline skipped (${outcome.reason}) pairing=${input.pairingId}`,
    );
  } else {
    effects = { applied: false };
  }

  const updated = await prisma.leagueMatchSheet.update({
    where: { id: sheet.id },
    data: {
      status: "validated",
      validatedAt: new Date(),
      validatedById: input.userId,
      scoreHome: summary.scoreHome,
      scoreAway: summary.scoreAway,
    },
  });
  return { sheet: updated, summary, effects };
}

/**
 * Polish — Determine si la feuille validee peut encore etre invalidee.
 *
 * Regle : invalidation autorisee TANT QUE les 2 equipes n'ont pas
 * chacune rejoue un autre match (pairing `played`/`forfeit_*` a un
 * round ULTERIEUR). Des que les DEUX equipes ont enchaine, la fenetre
 * se ferme (le classement aval depend de ce resultat).
 *
 * Retourne `{ ok: true }` ou `{ ok: false, reason }`.
 */
export async function canInvalidateMatchSheet(input: {
  pairingId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const pairing = (await prisma.leaguePairing.findUnique({
    where: { id: input.pairingId },
    select: {
      id: true,
      homeParticipantId: true,
      awayParticipantId: true,
      round: { select: { seasonId: true, roundNumber: true } },
    },
  })) as {
    id: string;
    homeParticipantId: string;
    awayParticipantId: string;
    round: { seasonId: string; roundNumber: number };
  } | null;
  if (!pairing) return { ok: false, reason: "pairing_not_found" };

  const TERMINAL_PLAYED = ["played", "forfeit_home", "forfeit_away"];
  const laterPlayedFor = async (participantId: string): Promise<number> =>
    prisma.leaguePairing.count({
      where: {
        id: { not: pairing.id },
        status: { in: TERMINAL_PLAYED },
        round: {
          seasonId: pairing.round.seasonId,
          roundNumber: { gt: pairing.round.roundNumber },
        },
        OR: [
          { homeParticipantId: participantId },
          { awayParticipantId: participantId },
        ],
      },
    });

  const [homeLater, awayLater] = await Promise.all([
    laterPlayedFor(pairing.homeParticipantId),
    laterPlayedFor(pairing.awayParticipantId),
  ]);

  // Fenetre fermee uniquement si LES DEUX equipes ont rejoue.
  if (homeLater > 0 && awayLater > 0) {
    return { ok: false, reason: "both_teams_played_later" };
  }
  return { ok: true };
}

/**
 * Polish — Invalide une feuille validee (commissaire). Reverse les
 * effets via `reverseOfflineLeagueResult` (classement/SPP/treso/fans)
 * puis repasse la feuille en `invalidated` pour permettre une
 * correction. Respecte la fenetre `canInvalidateMatchSheet`.
 */
export async function invalidateMatchSheet(input: {
  pairingId: string;
  userId: string;
  reason?: string;
}) {
  const ctx = await loadPairingContext(input.pairingId);
  if (!isCommissioner(ctx, input.userId)) {
    throw new MatchSheetError(
      "forbidden",
      "Seul le commissaire peut invalider la feuille",
    );
  }
  const sheet = await loadSheetOrThrow(input.pairingId);
  if (sheet.status !== "validated") {
    throw new MatchSheetError(
      "not_validated",
      "Seule une feuille validee peut etre invalidee",
    );
  }

  const window = await canInvalidateMatchSheet({ pairingId: input.pairingId });
  if (!window.ok) {
    throw new MatchSheetError(
      "invalidation_window_closed",
      "Fenetre de correction fermee : les 2 equipes ont deja rejoue",
    );
  }

  // Retrouve le Match offline synthetique du pairing pour le reverser.
  const match = (await prisma.match.findFirst({
    where: { leaguePairingId: input.pairingId, leagueScoredAt: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  })) as { id: string } | null;

  if (match) {
    const reversed = await reverseOfflineLeagueResult(match.id);
    if ("skipped" in reversed) {
      // Reversion impossible (mort, saison cloturee, playoffs...) :
      // on refuse l'invalidation pour ne pas laisser un etat incoherent.
      throw new MatchSheetError(
        "invalidation_failed",
        `Reversion impossible: ${reversed.reason}`,
      );
    }
  }

  const updated = await prisma.leagueMatchSheet.update({
    where: { id: sheet.id },
    data: {
      status: "invalidated",
      invalidatedAt: new Date(),
      invalidationReason: input.reason ?? null,
    },
  });
  serverLog.info(
    `[league-match-sheet] invalidated pairing=${input.pairingId} by=${input.userId}`,
  );
  return { sheet: updated };
}

/**
 * Lot H — Liste des feuilles de match en attente de validation pour
 * un commissaire (status `both_submitted`). Source de la cloche de
 * notification + page "Matchs a valider".
 *
 * Filtre les pairings dont la ligue a `creatorId === userId`. Une
 * seule requete Prisma (nested filter), ordonnee par anciennete.
 */
export async function listPendingValidationsForCommissioner(
  userId: string,
): Promise<
  Array<{
    pairingId: string;
    matchSheetId: string;
    leagueId: string;
    leagueName: string;
    seasonId: string;
    seasonName: string;
    roundNumber: number;
    homeTeamName: string;
    awayTeamName: string;
    bothSubmittedAt: Date | null;
  }>
> {
  const sheets = (await prisma.leagueMatchSheet.findMany({
    where: {
      status: "both_submitted",
      pairing: {
        round: { season: { league: { creatorId: userId } } },
      },
    },
    orderBy: { updatedAt: "asc" },
    select: {
      id: true,
      pairingId: true,
      submittedByHomeAt: true,
      submittedByAwayAt: true,
      pairing: {
        select: {
          round: {
            select: {
              roundNumber: true,
              season: {
                select: {
                  id: true,
                  name: true,
                  league: { select: { id: true, name: true } },
                },
              },
            },
          },
          homeParticipant: { select: { team: { select: { name: true } } } },
          awayParticipant: { select: { team: { select: { name: true } } } },
        },
      },
    },
  })) as Array<{
    id: string;
    pairingId: string;
    submittedByHomeAt: Date | null;
    submittedByAwayAt: Date | null;
    pairing: {
      round: {
        roundNumber: number;
        season: {
          id: string;
          name: string;
          league: { id: string; name: string };
        };
      };
      homeParticipant: { team: { name: string } } | null;
      awayParticipant: { team: { name: string } } | null;
    };
  }>;

  return sheets.map((s) => {
    const home = s.submittedByHomeAt?.getTime() ?? 0;
    const away = s.submittedByAwayAt?.getTime() ?? 0;
    const bothMs = Math.max(home, away);
    return {
      pairingId: s.pairingId,
      matchSheetId: s.id,
      leagueId: s.pairing.round.season.league.id,
      leagueName: s.pairing.round.season.league.name,
      seasonId: s.pairing.round.season.id,
      seasonName: s.pairing.round.season.name,
      roundNumber: s.pairing.round.roundNumber,
      homeTeamName: s.pairing.homeParticipant?.team.name ?? "?",
      awayTeamName: s.pairing.awayParticipant?.team.name ?? "?",
      bothSubmittedAt: bothMs > 0 ? new Date(bothMs) : null,
    };
  });
}

/**
 * Lecture de la feuille + summary derive (pour l'UI). Accessible aux
 * 2 coachs + commissaire. Le summary est recalcule a chaque read
 * (cheap, pur) pour refleter l'etat courant des events.
 */
export interface MatchSheetPlayer {
  readonly id: string;
  readonly number: number;
  readonly name: string;
  readonly position: string;
  readonly dead: boolean;
  readonly missNextMatch: boolean;
  /** SPP courant + level brut (pour surfacer les level-up en attente). */
  readonly spp: number;
}

export interface MatchSheetTeam {
  readonly teamId: string;
  readonly name: string;
  readonly roster: string;
  /** Libelle de la race (ex: "Skavens"), resolu depuis le roster slug. */
  readonly raceName: string;
  /** Nom du coach (owner de l'equipe). */
  readonly coachName: string;
  /** VE — Valeur d'Equipe. */
  readonly teamValue: number;
  /** VEA — Valeur d'Equipe Actuelle (= CTV pour le calcul du petty cash). */
  readonly currentValue: number;
  /** Tresorerie (cagnotte) en po. */
  readonly treasury: number;
  readonly players: readonly MatchSheetPlayer[];
}

/** Libelle de race depuis un roster slug (fallback : le slug brut). */
function raceNameForRoster(roster: string): string {
  const def = (TEAM_ROSTERS as Record<string, { name?: string }>)[roster];
  return def?.name ?? roster;
}

/**
 * Charge les 2 equipes d'un pairing + leurs joueurs (pour alimenter les
 * pickers de l'UI : joueur du match, acteur/cible d'un event…). Les joueurs
 * morts sont inclus mais flagges (`dead`) pour l'affichage.
 */
async function loadSheetTeams(
  pairingId: string,
): Promise<{ home: MatchSheetTeam | null; away: MatchSheetTeam | null }> {
  const pairing = (await prisma.leaguePairing.findUnique({
    where: { id: pairingId },
    select: {
      homeParticipant: { select: { teamId: true } },
      awayParticipant: { select: { teamId: true } },
    },
  })) as {
    homeParticipant: { teamId: string } | null;
    awayParticipant: { teamId: string } | null;
  } | null;

  const teamIds = [
    pairing?.homeParticipant?.teamId,
    pairing?.awayParticipant?.teamId,
  ].filter((id): id is string => Boolean(id));

  if (teamIds.length === 0) return { home: null, away: null };

  const teams = (await prisma.team.findMany({
    where: { id: { in: teamIds } },
    select: {
      id: true,
      name: true,
      roster: true,
      teamValue: true,
      currentValue: true,
      treasury: true,
      owner: { select: { coachName: true } },
      players: {
        // Les joueurs licencies (firedAt) ne font plus partie du roster
        // actif : on les exclut des pickers (comme un retrait definitif). Les
        // morts restent inclus mais flagges.
        where: { firedAt: null },
        orderBy: { number: "asc" },
        select: {
          id: true,
          number: true,
          name: true,
          position: true,
          dead: true,
          missNextMatch: true,
          spp: true,
        },
      },
    },
  })) as Array<{
    id: string;
    name: string;
    roster: string;
    teamValue?: number | null;
    currentValue?: number | null;
    treasury?: number | null;
    owner?: { coachName?: string | null } | null;
    players: MatchSheetPlayer[];
  }>;

  const byId = new Map(teams.map((t) => [t.id, t]));
  const toTeam = (teamId?: string): MatchSheetTeam | null => {
    if (!teamId) return null;
    const t = byId.get(teamId);
    if (!t) return null;
    return {
      teamId: t.id,
      name: t.name,
      roster: t.roster,
      raceName: raceNameForRoster(t.roster),
      coachName: t.owner?.coachName ?? "",
      teamValue: t.teamValue ?? 0,
      currentValue: t.currentValue ?? 0,
      treasury: t.treasury ?? 0,
      players: t.players,
    };
  };
  return {
    home: toTeam(pairing?.homeParticipant?.teamId),
    away: toTeam(pairing?.awayParticipant?.teamId),
  };
}

/** Une condition meteo d'une table (resultat 2..12). */
export interface MatchSheetWeatherResult {
  readonly roll: number;
  readonly condition: string;
  readonly description: string;
}

export interface MatchSheetWeatherTable {
  readonly id: string;
  readonly name: string;
  readonly results: readonly MatchSheetWeatherResult[];
}

/** Entree du catalogue officiel de coups de pouce (hors star players). */
export interface MatchSheetInducementOption {
  readonly slug: string;
  readonly name: string;
  readonly cost: number;
  readonly maxQuantity: number;
  readonly description: string;
}

export interface MatchSheetStarPlayerOption {
  readonly slug: string;
  readonly name: string;
  readonly cost: number;
  readonly specialRule?: string;
}

/** Couleurs (hex) d'une equipe, derivees du roster. */
export interface MatchSheetTeamColors {
  readonly primary: string;
  readonly secondary: string;
}

/** Budget d'inducements d'une equipe (regles officielles BB). */
export interface MatchSheetTeamBudget {
  /** CTV = Valeur d'Equipe Actuelle. */
  readonly ctv: number;
  readonly treasury: number;
  /** Petty cash recu (difference de CTV si equipe la moins chere). */
  readonly pettyCash: number;
  /** Budget total dépensable = petty cash + tresorerie. */
  readonly maxBudget: number;
}

/**
 * Donnees de reference (catalogues) attachees a la feuille pour piloter
 * les selecteurs cote UI : tables meteo, catalogue de coups de pouce,
 * star players disponibles par equipe, et budget d'inducements par equipe.
 */
export interface MatchSheetReference {
  readonly weatherTables: readonly MatchSheetWeatherTable[];
  /** Coups de pouce accessibles PAR EQUIPE (filtres + cout selon le roster). */
  readonly inducements: {
    readonly home: readonly MatchSheetInducementOption[];
    readonly away: readonly MatchSheetInducementOption[];
  };
  readonly starPlayers: {
    readonly home: readonly MatchSheetStarPlayerOption[];
    readonly away: readonly MatchSheetStarPlayerOption[];
  };
  readonly budget: {
    readonly home: MatchSheetTeamBudget;
    readonly away: MatchSheetTeamBudget;
  };
  readonly colors: {
    readonly home: MatchSheetTeamColors;
    readonly away: MatchSheetTeamColors;
  };
}

/** Mappe les tables meteo du moteur vers la forme plate consommee par l'UI. */
function buildWeatherTables(): MatchSheetWeatherTable[] {
  return WEATHER_TYPES.map((t) => ({
    id: t.id,
    name: t.name,
    results: Object.entries(t.table)
      .map(([roll, c]) => ({
        roll: Number(roll),
        condition: c.condition,
        description: c.description,
      }))
      .sort((a, b) => a.roll - b.roll),
  }));
}

/**
 * Catalogue de coups de pouce ACCESSIBLES a une equipe : on filtre selon
 * `canPurchase` (apothicaire itinerant / Igor selon l'acces apothicaire du
 * roster) et on resout le cout effectif (rabais regional). `star_player`
 * est traite a part. Suit les regles officielles d'acces par equipe.
 */
function inducementOptionsFor(roster: string): MatchSheetInducementOption[] {
  const ctx = {
    teamId: "A" as const,
    regionalRules: getRegionalRulesForTeam(roster),
    hasApothecary: !APOTHECARY_FORBIDDEN_ROSTERS.has(roster),
    rosterSlug: roster,
  };
  return INDUCEMENT_CATALOGUE.filter((d) => d.slug !== "star_player")
    .filter((d) => !d.canPurchase || d.canPurchase(ctx))
    .map((d) => ({
      slug: d.slug,
      name: d.displayNameFr,
      cost: getInducementCost(d.slug, ctx),
      maxQuantity: d.maxQuantity,
      description: d.description,
    }));
}

/** Couleur 24 bits -> hex CSS (#rrggbb). */
function colorHex(n: number): string {
  return `#${(n & 0xffffff).toString(16).padStart(6, "0")}`;
}

function colorsFor(roster: string | undefined): MatchSheetTeamColors {
  const c = getTeamColors(roster);
  return { primary: colorHex(c.primary), secondary: colorHex(c.secondary) };
}

function starPlayersFor(roster: string): MatchSheetStarPlayerOption[] {
  return getAvailableStarPlayers(roster).map((s) => ({
    slug: s.slug,
    name: s.displayName,
    cost: s.cost,
    ...(s.specialRule ? { specialRule: s.specialRule } : {}),
  }));
}

/**
 * Construit le bloc de reference (catalogues + budgets) pour une feuille.
 * Le petty cash suit les regles BB : l'equipe a la CTV la plus basse recoit
 * la difference, puis chaque equipe peut puiser dans sa tresorerie.
 */
export function buildMatchSheetReference(teams: {
  home: MatchSheetTeam | null;
  away: MatchSheetTeam | null;
}): MatchSheetReference {
  const homeCtv = teams.home?.currentValue ?? 0;
  const awayCtv = teams.away?.currentValue ?? 0;
  const homeTreasury = teams.home?.treasury ?? 0;
  const awayTreasury = teams.away?.treasury ?? 0;

  const petty = calculatePettyCash({
    ctvTeamA: homeCtv,
    ctvTeamB: awayCtv,
    treasuryTeamA: homeTreasury,
    treasuryTeamB: awayTreasury,
  });

  return {
    weatherTables: buildWeatherTables(),
    inducements: {
      home: teams.home ? inducementOptionsFor(teams.home.roster) : [],
      away: teams.away ? inducementOptionsFor(teams.away.roster) : [],
    },
    starPlayers: {
      home: teams.home ? starPlayersFor(teams.home.roster) : [],
      away: teams.away ? starPlayersFor(teams.away.roster) : [],
    },
    colors: {
      home: colorsFor(teams.home?.roster),
      away: colorsFor(teams.away?.roster),
    },
    budget: {
      home: {
        ctv: homeCtv,
        treasury: homeTreasury,
        pettyCash: petty.teamA.pettyCash,
        maxBudget: petty.teamA.maxBudget,
      },
      away: {
        ctv: awayCtv,
        treasury: awayTreasury,
        pettyCash: petty.teamB.pettyCash,
        maxBudget: petty.teamB.maxBudget,
      },
    },
  };
}

export async function getMatchSheet(input: {
  pairingId: string;
  userId: string;
}): Promise<{
  sheet: unknown;
  summary: MatchSummary;
  viewerRole: "home" | "away" | "commissioner" | "none";
  teams: { home: MatchSheetTeam | null; away: MatchSheetTeam | null };
  reference: MatchSheetReference;
}> {
  const ctx = await loadPairingContext(input.pairingId);
  const side = coachSide(ctx, input.userId);
  const commissioner = isCommissioner(ctx, input.userId);
  const sheet = await prisma.leagueMatchSheet.findUnique({
    where: { pairingId: input.pairingId },
    include: { events: { orderBy: { occurredAt: "asc" } } },
  });
  if (!sheet) {
    throw new MatchSheetError("sheet_not_found", "Feuille inexistante");
  }
  const events = ((sheet as { events?: MatchEventInput[] }).events ??
    []) as MatchEventInput[];
  const teams = await loadSheetTeams(input.pairingId);
  return {
    sheet,
    summary: summarizeMatchSheet(events),
    teams,
    reference: buildMatchSheetReference(teams),
    viewerRole: commissioner
      ? "commissioner"
      : side === "home"
        ? "home"
        : side === "away"
          ? "away"
          : "none",
  };
}
