/**
 * Lot 4 « évolution persistée » — FORME des joueurs d'une ProTeam.
 *
 * `ProTeamRoster.form` (0-100, 50 = neutre) existait sans jamais être
 * écrit. Le momentum de fin de match (`SimResult.summary.momentum`) la
 * fait désormais bouger, et le coach la relit au match suivant
 * (`SimRosterPlayer.form`) pour moduler l'ordre des actions à dés.
 *
 * Règle, pure et testable sans Prisma (`nextRosterForm`) :
 *  - momentum `hot`  → +15 ;
 *  - momentum `cold` → −15 ;
 *  - `normal` ou joueur absent du momentum → retour vers 50 de 5 points.
 * Bornée à [0, 100].
 */

import type { PlayerMomentum } from "@bb/sim-engine";

import { prisma } from "../prisma";

export const FORM_NEUTRAL = 50;
export const FORM_HOT_DELTA = 15;
export const FORM_COLD_DELTA = 15;
export const FORM_RECOVERY_STEP = 5;

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function nextRosterForm(
  current: number,
  momentum: PlayerMomentum["state"] | undefined,
): number {
  if (momentum === "hot") return clamp(current + FORM_HOT_DELTA);
  if (momentum === "cold") return clamp(current - FORM_COLD_DELTA);
  if (current > FORM_NEUTRAL) return clamp(Math.max(FORM_NEUTRAL, current - FORM_RECOVERY_STEP));
  if (current < FORM_NEUTRAL) return clamp(Math.min(FORM_NEUTRAL, current + FORM_RECOVERY_STEP));
  return current;
}

export interface RosterFormInput {
  readonly id: string;
  readonly form: number;
}

export interface RosterFormUpdate {
  readonly id: string;
  readonly before: number;
  readonly after: number;
}

/** Pur : nouvelles formes d'un roster à partir du momentum du match. */
export function computeRosterFormUpdates(
  roster: readonly RosterFormInput[],
  momentum: readonly PlayerMomentum[],
): readonly RosterFormUpdate[] {
  const byId = new Map(momentum.map((m) => [m.playerId, m.state] as const));
  return roster
    .map((p) => ({ id: p.id, before: p.form, after: nextRosterForm(p.form, byId.get(p.id)) }))
    .filter((u) => u.after !== u.before);
}

export interface ApplyMatchFormInput {
  readonly teamIds: readonly string[];
  readonly momentum: readonly PlayerMomentum[];
}

/**
 * Applique le momentum d'un match terminé aux joueurs actifs des deux
 * équipes. Rend le nombre de joueurs mis à jour.
 */
export async function applyMatchFormToRosters(input: ApplyMatchFormInput): Promise<number> {
  const rows = (await prisma.proTeamRoster.findMany({
    where: { teamId: { in: [...input.teamIds] }, status: "active" },
    select: { id: true, form: true },
  })) as ReadonlyArray<{ id: string; form: number | null }>;
  const updates = computeRosterFormUpdates(
    rows.map((r) => ({ id: r.id, form: r.form ?? FORM_NEUTRAL })),
    input.momentum,
  );
  if (updates.length === 0) return 0;
  await prisma.$transaction(
    updates.map((u) =>
      prisma.proTeamRoster.update({ where: { id: u.id }, data: { form: u.after } }),
    ),
  );
  return updates.length;
}
