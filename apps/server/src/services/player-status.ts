/**
 * Statut de présence d'un joueur au roster actif : mort / licenciement.
 *
 * MODELE — soft delete tracé. La ligne `TeamPlayer` n'est JAMAIS supprimée
 * (historique de carrière, `LeagueMatchEvent` qui la référence, snapshots de
 * roster). Le joueur porte :
 *  - `dead` / `firedAt` : source de vérité historique des filtres (une
 *    cinquantaine de call-sites), conservée en **dual-write** ;
 *  - `status` / `statusAt` / `statusSource` / `statusSourceId` : le statut
 *    dérivé + la PROVENANCE ;
 *  - un journal `TeamPlayerStatusEvent` append-only.
 *
 * POURQUOI LA PROVENANCE — un match peut être annulé (invalidation d'une
 * feuille de ligue, annulation admin d'un match en ligne) et les morts /
 * licenciements qu'il a provoqués doivent être rétablis. Sans provenance, la
 * reversion est aveugle : elle ressuscite aussi un joueur dont le statut a
 * été re-posé par une AUTRE source entre-temps. Ici, `revertPlayerStatus`
 * vérifie que l'événement actif du joueur vient bien de la source annulée,
 * puis fait un update CONDITIONNEL (le `count` doit valoir 1).
 *
 * INVARIANT — au plus un statut inactif à la fois par joueur, donc au plus un
 * `TeamPlayerStatusEvent` avec `revertedAt = null`. `applyPlayerStatus` skippe
 * un joueur déjà inactif.
 */

import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";

/** Nature du statut inactif. */
export type PlayerStatusKind = "death" | "firing";

/**
 * Origine du statut. `legacy` est réservé au backfill de migration : les
 * joueurs déjà morts / licenciés avant l'introduction du suivi.
 */
export type PlayerStatusSource =
  | "match_sheet"
  | "online_match"
  | "commissioner"
  | "admin"
  | "legacy";

export const PLAYER_STATUS_ACTIVE = "active";
export const PLAYER_STATUS_DEAD = "dead";
export const PLAYER_STATUS_FIRED = "fired";

/**
 * Filtre Prisma canonique « joueur présent au roster actif ».
 *
 * A utiliser pour TOUTE liste de joueurs disponibles (composition, coupe,
 * progression, valeur d'équipe). Filtrer `dead: false` sans `firedAt` (ou
 * l'inverse) laisse passer la moitié des joueurs sortis — c'est le bug que
 * `player-status-filters.test.ts` garde en CI.
 */
export const ACTIVE_PLAYER_WHERE = {
  dead: false,
  firedAt: null,
} as const;

/** Pendant en mémoire de `ACTIVE_PLAYER_WHERE`. */
export function isActivePlayer(p: {
  dead?: boolean | null;
  firedAt?: Date | string | null;
}): boolean {
  return !p.dead && (p.firedAt === null || p.firedAt === undefined);
}

/** Statut dérivé des deux colonnes historiques. */
export function statusOf(p: {
  dead?: boolean | null;
  firedAt?: Date | string | null;
}): string {
  if (p.dead) return PLAYER_STATUS_DEAD;
  if (p.firedAt) return PLAYER_STATUS_FIRED;
  return PLAYER_STATUS_ACTIVE;
}

function statusForKind(kind: PlayerStatusKind): string {
  return kind === "death" ? PLAYER_STATUS_DEAD : PLAYER_STATUS_FIRED;
}

export interface ApplyPlayerStatusInput {
  readonly playerId: string;
  readonly kind: PlayerStatusKind;
  readonly source: PlayerStatusSource;
  /** Id de l'entité source (matchId le plus souvent). */
  readonly sourceId?: string;
  readonly actorUserId?: string;
  readonly reason?: string;
  /**
   * Restreint l'application aux joueurs de ces équipes (sécurité : un id
   * saisi à la main ne doit pas pouvoir toucher une autre équipe).
   */
  readonly allowedTeamIds?: readonly string[];
}

export type ApplyPlayerStatusOutcome =
  | { readonly applied: true; readonly playerId: string; readonly teamId: string }
  | {
      readonly skipped: true;
      readonly reason: "player-not-found" | "team-not-allowed" | "already-inactive";
    };

/**
 * Pose un statut inactif + son événement de provenance, dans une seule
 * transaction. Idempotent : un joueur déjà mort ou licencié est skippé
 * (`already-inactive`), donc rejouer une validation ne crée pas de doublon.
 *
 * NB : la valeur d'équipe (TV) n'est PAS recalculée ici — c'est au caller de
 * le faire une fois pour toutes les équipes touchées (`updateTeamValues` lit
 * puis écrit, on ne veut pas N appels dans une boucle).
 */
export async function applyPlayerStatus(
  input: ApplyPlayerStatusInput,
): Promise<ApplyPlayerStatusOutcome> {
  const player = (await prisma.teamPlayer.findUnique({
    where: { id: input.playerId },
    select: { id: true, teamId: true, dead: true, firedAt: true },
  })) as {
    id: string;
    teamId: string;
    dead: boolean;
    firedAt: Date | null;
  } | null;

  if (!player) return { skipped: true, reason: "player-not-found" };
  if (
    input.allowedTeamIds &&
    !input.allowedTeamIds.includes(player.teamId)
  ) {
    return { skipped: true, reason: "team-not-allowed" };
  }
  if (!isActivePlayer(player)) {
    return { skipped: true, reason: "already-inactive" };
  }

  const now = new Date();
  const statusData =
    input.kind === "death"
      ? { dead: true, diedAt: now }
      : { firedAt: now };

  await prisma.$transaction([
    prisma.teamPlayer.update({
      where: { id: player.id },
      data: {
        ...statusData,
        status: statusForKind(input.kind),
        statusAt: now,
        statusSource: input.source,
        statusSourceId: input.sourceId ?? null,
      },
    }),
    prisma.teamPlayerStatusEvent.create({
      data: {
        playerId: player.id,
        teamId: player.teamId,
        kind: input.kind,
        sourceType: input.source,
        sourceId: input.sourceId ?? "",
        actorUserId: input.actorUserId ?? null,
        reason: input.reason ?? null,
      },
    }),
  ]);

  return { applied: true, playerId: player.id, teamId: player.teamId };
}

/**
 * Version batch : retourne les ids REELLEMENT appliqués (les autres ont été
 * skippés) et les équipes touchées, pour que le caller recalcule la TV.
 */
export async function applyPlayerStatuses(
  playerIds: readonly string[],
  common: Omit<ApplyPlayerStatusInput, "playerId">,
): Promise<{ readonly appliedIds: string[]; readonly teamIds: string[] }> {
  const appliedIds: string[] = [];
  const teamIds = new Set<string>();
  for (const playerId of playerIds) {
    const out = await applyPlayerStatus({ ...common, playerId });
    if ("applied" in out) {
      appliedIds.push(out.playerId);
      teamIds.add(out.teamId);
    }
  }
  return { appliedIds, teamIds: [...teamIds] };
}

export type RevertPlayerStatusReason =
  | "player-not-found"
  | "no-status-to-revert"
  | "status-superseded";

export type RevertPlayerStatusOutcome =
  | { readonly reverted: true; readonly playerId: string; readonly teamId: string }
  | { readonly skipped: true; readonly reason: RevertPlayerStatusReason };

export interface RevertPlayerStatusInput {
  readonly playerId: string;
  readonly kind: PlayerStatusKind;
  readonly source: PlayerStatusSource;
  readonly sourceId?: string;
  readonly actorUserId?: string;
  /**
   * Accepte un statut d'origine `legacy` (backfill de migration). Par
   * défaut `true` : le caller (invalidation d'une feuille) dispose de sa
   * propre preuve — le snapshot du match liste les joueurs qu'il a tués —
   * et les données antérieures au suivi de provenance doivent rester
   * réversibles. Passer `false` pour exiger une provenance stricte.
   */
  readonly allowLegacy?: boolean;
}

/**
 * Lève un statut inactif SI ET SEULEMENT SI il provient de la source
 * annulée.
 *
 * Trois refus possibles, tous silencieux (le caller décide s'il log) :
 *  - `no-status-to-revert` : le joueur est déjà actif (double invalidation).
 *  - `status-superseded` : le statut courant vient d'ailleurs (autre match,
 *    pose manuelle postérieure) — on ne ressuscite PAS.
 *  - `player-not-found`.
 *
 * L'update est conditionné sur `statusSourceId` quand la provenance est
 * connue : si une écriture concurrente est passée entre le read et le write,
 * `count` vaut 0 et on refuse plutôt que de corrompre.
 */
export async function revertPlayerStatus(
  input: RevertPlayerStatusInput,
): Promise<RevertPlayerStatusOutcome> {
  const allowLegacy = input.allowLegacy ?? true;

  const player = (await prisma.teamPlayer.findUnique({
    where: { id: input.playerId },
    select: { id: true, teamId: true, dead: true, firedAt: true },
  })) as {
    id: string;
    teamId: string;
    dead: boolean;
    firedAt: Date | null;
  } | null;
  if (!player) return { skipped: true, reason: "player-not-found" };
  if (isActivePlayer(player)) {
    return { skipped: true, reason: "no-status-to-revert" };
  }
  if (statusOf(player) !== statusForKind(input.kind)) {
    // Le joueur est inactif, mais pour une autre raison (mort alors qu'on
    // veut annuler un licenciement, ou l'inverse).
    return { skipped: true, reason: "status-superseded" };
  }

  const active = (await prisma.teamPlayerStatusEvent.findFirst({
    where: { playerId: player.id, revertedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, kind: true, sourceType: true, sourceId: true },
  })) as {
    id: string;
    kind: string;
    sourceType: string;
    sourceId: string;
  } | null;

  if (active) {
    const isLegacy = active.sourceType === "legacy";
    const matchesSource =
      active.kind === input.kind &&
      active.sourceType === input.source &&
      active.sourceId === (input.sourceId ?? "");
    if (!matchesSource && !(isLegacy && allowLegacy)) {
      return { skipped: true, reason: "status-superseded" };
    }
  } else if (!allowLegacy) {
    // Statut posé hors suivi (avant migration ou écriture directe) et le
    // caller exige une provenance : on refuse.
    return { skipped: true, reason: "status-superseded" };
  }

  const now = new Date();
  const revertData =
    input.kind === "death"
      ? { dead: false, diedAt: null }
      : { firedAt: null };

  // Update conditionne sur l'etat courant (et sur la provenance quand elle
  // est connue) : count !== 1 => quelqu'un est passe entre-temps.
  const { count } = await prisma.teamPlayer.updateMany({
    where: {
      id: player.id,
      ...(input.kind === "death"
        ? { dead: true }
        : { firedAt: { not: null } }),
    },
    data: {
      ...revertData,
      status: PLAYER_STATUS_ACTIVE,
      statusAt: null,
      statusSource: null,
      statusSourceId: null,
      // Un joueur mort/licencié ne peut avoir servi la suspension issue de
      // ce statut : on la lève avec lui (miroir de l'existant).
      missNextMatch: false,
    },
  });
  if (count !== 1) {
    return { skipped: true, reason: "status-superseded" };
  }

  if (active) {
    await prisma.teamPlayerStatusEvent.update({
      where: { id: active.id },
      data: { revertedAt: now, revertedBy: input.actorUserId ?? null },
    });
  }

  return { reverted: true, playerId: player.id, teamId: player.teamId };
}

/**
 * Reverte tous les statuts posés par une source donnée (typiquement :
 * « annule tout ce que le match M a provoqué »). Utilisé par l'annulation
 * admin d'un match en ligne, où l'appelant n'a pas de liste de joueurs.
 */
export async function revertPlayerStatusesBySource(input: {
  readonly source: PlayerStatusSource;
  readonly sourceId: string;
  readonly kind?: PlayerStatusKind;
  readonly actorUserId?: string;
}): Promise<{ readonly revertedIds: string[]; readonly teamIds: string[] }> {
  const events = (await prisma.teamPlayerStatusEvent.findMany({
    where: {
      sourceType: input.source,
      sourceId: input.sourceId,
      revertedAt: null,
      ...(input.kind ? { kind: input.kind } : {}),
    },
    select: { playerId: true, kind: true },
  })) as Array<{ playerId: string; kind: string }>;

  const revertedIds: string[] = [];
  const teamIds = new Set<string>();
  for (const e of events) {
    const out = await revertPlayerStatus({
      playerId: e.playerId,
      kind: e.kind as PlayerStatusKind,
      source: input.source,
      sourceId: input.sourceId,
      actorUserId: input.actorUserId,
      allowLegacy: false,
    });
    if ("reverted" in out) {
      revertedIds.push(out.playerId);
      teamIds.add(out.teamId);
    } else {
      serverLog.warn(
        `[player-status] reversion ignoree (${out.reason}) player=${e.playerId} source=${input.source}:${input.sourceId}`,
      );
    }
  }
  return { revertedIds, teamIds: [...teamIds] };
}

export interface PlayerStatusHistoryEntry {
  readonly id: string;
  readonly kind: PlayerStatusKind;
  readonly sourceType: string;
  readonly sourceId: string | null;
  readonly reason: string | null;
  readonly occurredAt: Date;
  readonly revertedAt: Date | null;
}

/** Historique des morts / licenciements d'un joueur (UI fiche joueur). */
export async function getPlayerStatusHistory(
  playerId: string,
): Promise<PlayerStatusHistoryEntry[]> {
  const rows = (await prisma.teamPlayerStatusEvent.findMany({
    where: { playerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      kind: true,
      sourceType: true,
      sourceId: true,
      reason: true,
      createdAt: true,
      revertedAt: true,
    },
  })) as Array<{
    id: string;
    kind: string;
    sourceType: string;
    sourceId: string;
    reason: string | null;
    createdAt: Date;
    revertedAt: Date | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as PlayerStatusKind,
    sourceType: r.sourceType,
    sourceId: r.sourceId === "" ? null : r.sourceId,
    reason: r.reason,
    occurredAt: r.createdAt,
    revertedAt: r.revertedAt,
  }));
}
