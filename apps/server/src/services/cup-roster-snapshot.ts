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
import { ACTIVE_PLAYER_WHERE } from './player-status';
import type { Ruleset } from '@bb/game-engine';
import { loadInducementCatalogue } from './inducement-repository';
import { nameTeamInducements } from './build-inducements';
import type { SnapshotInducement } from './snapshot-inducements';

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

export type { SnapshotInducement } from './snapshot-inducements';

/** Snapshot complet d'une équipe. */
export interface RosterSnapshot {
  readonly capturedAt: number;
  readonly roster: string;
  readonly ruleset: string;
  readonly format: string;
  readonly teamValue: number;
  readonly currentValue: number;
  /**
   * Trésorerie au moment de la capture. Optionnelle : absente des
   * snapshots antérieurs à son introduction (feuille de match — valeurs
   * d'en-tête figées au début du match).
   */
  readonly treasury?: number;
  readonly initialBudget: number;
  readonly startingPspPool: number;
  readonly rerolls: number;
  readonly cheerleaders: number;
  readonly assistants: number;
  readonly apothecary: boolean;
  readonly dedicatedFans: number;
  readonly players: readonly SnapshotPlayer[];
  readonly starPlayers: readonly SnapshotStarPlayer[];
  /**
   * Coups de pouce achetés à la création. Optionnel : absent des snapshots
   * antérieurs, qui se lisent « aucun coup de pouce ».
   */
  readonly inducements?: readonly SnapshotInducement[];
}

/** Forme minimale d'équipe attendue par `buildRosterSnapshot` (pure). */
export interface TeamForSnapshot {
  readonly roster: string;
  readonly ruleset: string;
  readonly format: string;
  readonly teamValue: number;
  readonly currentValue: number;
  readonly treasury?: number;
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
  /** Coups de pouce de création, déjà nommés (cf. `captureRosterSnapshot`). */
  readonly inducements?: ReadonlyArray<SnapshotInducement>;
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
    treasury: team.treasury,
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
    inducements: (team.inducements ?? []).map((ind) => ({
      slug: ind.slug,
      name: ind.name,
      quantity: ind.quantity,
      unitCost: ind.unitCost,
    })),
  };
}

export { parseSnapshotInducements } from './snapshot-inducements';

/**
 * Charge une équipe et renvoie son snapshot sérialisable, ou `null` si
 * l'équipe est introuvable.
 *
 * `excludeMissNextMatch` (feuille de match de ligue) : les joueurs absents
 * (blessure « rate le prochain match ») ne participent pas à la rencontre
 * et ne doivent donc pas figurer dans la « version du match » figée. Les
 * snapshots de coupe gardent le comportement historique (l'absence est un
 * état de ligue, pas de tournoi résurrection).
 */
export async function captureRosterSnapshot(
  teamId: string,
  options: { readonly excludeMissNextMatch?: boolean } = {},
): Promise<RosterSnapshot | null> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      // Roster actif uniquement : un joueur mort ou licencie ne part pas en
      // coupe (le snapshot sert de reference anti-triche pour le tournoi).
      players: {
        where: {
          ...ACTIVE_PLAYER_WHERE,
          ...(options.excludeMissNextMatch ? { missNextMatch: false } : {}),
        },
        orderBy: { number: 'asc' },
      },
      starPlayers: true,
      inducements: true,
    },
  });
  if (!team) return null;
  const inducements = (team as { inducements?: ReadonlyArray<{
    slug: string;
    quantity: number;
    unitCost: number;
  }> }).inducements ?? [];
  // Libellés figés avec le snapshot : best-effort, le slug suffit à défaut.
  let catalogue: ReadonlyArray<{ slug: string; displayNameFr: string }> = [];
  if (inducements.length > 0) {
    try {
      catalogue = await loadInducementCatalogue(team.ruleset as Ruleset);
    } catch {
      catalogue = [];
    }
  }
  return buildRosterSnapshot(
    {
      ...(team as unknown as TeamForSnapshot),
      inducements: nameTeamInducements(inducements, catalogue),
    },
    Date.now(),
  );
}

/**
 * Parse tolérant d'une colonne portant un `RosterSnapshot` : objet natif
 * (PostgreSQL `Json`), chaîne JSON sérialisée (miroir SQLite en test),
 * `null` / `undefined` (participant historique sans snapshot) ou contenu
 * illisible. Retourne `null` dès que la forme n'est pas exploitable — un
 * snapshot à moitié lu vaut moins que pas de snapshot du tout (l'appelant
 * retombe alors sur l'état live).
 *
 * PUR : aucune I/O.
 */
export function parseRosterSnapshot(raw: unknown): RosterSnapshot | null {
  let obj: unknown = raw;
  if (typeof raw === 'string') {
    if (raw.trim() === '') return null;
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const candidate = obj as Partial<RosterSnapshot>;
  // Un snapshot « en-tête seul » (feuille de match legacy) ne porte pas de
  // roster : il ne peut pas servir de version du match.
  if (!Array.isArray(candidate.players)) return null;
  if (typeof candidate.roster !== 'string') return null;
  return candidate as RosterSnapshot;
}
