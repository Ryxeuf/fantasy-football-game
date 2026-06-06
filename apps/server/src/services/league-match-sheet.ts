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
import { serverLog } from "../utils/server-log";

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
      | "event_not_found",
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
  event: MatchEventInput & { meta?: Record<string, unknown> | null };
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

  return prisma.leagueMatchEvent.create({
    data: {
      matchSheetId: sheet.id,
      kind: input.event.kind,
      team: input.event.team ?? null,
      actorPlayerId: input.event.actorPlayerId ?? null,
      targetPlayerId: input.event.targetPlayerId ?? null,
      causeDetail: input.event.causeDetail ?? null,
      injurySeverity: (input.event.injurySeverity as string | null) ?? null,
      meta: (input.event.meta as object | null) ?? undefined,
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
  weather?: string | null;
  popularityHome?: number | null;
  popularityAway?: number | null;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (p.weather !== undefined) data.weather = p.weather;
  if (p.popularityHome !== undefined) data.popularityHome = p.popularityHome;
  if (p.popularityAway !== undefined) data.popularityAway = p.popularityAway;
  if (p.inducementsHome !== undefined) data.inducementsHome = p.inducementsHome ?? undefined;
  if (p.inducementsAway !== undefined) data.inducementsAway = p.inducementsAway ?? undefined;
  if (p.prayersHome !== undefined) data.prayersHome = p.prayersHome ?? undefined;
  if (p.prayersAway !== undefined) data.prayersAway = p.prayersAway ?? undefined;

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
  return prisma.leagueMatchSheet.update({
    where: { id: sheet.id },
    data: {
      status: next,
      ...(side === "home"
        ? { submittedByHomeAt: new Date() }
        : { submittedByAwayAt: new Date() }),
    },
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
export function buildOfflineInputFromSummary(
  pairingId: string,
  summary: MatchSummary,
  sheet: {
    motmPlayerIds?: unknown;
    winningsHomeManual?: number | null;
    winningsAwayManual?: number | null;
    dedicatedFansDeltaHome?: number | null;
    dedicatedFansDeltaAway?: number | null;
  },
  eventsForMeta: ReadonlyArray<MatchEventInput & { meta?: unknown }>,
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
    winningsHome: sheet.winningsHomeManual ?? undefined,
    winningsAway: sheet.winningsAwayManual ?? undefined,
    dedicatedFansDeltaHome: sheet.dedicatedFansDeltaHome ?? undefined,
    dedicatedFansDeltaAway: sheet.dedicatedFansDeltaAway ?? undefined,
    injuries,
  };
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

  // Applique les effets (peut throw -> on ne valide pas).
  const offlineInput = buildOfflineInputFromSummary(
    input.pairingId,
    summary,
    sheet as {
      motmPlayerIds?: unknown;
      winningsHomeManual?: number | null;
      winningsAwayManual?: number | null;
      dedicatedFansDeltaHome?: number | null;
      dedicatedFansDeltaAway?: number | null;
    },
    events,
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
 * Lecture de la feuille + summary derive (pour l'UI). Accessible aux
 * 2 coachs + commissaire. Le summary est recalcule a chaque read
 * (cheap, pur) pour refleter l'etat courant des events.
 */
export async function getMatchSheet(input: {
  pairingId: string;
  userId: string;
}): Promise<{
  sheet: unknown;
  summary: MatchSummary;
  viewerRole: "home" | "away" | "commissioner" | "none";
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
  return {
    sheet,
    summary: summarizeMatchSheet(events),
    viewerRole: commissioner
      ? "commissioner"
      : side === "home"
        ? "home"
        : side === "away"
          ? "away"
          : "none",
  };
}
