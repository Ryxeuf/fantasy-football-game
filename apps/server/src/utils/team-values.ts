import { PrismaClient } from '@prisma/client';
import {
  DEFAULT_RULESET,
  defaultStaffConfig,
  getSpecialRulesForTeam,
  isGameFormat,
  isLineman,
  type GameFormat,
  type Ruleset,
  calculateAdvancementsSurcharge,
  DEFAULT_ADVANCEMENT_SCHEDULE,
  type AdvancementSchedule,
} from '@bb/game-engine';
import {
  calculateTeamValueBreakdown,
  getPlayerCost,
  type StaffCosts,
  type TeamValueBreakdown,
  type TeamValueData,
} from '../../../../packages/game-engine/src/utils/team-value-calculator';
import { getPositionBySlug } from '@bb/game-engine';
import { getEliteSkillSlugs } from '../services/elite-skills';
import { loadAdvancementSchedule } from '../services/advancement-schedule-repository';
import {
  captureTeamState,
  safeRecordTeamAudit,
  type TeamAuditPrismaLike,
} from '../services/team-audit';

/** Ligne `TeamPlayer` minimale nécessaire au calcul de VE/VEA. */
interface TeamValuePlayerRow {
  /** Requis seulement par `computePlayerValuesFor` (indexation du résultat). */
  id?: string;
  position: string;
  dead?: boolean | null;
  firedAt?: Date | null;
  missNextMatch?: boolean | null;
  advancements?: string | null;
}

/** Ligne `Team` minimale nécessaire au calcul de VE/VEA. */
interface TeamValueTeamRow {
  roster: string;
  ruleset?: string | null;
  format?: string | null;
  rerolls: number;
  cheerleaders: number;
  assistants: number;
  apothecary: boolean;
}

/**
 * Coûts staff d'une équipe : ligne `RosterStaffConfig` (roster × format)
 * si elle existe, sinon défaut dérivé du package pur.
 *
 * Tolérant comme `getEliteSkillSlugs` : un client mocké étroit (tests
 * unitaires) ou une lecture en échec retombe sur le défaut plutôt que de
 * faire échouer le recalcul de VE.
 */
export async function resolveStaffCostsForTeam(
  db: unknown,
  rosterSlug: string,
  ruleset: Ruleset,
  format: GameFormat,
): Promise<StaffCosts> {
  const fallback = defaultStaffConfig(rosterSlug, format);
  try {
    const client = db as {
      roster: { findUnique: (args: unknown) => Promise<{ id: string } | null> };
      rosterStaffConfig: {
        findUnique: (args: unknown) => Promise<StaffCosts | null>;
      };
    };
    const roster = await client.roster.findUnique({
      where: { slug_ruleset: { slug: rosterSlug, ruleset } },
      select: { id: true },
    });
    if (!roster) return fallback;
    const row = await client.rosterStaffConfig.findUnique({
      where: { rosterId_format: { rosterId: roster.id, format } },
      select: {
        rerollCost: true,
        cheerleaderCost: true,
        assistantCost: true,
        apothecaryCost: true,
      },
    });
    return row ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Coûts d'embauche par slug de poste (po), lus en base pour le roster ×
 * ruleset de l'équipe.
 *
 * La base est la source de vérité des coûts (éditable en admin) et c'est
 * elle que les handlers de construction/achat débitent. La VE doit donc
 * s'appuyer dessus, sinon une équipe achetée au tarif DB serait valorisée
 * au tarif statique du package. Retour vide = repli sur `getPlayerCost`
 * (données compilées du game-engine).
 */
export interface PositionValueMeta {
  /** Coût d'embauche en po. */
  readonly cost: number;
  /** Poste de Trois-quart (`isLineman` : plafond >= 12). */
  readonly lineman: boolean;
}

export async function resolvePositionMetaForTeam(
  db: unknown,
  rosterSlug: string,
  ruleset: Ruleset,
): Promise<ReadonlyMap<string, PositionValueMeta>> {
  try {
    const client = db as {
      position: {
        findMany: (
          args: unknown,
        ) => Promise<Array<{ slug: string; cost: number; max: number }>>;
      };
    };
    const rows = await client.position.findMany({
      where: { roster: { slug: rosterSlug, ruleset } },
      select: { slug: true, cost: true, max: true },
    });
    // `Position.cost` est en kpo en base, la VE se compte en po.
    return new Map(
      rows.map((r) => [
        r.slug,
        { cost: r.cost * 1000, lineman: isLineman({ max: r.max }) },
      ]),
    );
  } catch {
    return new Map();
  }
}

/**
 * Coût total (po) des joueurs d'une équipe, AU TARIF DE LA BASE.
 *
 * Les contrôles de budget mélangeaient deux tarifs : le total des joueurs
 * existants venait de `getPlayerCost` (catalogue compilé) tandis que le joueur
 * ajouté était compté au tarif base (`Position.cost`). Un poste dont le prix a
 * été corrigé en admin autorisait donc — ou refusait — un recrutement à tort,
 * et la « valeur du joueur » affichée divergeait de la VE persistée.
 *
 * Même posture que `resolvePositionMetaForTeam` : base d'abord, catalogue en
 * repli poste par poste (slug absent de la base, miroir sqlite de test).
 */
export async function sumPlayerCostsForTeam(
  db: unknown,
  team: { readonly roster: string; readonly ruleset?: string | null },
  players: readonly { readonly position: string }[],
): Promise<number> {
  const ruleset = (team.ruleset as Ruleset) ?? DEFAULT_RULESET;
  const meta = await resolvePositionMetaForTeam(db, team.roster, ruleset);
  return players.reduce(
    (total, p) =>
      total +
      (meta.get(p.position)?.cost ??
        getPlayerCost(p.position, team.roster, ruleset)),
    0,
  );
}

/**
 * Règles spéciales d'équipe : base d'abord (éditable en admin), repli sur
 * les données statiques du game-engine. Seule
 * `trois_quarts_a_vil_prix` change le calcul (VEA).
 */
export async function resolveSpecialRulesForTeam(
  db: unknown,
  rosterSlug: string,
  ruleset: Ruleset,
): Promise<readonly string[]> {
  try {
    const client = db as {
      roster: {
        findUnique: (
          args: unknown,
        ) => Promise<{ specialRules: string | null } | null>;
      };
    };
    const row = await client.roster.findUnique({
      where: { slug_ruleset: { slug: rosterSlug, ruleset } },
      select: { specialRules: true },
    });
    const csv = row?.specialRules;
    if (typeof csv === 'string' && csv.trim().length > 0) {
      return csv
        .split(',')
        .map((r) => r.trim())
        .filter((r) => r.length > 0);
    }
  } catch { /* repli statique ci-dessous */ }
  try {
    return getSpecialRulesForTeam(rosterSlug, ruleset);
  } catch {
    return [];
  }
}

/**
 * Assemble le `TeamValueData` d'une équipe : coût de poste (au ruleset de
 * l'équipe) + surcoûts d'avancement (dont Élite), joueurs morts/licenciés
 * exclus, absents marqués indisponibles pour la VEA.
 *
 * Pur (aucune I/O) : les deux lectures DB — compétences Élite et config
 * staff — sont injectées par l'appelant.
 */
export function buildTeamValueData(
  team: TeamValueTeamRow,
  players: readonly TeamValuePlayerRow[],
  eliteSlugs: ReadonlySet<string>,
  staffCosts: StaffCosts,
  positionMeta: ReadonlyMap<string, PositionValueMeta> = new Map(),
  specialRules: readonly string[] = [],
  // Lot 6.2 — barème de l'ÉDITION de l'équipe : les surcoûts de VE d'une
  // Saison 2 ne sont pas ceux d'une Saison 3. Absent ⇒ barème compilé
  // (comportement d'avant le lot).
  schedule: AdvancementSchedule = DEFAULT_ADVANCEMENT_SCHEDULE,
): TeamValueData {
  const ruleset = (team.ruleset as Ruleset) ?? DEFAULT_RULESET;
  const format: GameFormat = isGameFormat(team.format) ? team.format : 'bb11';

  // Exclure les joueurs morts ET licenciés de la VE : ils ne font plus
  // partie du roster actif.
  const alivePlayers = players.filter((p) => !p.dead && !p.firedAt);

  return {
    players: alivePlayers.map((player) => {
      const meta = positionMeta.get(player.position);
      const baseCost =
        meta?.cost ?? getPlayerCost(player.position, team.roster, ruleset);
      // Repli hors DB : le catalogue statique porte aussi le plafond du
      // poste, seule donnée nécessaire pour classer un Trois-quart.
      const lineman =
        meta?.lineman ??
        (() => {
          const staticPos = getPositionBySlug(player.position, ruleset);
          return staticPos ? isLineman({ max: staticPos.max }) : false;
        })();
      // Include advancement surcharges in player value
      let advSurcharge = 0;
      try {
        const advancements = JSON.parse(player.advancements || '[]');
        // BB2025 : la caracteristique a un surcout par stat -> on passe
        // les objets complets ({ type, stat?, isElite }) plutot que les
        // seuls types, pour compter le surcout des competences Elite.
        advSurcharge = calculateAdvancementsSurcharge(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          advancements.map((a: any) => ({
            type: a.type,
            stat: a.stat,
            isElite:
              typeof a.skillSlug === 'string' && eliteSlugs.has(a.skillSlug),
          })),
          schedule,
        );
      } catch { /* ignore parse errors */ }
      return {
        cost: baseCost + advSurcharge,
        // VEA = VE - valeur des joueurs absents : un joueur qui rate le
        // prochain match (missNextMatch, blessure "Absent") compte dans
        // la VE mais est exclu de la VEA.
        available: !player.missNextMatch,
        // « Trois-quarts à vil prix » n'annule QUE le coût d'embauche dans
        // la VEA : les surcoûts d'avancement restent comptés.
        hireCost: baseCost,
        lineman,
      };
    }),
    rerolls: team.rerolls,
    cheerleaders: team.cheerleaders,
    assistants: team.assistants,
    apothecary: team.apothecary,
    // Les fans dévoués ne comptent ni dans la VE ni dans la VEA.
    roster: team.roster, // Ajout du roster pour le calcul des relances
    ruleset,
    format,
    staffConfig: staffCosts,
    specialRules,
  };
}

/**
 * Dépendances de valorisation d'une équipe, résolues en une passe :
 * compétences Élite, coûts staff, méta des postes, règles spéciales et
 * barème d'avancement de l'édition.
 */
async function resolveTeamValueDeps(db: unknown, team: TeamValueTeamRow) {
  const ruleset = (team.ruleset as Ruleset) ?? DEFAULT_RULESET;
  const format: GameFormat = isGameFormat(team.format) ? team.format : 'bb11';
  // Compétences Élite du ruleset : +10 000 po de surcoût VE par avancement
  // dont le skillSlug est Élite (une primaire Élite vaut 30 000 po).
  const [eliteSlugs, staffCosts, positionMeta, specialRules, schedule] =
    await Promise.all([
      getEliteSkillSlugs(db, ruleset),
      resolveStaffCostsForTeam(db, team.roster, ruleset, format),
      resolvePositionMetaForTeam(db, team.roster, ruleset),
      resolveSpecialRulesForTeam(db, team.roster, ruleset),
      // Lot 6.2 — barème de l'édition de l'équipe (repli compilé).
      loadAdvancementSchedule(ruleset),
    ]);
  return { eliteSlugs, staffCosts, positionMeta, specialRules, schedule };
}

/** Valeur d'un joueur, décomposée. Tous les montants en po. */
export interface PlayerValueBreakdown {
  /** Coût d'embauche du poste (tarif base, ruleset de l'équipe). */
  readonly hireCost: number;
  /** Surcoûts d'avancement, Élite compris. */
  readonly advancementsCost: number;
  /** Valeur totale du joueur : `hireCost + advancementsCost`. */
  readonly value: number;
  /** Le joueur occupe un poste de Trois-quart (`isLineman`). */
  readonly lineman: boolean;
}

/**
 * Valeur de CHAQUE joueur d'une équipe, indexée par `TeamPlayer.id`.
 *
 * Même résolution que `computeTeamValueBreakdownFor` (coûts de poste en
 * base, compétences Élite, barème de l'édition) : la colonne « Coût » de la
 * fiche d'équipe s'aligne donc exactement sur la VE, au lieu d'afficher un
 * tarif de recrue qui ignorait les compétences acquises.
 */
export async function computePlayerValuesFor(
  db: unknown,
  team: TeamValueTeamRow,
  players: readonly TeamValuePlayerRow[],
): Promise<Record<string, PlayerValueBreakdown>> {
  const deps = await resolveTeamValueDeps(db, team);
  const data = buildTeamValueData(
    team,
    players,
    deps.eliteSlugs,
    deps.staffCosts,
    deps.positionMeta,
    deps.specialRules,
    deps.schedule,
  );
  // `buildTeamValueData` filtre morts et licenciés dans le même ordre : on
  // ré-indexe donc sur la liste filtrée, pas sur `players`.
  const alive = players.filter((p) => !p.dead && !p.firedAt);
  const out: Record<string, PlayerValueBreakdown> = {};
  alive.forEach((player, index) => {
    const valued = data.players[index];
    if (!player.id || !valued) return;
    const hireCost = valued.hireCost ?? valued.cost;
    out[player.id] = {
      hireCost,
      advancementsCost: valued.cost - hireCost,
      value: valued.cost,
      lineman: valued.lineman ?? false,
    };
  });
  return out;
}

/**
 * Recalcule le détail VE/VEA d'une équipe SANS écriture.
 *
 * Source unique du calcul : `updateTeamValues` le persiste, le détail
 * budgétaire de la fiche d'équipe l'affiche. Toute vue qui a besoin du
 * coût des joueurs doit passer par ici plutôt que de le re-dériver.
 */
export async function computeTeamValueBreakdown(
  prisma: PrismaClient,
  teamId: string,
): Promise<TeamValueBreakdown> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { players: true },
  });

  if (!team) {
    throw new Error(`Équipe ${teamId} non trouvée`);
  }

  return computeTeamValueBreakdownFor(prisma, team, team.players);
}

/**
 * Variante « équipe déjà chargée » : évite un second aller-retour quand
 * l'appelant a déjà l'équipe et ses joueurs en main (fiche d'équipe).
 */
export async function computeTeamValueBreakdownFor(
  db: unknown,
  team: TeamValueTeamRow,
  players: readonly TeamValuePlayerRow[],
): Promise<TeamValueBreakdown> {
  const deps = await resolveTeamValueDeps(db, team);
  return calculateTeamValueBreakdown(
    buildTeamValueData(
      team,
      players,
      deps.eliteSlugs,
      deps.staffCosts,
      deps.positionMeta,
      deps.specialRules,
      deps.schedule,
    ),
  );
}

/**
 * Calcule et met à jour les valeurs d'équipe selon les règles Blood Bowl.
 *
 * Journalisé (`team.values.recompute`) : c'est le seul endroit qui écrit
 * `teamValue`/`currentValue`, et il est appelé en cascade derrière presque
 * toutes les mutations de roster. Une VE qui saute sans raison se
 * reconstitue donc en lisant les étapes de la corrélation : on voit quel
 * roster a produit quel chiffre. L'étape n'est écrite que si l'une des
 * deux valeurs a réellement bougé, pour ne pas noyer le journal.
 */
export async function updateTeamValues(prisma: PrismaClient, teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { players: true }
  });

  if (!team) {
    throw new Error(`Équipe ${teamId} non trouvée`);
  }

  const { teamValue, currentValue } = await computeTeamValueBreakdownFor(
    prisma,
    team,
    team.players,
  );

  const unchanged =
    team.teamValue === teamValue && team.currentValue === currentValue;

  const before = unchanged
    ? null
    : await captureTeamState(prisma as unknown as TeamAuditPrismaLike, teamId);

  // Mettre à jour la base de données
  // teamValue = VE calculée des joueurs actuels
  // initialBudget reste inchangé (budget saisi par l'utilisateur)
  await prisma.team.update({
    where: { id: teamId },
    data: {
      teamValue,
      currentValue
    }
  });

  if (!unchanged) {
    await safeRecordTeamAudit(prisma as unknown as TeamAuditPrismaLike, {
      teamId,
      action: 'team.values.recompute',
      before,
      details: {
        previous: { teamValue: team.teamValue, currentValue: team.currentValue },
        computed: { teamValue, currentValue },
      },
    });
  }

  return { teamValue, currentValue };
}


/**
 * Calcule les gains après un match
 */
export function calculateMatchWinnings(
  fanAttendance: number,
  touchdownsScored: number,
  conceded: boolean = false
): number {
  if (conceded) {
    return 0;
  }
  
  const baseWinnings = Math.floor(fanAttendance / 2) + touchdownsScored;
  return baseWinnings * 10000;
}

/**
 * Met à jour la trésorerie après un match
 */
export async function updateTreasuryAfterMatch(
  prisma: PrismaClient,
  teamId: string,
  winnings: number,
  expenses: number = 0
) {
  const team = await prisma.team.findUnique({
    where: { id: teamId }
  });

  if (!team) {
    throw new Error(`Équipe ${teamId} non trouvée`);
  }

  const before = await captureTeamState(
    prisma as unknown as TeamAuditPrismaLike,
    teamId,
  );
  const newTreasury = team.treasury + winnings - expenses;

  await prisma.team.update({
    where: { id: teamId },
    data: { treasury: newTreasury }
  });

  await safeRecordTeamAudit(prisma as unknown as TeamAuditPrismaLike, {
    teamId,
    action: 'team.treasury.match',
    before,
    details: { winnings, expenses, newTreasury },
  });

  return newTreasury;
}
