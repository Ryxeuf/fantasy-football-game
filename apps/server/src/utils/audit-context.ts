/**
 * Contexte d'audit ambiant (« qui fait quoi »), porté par un
 * `AsyncLocalStorage`.
 *
 * Pourquoi un ALS plutôt qu'un paramètre : les mutations d'équipe passent
 * par une chaîne profonde (route -> service -> service pur -> `prisma`), et
 * plusieurs d'entre elles sont déclenchées par des jobs (séquence
 * d'après-match, mécène). Threader `{ userId, ip, requestId }` sur chaque
 * signature aurait touché des dizaines de fonctions sans rapport avec
 * l'audit. Le store est posé UNE fois (middleware HTTP ou wrapper de job)
 * et `recordTeamAudit` le lit.
 *
 * Le store est MUTABLE sur deux champs seulement :
 *  - `actorUserId` / `actorRoles` / `impersonatorId`, remplis par
 *    `authUser` qui s'exécute APRÈS le middleware d'audit ;
 *  - `step`, compteur d'étape incrémenté à chaque écriture du journal.
 *
 * Aucune I/O ici : module pur, testable sans Express ni Prisma.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

/** Origine de l'opération tracée. */
export type AuditSource = "http" | "job" | "script" | "test";

/**
 * Rôle sous lequel l'action est faite. Dérivé au moment de l'écriture :
 * `owner` si l'acteur possède l'équipe, sinon `admin` / `commissioner`
 * selon les rôles portés par le token, `system` pour un job.
 */
export type AuditActorRole =
  | "owner"
  | "admin"
  | "commissioner"
  | "system"
  | "anonymous";

export interface AuditContext {
  /** Regroupe toutes les étapes d'une même opération métier. */
  readonly correlationId: string;
  /** Origine (`http` pour une requête, `job` pour un cron/hook). */
  readonly source: AuditSource;
  /** Route normalisée ("POST /team/:id/purchase"), `null` hors HTTP. */
  readonly route: string | null;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  /** Rempli par `authUser` (le middleware d'audit tourne avant lui). */
  actorUserId: string | null;
  actorRoles: readonly string[];
  impersonatorId: string | null;
  /** Compteur d'étape, incrémenté par `nextAuditStep()`. */
  step: number;
}

const storage = new AsyncLocalStorage<AuditContext>();

export interface CreateAuditContextInput {
  correlationId?: string;
  source?: AuditSource;
  route?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  actorUserId?: string | null;
  actorRoles?: readonly string[];
  impersonatorId?: string | null;
}

/** Construit un store d'audit neuf (compteur d'étape à 0). */
export function createAuditContext(
  input: CreateAuditContextInput = {},
): AuditContext {
  return {
    correlationId: input.correlationId ?? randomUUID(),
    source: input.source ?? "job",
    route: input.route ?? null,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    actorUserId: input.actorUserId ?? null,
    actorRoles: input.actorRoles ?? [],
    impersonatorId: input.impersonatorId ?? null,
    step: 0,
  };
}

/** Exécute `fn` avec `context` comme contexte d'audit ambiant. */
export function runWithAuditContext<T>(
  context: AuditContext,
  fn: () => T,
): T {
  return storage.run(context, fn);
}

/**
 * Raccourci pour les jobs et scripts : ouvre un contexte `job` autour de
 * `fn` (une corrélation par exécution).
 *
 * ```ts
 * await runAsAuditJob("league.postmatch.sequence", () => settle(matchId));
 * ```
 */
export function runAsAuditJob<T>(
  jobName: string,
  fn: () => T,
  overrides: CreateAuditContextInput = {},
): T {
  return runWithAuditContext(
    createAuditContext({ source: "job", route: jobName, ...overrides }),
    fn,
  );
}

/** Contexte courant, ou `undefined` hors de tout `runWithAuditContext`. */
export function getAuditContext(): AuditContext | undefined {
  return storage.getStore();
}

/**
 * Renseigne l'acteur sur le contexte courant. Appelé par `authUser` /
 * `optionalAuthUser` une fois le token vérifié. No-op hors contexte.
 */
export function setAuditActor(actor: {
  userId: string | null;
  roles?: readonly string[];
  impersonatorId?: string | null;
}): void {
  const ctx = storage.getStore();
  if (!ctx) return;
  ctx.actorUserId = actor.userId;
  ctx.actorRoles = actor.roles ?? [];
  ctx.impersonatorId = actor.impersonatorId ?? null;
}

/**
 * Réserve le prochain rang d'étape de la corrélation courante.
 *
 * Hors contexte (test unitaire, script non instrumenté) on retombe sur
 * `1` : le journal reste écrit, seule la corrélation est dégradée.
 */
export function nextAuditStep(): number {
  const ctx = storage.getStore();
  if (!ctx) return 1;
  ctx.step += 1;
  return ctx.step;
}

/**
 * Corrélation courante, ou un id neuf hors contexte — jamais `null` pour
 * que la colonne `correlationId` reste non-nullable.
 */
export function currentCorrelationId(): string {
  return storage.getStore()?.correlationId ?? randomUUID();
}

/**
 * Rôle d'audit : `owner` prime (c'est le coach qui agit sur SON équipe),
 * puis les rôles privilégiés portés par le token.
 *
 * Pur : les rôles et la propriété de l'équipe sont fournis par l'appelant.
 */
export function resolveActorRole(input: {
  actorUserId: string | null;
  teamOwnerId?: string | null;
  roles?: readonly string[];
}): AuditActorRole {
  if (!input.actorUserId) return "system";
  if (input.teamOwnerId && input.teamOwnerId === input.actorUserId) {
    return "owner";
  }
  const roles = (input.roles ?? []).map((r) => r.toLowerCase());
  if (roles.includes("admin") || roles.includes("superadmin")) return "admin";
  if (roles.includes("commissioner")) return "commissioner";
  return "anonymous";
}
