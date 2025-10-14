import { PrismaClient } from '../prisma-sqlite-client';
import { calculateTeamValue, calculateCurrentValue, getPlayerCost, type TeamValueData } from '../../../../packages/game-engine/src/utils/team-value-calculator';

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

  // Préparer les données pour le calcul
  const teamValueData: TeamValueData = {
    players: team.players.map(player => ({
      cost: getPlayerCost(player.position, team.roster),
      available: true // Pour l'instant, tous les joueurs sont disponibles
    })),
    rerolls: team.rerolls,
    cheerleaders: team.cheerleaders,
    assistants: team.assistants,
    apothecary: team.apothecary,
    dedicatedFans: team.dedicatedFans, // Ajout des fans dévoués
    roster: team.roster // Ajout du roster pour le calcul des relances
  };

  // Calculer les valeurs
  const teamValue = calculateTeamValue(teamValueData);
  const currentValue = calculateCurrentValue(teamValueData);

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
