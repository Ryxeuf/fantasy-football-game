/**
 * S27.1d — Service "Champion Nuffle Cup {Mois} {YYYY}" pour le profil
 * coach.
 *
 * Calcule les badges decernes au coach finissant 1er d'une Nuffle Cup
 * mensuelle terminee. Lecture pure : la verite vient des cups
 * `status='terminee'`/`'archivee'` avec `monthlyYear/Month` definis,
 * et du `computeCupStandings` calcule a la demande.
 *
 * Convention :
 *  - On considere "champion" le 1er coach du `teamStats` (deja trie
 *    par totalPoints DESC, tiebreakers TD diff / blocks / etc.).
 *  - On ignore les cups dont le slot mensuel est invalide (defense en
 *    profondeur).
 *  - Le label est format "Champion Nuffle Cup {Mois} {YYYY}" via
 *    `formatMonthlyNuffleCupChampionLabel` (S27.1a).
 *
 * Pattern aligne sur S26.6d (`coach-championships.ts` pour les ligues
 * thematiques).
 */

import { prisma } from "../prisma";
import {
  computeCupStandings,
  type CupWithParticipantsAndScoring,
  type LocalMatchWithRelations,
} from "../cupScoring";
import {
  formatMonthlyNuffleCupChampionLabel,
  isValidMonthlyCupSlot,
} from "./nuffle-cup-monthly";

export interface CoachCupChampionship {
  cupId: string;
  cupName: string;
  monthlyYear: number;
  monthlyMonth: number;
  /** "Champion Nuffle Cup {Mois} {YYYY}". */
  label: string;
}

interface CupRow {
  id: string;
  name: string;
  status: string;
  monthlyYear: number | null;
  monthlyMonth: number | null;
  participants: Array<{
    team: { id: string; owner: { id: string } } | null;
  }>;
  localMatches: LocalMatchWithRelations[];
  // Champs `winPoints`, etc., charges via include pour computeCupStandings.
  [k: string]: unknown;
}

export async function getCoachCupChampionships(
  userId: string,
): Promise<CoachCupChampionship[]> {
  if (typeof userId !== "string" || userId.trim().length === 0) {
    return [];
  }

  const cups = (await (prisma as unknown as {
    cup: { findMany: (args: unknown) => Promise<CupRow[]> };
  }).cup.findMany({
    where: {
      status: { in: ["terminee", "archivee"] },
      monthlyYear: { not: null },
      monthlyMonth: { not: null },
    },
    include: {
      participants: {
        include: {
          team: {
            select: { id: true, name: true, roster: true, ruleset: true, owner: { select: { id: true } } },
          },
        },
      },
      localMatches: {
        where: { status: "completed" },
        include: {
          teamA: { select: { id: true, name: true, roster: true, ruleset: true } },
          teamB: { select: { id: true, name: true, roster: true, ruleset: true } },
          actions: true,
        },
      },
    },
  })) as CupRow[];

  const result: CoachCupChampionship[] = [];
  for (const cup of cups) {
    if (cup.monthlyYear === null || cup.monthlyMonth === null) continue;
    if (!isValidMonthlyCupSlot(cup.monthlyYear, cup.monthlyMonth)) continue;

    const standings = computeCupStandings(
      cup as unknown as CupWithParticipantsAndScoring,
      cup.localMatches,
    );
    if (standings.teamStats.length === 0) continue;

    const winnerTeamId = standings.teamStats[0].teamId;
    const winnerParticipant = cup.participants.find(
      (p) => p.team?.id === winnerTeamId,
    );
    if (!winnerParticipant?.team?.owner?.id) continue;
    if (winnerParticipant.team.owner.id !== userId) continue;

    const label = formatMonthlyNuffleCupChampionLabel(
      cup.monthlyYear,
      cup.monthlyMonth,
    );
    if (!label) continue;

    result.push({
      cupId: cup.id,
      cupName: cup.name,
      monthlyYear: cup.monthlyYear,
      monthlyMonth: cup.monthlyMonth,
      label,
    });
  }

  result.sort((a, b) => {
    if (b.monthlyYear !== a.monthlyYear) {
      return b.monthlyYear - a.monthlyYear;
    }
    return b.monthlyMonth - a.monthlyMonth;
  });

  return result;
}
