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
 *
 * DEUX NIVEAUX DE GEL, a ne pas confondre :
 *  - `isTeamRosterFrozen` — la COMPOSITION (ajouter/retirer un joueur,
 *    rebattre le budget d'embauche). Se declenche des l'INSCRIPTION a une
 *    ligue ou une coupe : c'est le garde-fou anti-triche entre deux matchs.
 *  - `isTeamBuildLocked` — les ACHATS DE CONSTRUCTION (pool de PSP et
 *    competences payees dessus). Ne se declenche qu'a l'ENTREE EN JEU. Une
 *    equipe inscrite dont aucune feuille de match n'est ouverte reste
 *    corrigible : geler ses competences a l'inscription obligeait a
 *    recreer l'equipe pour defaire un achat.
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

/**
 * Message unique renvoye (409) quand un coach tente de remanier les ACHATS DE
 * CONSTRUCTION (pool de PSP, competences payees dessus) d'une equipe deja
 * entree en jeu.
 */
export const TEAM_BUILD_LOCKED_MESSAGE =
  "Cette equipe est entree en jeu (feuille de match, coupe ou match) : ses achats de construction sont figes";

/** Statuts d'appariement qui ne temoignent d'AUCUNE entree en jeu. */
const IDLE_PAIRING_STATUSES = ['scheduled', 'cancelled'] as const;

/**
 * L'equipe est-elle entree en JEU dans une de ses ligues ?
 *
 * L'INSCRIPTION a une saison (`LeagueParticipant`) ne suffit pas : un
 * commissaire monte souvent sa saison des semaines avant le premier match, et
 * geler les achats a l'inscription privait les coachs de toute correction.
 * Le signal, c'est l'appariement : une feuille de match ouverte dessus
 * (`LeagueMatchSheet`, quel que soit son statut — des qu'elle existe, la
 * composition est en train d'etre consignee) ou un appariement qui a quitte
 * l'etat « prevu » (joue, en cours, forfait).
 */
export async function isTeamEngagedInLeaguePlay(
  teamId: string,
): Promise<boolean> {
  const pairing = await prisma.leaguePairing.findFirst({
    where: {
      OR: [
        { homeParticipant: { teamId } },
        { awayParticipant: { teamId } },
      ],
      AND: [
        {
          OR: [
            { matchSheet: { isNot: null } },
            { status: { notIn: [...IDLE_PAIRING_STATUSES] } },
          ],
        },
      ],
    },
    select: { id: true },
  });
  return Boolean(pairing);
}

/**
 * Le roster est-il figé pour les ACHATS DE CONSTRUCTION (pool de PSP et
 * competences achetees dessus) ?
 *
 * Plus permissif que `isTeamRosterFrozen`, et volontairement : ce gel-ci ne
 * protege pas la composition (anti-triche entre deux matchs) mais la
 * coherence des achats payes sur le pool. Tant que l'equipe n'est PAS entree
 * en jeu, ces achats restent une decision de construction que le coach peut
 * defaire — c'est exactement ce que la simple inscription en ligue interdisait
 * a tort.
 *
 * Verrouillent, en revanche :
 *  - une `TeamSelection` (l'equipe est alignee sur un match en ligne) ;
 *  - un `LocalMatch` non annule ;
 *  - une inscription en coupe : `CupParticipant.rosterSnapshot` est fige DES
 *    l'inscription (mode resurrection), le remanier desynchroniserait la
 *    reference ;
 *  - une entree en jeu de ligue (cf. `isTeamEngagedInLeaguePlay`).
 */
export async function isTeamBuildLocked(teamId: string): Promise<boolean> {
  const [selection, localMatch, cupParticipation, leaguePlay] =
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
      prisma.cupParticipant.findFirst({
        where: { teamId },
        select: { id: true },
      }),
      isTeamEngagedInLeaguePlay(teamId),
    ]);

  return Boolean(selection || localMatch || cupParticipation || leaguePlay);
}
