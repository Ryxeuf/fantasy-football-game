/**
 * S27.6 — Service d'audit log admin.
 *
 * Cle de voute du tracking des actions admin (compliance + forensic).
 * Une seule fonction `recordAdminAction()` qui ecrit une ligne immuable
 * dans `AuditLog`. Les routes admin l'invoquent apres chaque mutation
 * effectuee avec succes.
 *
 * Serialisation
 * -------------
 * Les snapshots `oldValue` / `newValue` peuvent etre n'importe quel
 * objet JSON-serialisable. Ils sont serialises en JSON string AVANT
 * l'insert pour deux raisons :
 *  - l'instance SQLite (tests) stocke `oldValue`/`newValue` en
 *    `String` (pas de type JSONB natif) ;
 *  - l'instance Postgres (prod) accepte aussi un JSON string scalar
 *    dans une colonne `Json`, ce qui evite un branching par provider.
 *
 * Le `JSON.parse` de relecture est de la responsabilite de la couche
 * UI / debug (slice 3 de S27.6).
 *
 * Pas de retry / queue : si l'insert echoue, l'erreur remonte au
 * caller. Le route layer doit deja catcher pour eviter de masquer la
 * mutation reussie cote business — voir slice 2.
 */
import { Prisma, type PrismaClient } from "@prisma/client";

export interface RecordAdminActionInput {
  /** Admin qui declenche l'action. `null` = job systeme (cron). */
  userId: string | null;
  /**
   * Slug de l'action en kebab/dot-case stable
   * (ex: "user.role.update", "match.delete", "skill.bulk.update").
   */
  action: string;
  /** Type d'entite cible ("User", "Match", "Skill", etc.). */
  entity: string;
  /** ID de l'entite cible (cuid) ; null pour les batchs. */
  entityId?: string | null;
  /** Snapshot avant mutation. `null` / `undefined` = pas d'avant (creation). */
  oldValue?: unknown;
  /** Snapshot apres mutation. `null` / `undefined` = pas d'apres (suppression). */
  newValue?: unknown;
  /** IP source (best-effort). */
  ipAddress?: string | null;
  /** User-Agent source. */
  userAgent?: string | null;
}

function serializeValue(
  value: unknown,
): string | typeof Prisma.JsonNull {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return JSON.stringify(value);
}

/**
 * Insere une trace d'action admin dans `AuditLog`.
 *
 * Idempotence : aucune. Chaque appel cree une ligne unique horodatee
 * via `createdAt @default(now())`. Le caller est responsable de
 * n'invoquer qu'apres une mutation reussie (voir slice 2 de S27.6).
 */
export async function recordAdminAction(
  prisma: PrismaClient,
  input: RecordAdminActionInput,
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      oldValue: serializeValue(input.oldValue),
      newValue: serializeValue(input.newValue),
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
