/**
 * Contexte de feuille de match, INDÉPENDANT de la compétition.
 *
 * La feuille de match (`LeagueMatchSheet`) était structurellement liée à une
 * `LeaguePairing` : ligue, saison, journée, commissaire. Les coupes, elles,
 * n'avaient aucune feuille — leurs rencontres se jouaient dans un
 * `LocalMatch` avec une saisie d'actions sans rapport avec celle des ligues.
 * Deux saisies pour la même chose, donc deux règles qui dérivent.
 *
 * Ce module est le SEUL point qui sait de quelle compétition vient une
 * rencontre. Il rend un contexte normalisé (équipes, commissaire, clé de
 * lecture de la feuille) plus le JEU DE RÈGLES de la compétition — c'est
 * ce jeu de règles, et lui seul, qui distingue une coupe d'une ligue :
 *
 * | Effet d'après-match      | Ligue | Coupe |
 * |--------------------------|-------|-------|
 * | PSP gagnés               | oui   | NON   |
 * | Blessures / morts        | oui   | NON   |
 * | Or, gains, fans dévoués  | oui   | NON   |
 * | Évolutions, achats, renvois | oui | NON  |
 * | Roster figé              | live à l'ouverture | inscription (résurrection) |
 *
 * La résolution est POLYMORPHE sur l'id de rencontre : `LeaguePairing`
 * d'abord, `CupPairing` ensuite. Les identifiants sont des `cuid()`, donc
 * uniques d'une table à l'autre — c'est ce qui permet de garder la signature
 * `{ pairingId }` de toutes les fonctions de la feuille, et donc de ne PAS
 * dupliquer les 4 000 lignes du service.
 */

import { prisma } from "../prisma";

export type CompetitionKind = "league" | "cup";

/**
 * Ce que la compétition autorise à écrire quand la feuille est validée.
 * Tout est `true` en ligue (comportement historique inchangé) ; une coupe
 * n'écrit RIEN sur les équipes — seul le score et le classement bougent.
 */
export interface CompetitionSheetRules {
  /** Les PSP du match sont crédités aux joueurs. */
  readonly sppEnabled: boolean;
  /** Blessures, morts et « manque le prochain match » sont persistés. */
  readonly injuriesPersisted: boolean;
  /** Gains, trésorerie, fans dévoués et erreurs coûteuses sont appliqués. */
  readonly economyEnabled: boolean;
  /** Les évolutions saisies sur la feuille sont appliquées au roster. */
  readonly advancementsEnabled: boolean;
  /** Les achats d'après-match (joueurs, staff, relances) sont appliqués. */
  readonly purchasesEnabled: boolean;
  /** Les licenciements d'après-match sont appliqués. */
  readonly firingsEnabled: boolean;
  /**
   * Mode résurrection : chaque rencontre repart du roster D'INSCRIPTION,
   * jamais du roster live. La « version du match » est alors le snapshot
   * pris à l'inscription (`CupParticipant.rosterSnapshot`).
   */
  readonly resurrection: boolean;
}

/** Ligue : la feuille écrit tout, c'est la séquence d'après-match du livre. */
export const LEAGUE_SHEET_RULES: CompetitionSheetRules = {
  sppEnabled: true,
  injuriesPersisted: true,
  economyEnabled: true,
  advancementsEnabled: true,
  purchasesEnabled: true,
  firingsEnabled: true,
  resurrection: false,
};

/**
 * Coupe : aucune écriture sur les équipes. Une coupe se joue en
 * résurrection — le roster inscrit rejoue à l'identique à chaque ronde.
 */
export const CUP_SHEET_RULES: CompetitionSheetRules = {
  sppEnabled: false,
  injuriesPersisted: false,
  economyEnabled: false,
  advancementsEnabled: false,
  purchasesEnabled: false,
  firingsEnabled: false,
  resurrection: true,
};

export function sheetRulesFor(kind: CompetitionKind): CompetitionSheetRules {
  return kind === "cup" ? CUP_SHEET_RULES : LEAGUE_SHEET_RULES;
}

/** Contexte d'autorisation et de rattachement d'une rencontre. */
export interface CompetitionPairingContext {
  readonly kind: CompetitionKind;
  readonly pairingId: string;
  /** Id de la compétition (ligue ou coupe). */
  readonly competitionId: string;
  readonly competitionName: string;
  /** Créateur de la compétition = commissaire. */
  readonly creatorId: string;
  readonly homeTeamId: string;
  readonly awayTeamId: string;
  readonly homeOwnerId: string;
  readonly awayOwnerId: string;
  readonly rules: CompetitionSheetRules;
}

/**
 * Clé de lecture/écriture de la feuille pour ce contexte. La feuille porte
 * DEUX FK nullables : lire par la mauvaise renverrait la feuille d'une autre
 * rencontre (ou rien). Passer par ce helper est le seul moyen de ne pas se
 * tromper.
 */
export function sheetWhere(
  ctx: Pick<CompetitionPairingContext, "kind" | "pairingId">,
): { pairingId: string } | { cupPairingId: string } {
  return ctx.kind === "cup"
    ? { cupPairingId: ctx.pairingId }
    : { pairingId: ctx.pairingId };
}

/** Données de création de la feuille (la bonne FK, et elle seule). */
export function sheetCreateData(
  ctx: Pick<CompetitionPairingContext, "kind" | "pairingId">,
): { pairingId: string } | { cupPairingId: string } {
  return sheetWhere(ctx);
}

type LeaguePairingRow = {
  id: string;
  homeParticipant: { teamId: string; team: { ownerId: string } } | null;
  awayParticipant: { teamId: string; team: { ownerId: string } } | null;
  round: {
    season: { league: { id: string; name: string; creatorId: string } };
  };
};

type CupPairingRow = {
  id: string;
  homeTeamId: string;
  awayTeamId: string | null;
  homeTeam: { ownerId: string } | null;
  awayTeam: { ownerId: string } | null;
  round: { cup: { id: string; name: string; creatorId: string } };
};

/**
 * Résout une rencontre de ligue OU de coupe. Retourne `null` si l'id
 * n'appartient à aucune des deux — l'appelant décide de l'erreur métier
 * (la feuille lève `pairing_not_found`).
 *
 * Une rencontre de coupe SANS adversaire (exempt) n'a pas de feuille : elle
 * est traitée comme introuvable, il n'y a pas de match à saisir.
 */
export async function resolveCompetitionPairing(
  pairingId: string,
): Promise<CompetitionPairingContext | null> {
  const leaguePairing = (await prisma.leaguePairing.findUnique({
    where: { id: pairingId },
    select: {
      id: true,
      round: {
        select: {
          season: {
            select: {
              league: { select: { id: true, name: true, creatorId: true } },
            },
          },
        },
      },
      homeParticipant: {
        select: { teamId: true, team: { select: { ownerId: true } } },
      },
      awayParticipant: {
        select: { teamId: true, team: { select: { ownerId: true } } },
      },
    },
  })) as LeaguePairingRow | null;

  if (leaguePairing) {
    const league = leaguePairing.round.season.league;
    return {
      kind: "league",
      pairingId: leaguePairing.id,
      competitionId: league.id,
      competitionName: league.name ?? "",
      creatorId: league.creatorId,
      homeTeamId: leaguePairing.homeParticipant?.teamId ?? "",
      awayTeamId: leaguePairing.awayParticipant?.teamId ?? "",
      homeOwnerId: leaguePairing.homeParticipant?.team.ownerId ?? "",
      awayOwnerId: leaguePairing.awayParticipant?.team.ownerId ?? "",
      rules: LEAGUE_SHEET_RULES,
    };
  }

  const cupPairing = (await prisma.cupPairing.findUnique({
    where: { id: pairingId },
    select: {
      id: true,
      homeTeamId: true,
      awayTeamId: true,
      homeTeam: { select: { ownerId: true } },
      awayTeam: { select: { ownerId: true } },
      round: {
        select: {
          cup: { select: { id: true, name: true, creatorId: true } },
        },
      },
    },
  })) as CupPairingRow | null;

  if (!cupPairing) return null;
  // Exempt (bye) : aucune rencontre à saisir.
  if (!cupPairing.awayTeamId) return null;

  const cup = cupPairing.round.cup;
  return {
    kind: "cup",
    pairingId: cupPairing.id,
    competitionId: cup.id,
    competitionName: cup.name ?? "",
    creatorId: cup.creatorId,
    homeTeamId: cupPairing.homeTeamId,
    awayTeamId: cupPairing.awayTeamId,
    homeOwnerId: cupPairing.homeTeam?.ownerId ?? "",
    awayOwnerId: cupPairing.awayTeam?.ownerId ?? "",
    rules: CUP_SHEET_RULES,
  };
}
