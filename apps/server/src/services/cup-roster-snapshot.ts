/**
 * Snapshot du roster d'une équipe au moment de son inscription à une coupe.
 *
 * Sert de référence pour le **mode résurrection** : l'équipe est censée
 * repartir de cet état à chaque match (aucun PSP/blessure/mort/gain conservé).
 * Combiné au court-circuit de persistance dans `local-match` (résurrection),
 * le roster live ne diverge jamais de ce snapshot.
 *
 * Le snapshot est aussi une trace d'audit (composition validée à l'inscription).
 */

import { prisma } from '../prisma';

/** Joueur figé dans le snapshot. */
export interface SnapshotPlayer {
  readonly name: string;
  readonly position: string;
  readonly number: number;
  readonly ma: number;
  readonly st: number;
  readonly ag: number;
  readonly pa: number | null;
  readonly av: number;
  readonly skills: string;
  readonly spp: number;
  /** JSON string des advancements (tel que stocké sur TeamPlayer). */
  readonly advancements: string;
}

/** Star Player figé dans le snapshot. */
export interface SnapshotStarPlayer {
  readonly starPlayerSlug: string;
  readonly cost: number;
}

/** Snapshot complet d'une équipe. */
export interface RosterSnapshot {
  readonly capturedAt: number;
  readonly roster: string;
  readonly ruleset: string;
  readonly format: string;
  readonly teamValue: number;
  readonly currentValue: number;
  readonly initialBudget: number;
  readonly startingPspPool: number;
  readonly rerolls: number;
  readonly cheerleaders: number;
  readonly assistants: number;
  readonly apothecary: boolean;
  readonly dedicatedFans: number;
  readonly players: readonly SnapshotPlayer[];
  readonly starPlayers: readonly SnapshotStarPlayer[];
}

/** Forme minimale d'équipe attendue par `buildRosterSnapshot` (pure). */
export interface TeamForSnapshot {
  readonly roster: string;
  readonly ruleset: string;
  readonly format: string;
  readonly teamValue: number;
  readonly currentValue: number;
  readonly initialBudget: number;
  readonly startingPspPool: number;
  readonly rerolls: number;
  readonly cheerleaders: number;
  readonly assistants: number;
  readonly apothecary: boolean;
  readonly dedicatedFans: number;
  readonly players: ReadonlyArray<{
    name: string;
    position: string;
    number: number;
    ma: number;
    st: number;
    ag: number;
    pa: number | null;
    av: number;
    skills: string;
    spp: number;
    advancements: string;
  }>;
  readonly starPlayers: ReadonlyArray<{ starPlayerSlug: string; cost: number }>;
}

/**
 * Construit (pur) le snapshot à partir d'une équipe déjà chargée.
 * `capturedAt` est injecté par le caller pour rester déterministe/testable.
 */
export function buildRosterSnapshot(
  team: TeamForSnapshot,
  capturedAt: number,
): RosterSnapshot {
  return {
    capturedAt,
    roster: team.roster,
    ruleset: team.ruleset,
    format: team.format,
    teamValue: team.teamValue,
    currentValue: team.currentValue,
    initialBudget: team.initialBudget,
    startingPspPool: team.startingPspPool,
    rerolls: team.rerolls,
    cheerleaders: team.cheerleaders,
    assistants: team.assistants,
    apothecary: team.apothecary,
    dedicatedFans: team.dedicatedFans,
    players: team.players.map((p) => ({
      name: p.name,
      position: p.position,
      number: p.number,
      ma: p.ma,
      st: p.st,
      ag: p.ag,
      pa: p.pa,
      av: p.av,
      skills: p.skills,
      spp: p.spp,
      advancements: p.advancements,
    })),
    starPlayers: team.starPlayers.map((sp) => ({
      starPlayerSlug: sp.starPlayerSlug,
      cost: sp.cost,
    })),
  };
}

/**
 * Charge une équipe et renvoie son snapshot sérialisable, ou `null` si
 * l'équipe est introuvable.
 */
export async function captureRosterSnapshot(
  teamId: string,
): Promise<RosterSnapshot | null> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      players: { where: { firedAt: null }, orderBy: { number: 'asc' } },
      starPlayers: true,
    },
  });
  if (!team) return null;
  return buildRosterSnapshot(team as unknown as TeamForSnapshot, Date.now());
}
