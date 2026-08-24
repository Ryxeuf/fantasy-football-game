import { PrismaClient } from '@prisma/client';
import {
  DEFAULT_RULESET,
  defaultStaffConfig,
  isGameFormat,
  type GameFormat,
  type Ruleset,
  calculateAdvancementsSurcharge,
} from '@bb/game-engine';
import {
  calculateTeamValueBreakdown,
  getPlayerCost,
  type StaffCosts,
  type TeamValueBreakdown,
  type TeamValueData,
} from '../../../../packages/game-engine/src/utils/team-value-calculator';
import { getEliteSkillSlugs } from '../services/elite-skills';

/** Ligne `TeamPlayer` minimale nécessaire au calcul de VE/VEA. */
interface TeamValuePlayerRow {
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
export async function resolvePositionCostsForTeam(
  db: unknown,
  rosterSlug: string,
  ruleset: Ruleset,
): Promise<ReadonlyMap<string, number>> {
  try {
    const client = db as {
      position: {
        findMany: (
          args: unknown,
        ) => Promise<Array<{ slug: string; cost: number }>>;
      };
    };
    const rows = await client.position.findMany({
      where: { roster: { slug: rosterSlug, ruleset } },
      select: { slug: true, cost: true },
    });
    // `Position.cost` est en kpo en base, la VE se compte en po.
    return new Map(rows.map((r) => [r.slug, r.cost * 1000]));
  } catch {
    return new Map();
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
  positionCosts: ReadonlyMap<string, number> = new Map(),
): TeamValueData {
  const ruleset = (team.ruleset as Ruleset) ?? DEFAULT_RULESET;
  const format: GameFormat = isGameFormat(team.format) ? team.format : 'bb11';

  // Exclure les joueurs morts ET licenciés de la VE : ils ne font plus
  // partie du roster actif.
  const alivePlayers = players.filter((p) => !p.dead && !p.firedAt);

  return {
    players: alivePlayers.map((player) => {
      const baseCost =
        positionCosts.get(player.position) ??
        getPlayerCost(player.position, team.roster, ruleset);
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
        );
      } catch { /* ignore parse errors */ }
      return {
        cost: baseCost + advSurcharge,
        // VEA = VE - valeur des joueurs absents : un joueur qui rate le
        // prochain match (missNextMatch, blessure "Absent") compte dans
        // la VE mais est exclu de la VEA.
        available: !player.missNextMatch,
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
  };
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
  const ruleset = (team.ruleset as Ruleset) ?? DEFAULT_RULESET;
  const format: GameFormat = isGameFormat(team.format) ? team.format : 'bb11';
  // Compétences Élite du ruleset : +10 000 po de surcoût VE par avancement
  // dont le skillSlug est Élite (une primaire Élite vaut 30 000 po).
  const [eliteSlugs, staffCosts, positionCosts] = await Promise.all([
    getEliteSkillSlugs(db, ruleset),
    resolveStaffCostsForTeam(db, team.roster, ruleset, format),
    resolvePositionCostsForTeam(db, team.roster, ruleset),
  ]);
  return calculateTeamValueBreakdown(
    buildTeamValueData(team, players, eliteSlugs, staffCosts, positionCosts),
  );
}

/**
 * Calcule et met à jour les valeurs d'équipe selon les règles Blood Bowl
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

  const newTreasury = team.treasury + winnings - expenses;

  await prisma.team.update({
    where: { id: teamId },
    data: { treasury: newTreasury }
  });

  return newTreasury;
}
