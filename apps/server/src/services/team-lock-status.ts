/**
 * Statut de verrouillage du roster d'une equipe.
 *
 * Regle produit (2026-07) : une equipe est editable *librement* tant qu'elle
 * n'a jamais ete engagee dans un match ou une competition. Des qu'elle a joue
 * (ou est engagee dans) un match / une ligue, son roster est "fige" et
 * repasse sous les contraintes BB — notamment le minimum de 11 joueurs. Cela
 * evite le deadlock du builder : une equipe fraiche a 11 joueurs pile et sans
 * budget ne pouvait ni ajouter (budget) ni retirer (plancher 11) un joueur,
 * rendant tout echange impossible.
 *
 * Deux garde-fous restent actifs *quel que soit* l'etat figee/brouillon et
 * sont geres ailleurs :
 *  - le budget est un plafond dur (voir `handleAddTeamPlayer`) ;
 *  - le lock "match en cours" (selection pending/active) bloque TOUTE
 *    edition, pas seulement le minimum 11 (voir les handlers Player CRUD).
 */

import { prisma } from '../prisma';

/**
 * Message unique renvoye (403) quand un coach tente de modifier la
 * composition/budget d'une equipe engagee. Centralise pour rester coherent
 * entre tous les endpoints proprietaire de la page d'edition.
 */
export const TEAM_ENGAGED_MESSAGE =
  "Cette equipe est engagee dans une competition (match, ligue ou coupe) et ne peut plus etre modifiee";

/**
 * Retourne `true` si le roster de l'equipe est fige (a joue / est engagee),
 * `false` s'il est encore en brouillon librement editable.
 *
 * Une equipe est consideree engagee des qu'il existe pour elle :
 *  - une `TeamSelection` (match en ligne / ligne materialisee) ;
 *  - un `LocalMatch` non annule (partie locale en tant qu'equipe A ou B) ;
 *  - une `LeagueParticipant` (inscription a une saison de ligue) ;
 *  - un `CupParticipant` (inscription a une coupe).
 */
export async function isTeamRosterFrozen(teamId: string): Promise<boolean> {
  const [selection, localMatch, leagueParticipation, cupParticipation] =
    await Promise.all([
      prisma.teamSelection.findFirst({
        where: { teamId },
        select: { id: true },
      }),
      prisma.localMatch.findFirst({
        where: {
          OR: [{ teamAId: teamId }, { teamBId: teamId }],
          NOT: { status: 'cancelled' },
        },
        select: { id: true },
      }),
      prisma.leagueParticipant.findFirst({
        where: { teamId },
        select: { id: true },
      }),
      prisma.cupParticipant.findFirst({
        where: { teamId },
        select: { id: true },
      }),
    ]);

  return Boolean(
    selection || localMatch || leagueParticipation || cupParticipation,
  );
}
