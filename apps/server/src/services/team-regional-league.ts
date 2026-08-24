/**
 * Résolution de la Ligue régionale d'une équipe à la création.
 *
 * Règle : une équipe appartient à UNE Ligue régionale, choisie au moment de
 * construire la Liste d'Équipe. C'est ce choix qui débloque les Star Players
 * recrutables et les Coups de Pouce accessibles — et, pour les Nordiques,
 * l'alignement Favori de Khorne s'ils rejoignent le Clash du Chaos.
 *
 * Trois cas :
 *  - le roster n'a qu'une Ligue possible → elle est attribuée d'office ;
 *  - il en a plusieurs → le choix est OBLIGATOIRE (8 rosters en Saison 3 :
 *    Nains du Chaos, Nains, Gnomes, Gobelins, Halflings, Nordiques, Ogres,
 *    Elfes Sylvains) ;
 *  - un règlement de tournoi neutralise l'axe régional
 *    (`regionalLeagueChoice: false`) → aucune Ligue n'est demandée.
 *
 * Le choix est immuable après la création : il conditionne des recrutements
 * déjà effectués (Star Players) et les Coups de Pouce d'une saison entière.
 */

import {
  allowsRegionalLeagueChoice,
  getRegionalLeagueBySlug,
  getRegionalLeagueOptions,
  type Ruleset,
  type TournamentRulesetDefinition,
} from '@bb/game-engine';

export type RegionalLeagueErrorCode = 'choice_required' | 'invalid_choice';

export class RegionalLeagueError extends Error {
  constructor(
    public readonly code: RegionalLeagueErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'RegionalLeagueError';
  }
}

/** Libellé français d'une Ligue (repli sur le slug si inconnu). */
function leagueLabel(slug: string): string {
  return getRegionalLeagueBySlug(slug)?.nameFr ?? slug;
}

export interface ResolveRegionalLeagueInput {
  readonly roster: string;
  readonly ruleset: Ruleset;
  /** Règlement de tournoi de l'équipe (null = règles standard). */
  readonly pack?: TournamentRulesetDefinition | null;
  /** Slug demandé par le client (undefined/null = non fourni). */
  readonly requested?: string | null;
  /**
   * Ligues DÉCLARÉES par le roster (`Roster.regionalRules`, repli sur le
   * catalogue du moteur — cf. `loadDeclaredRegionalRules`). Les options
   * possibles s'y limitent : le serveur accepte exactement ce que la fiche
   * du roster et le sélecteur de création affichent. Absent ⇒ catalogue du
   * moteur.
   */
  readonly declaredRules?: readonly string[] | null;
}

/**
 * Ligue à enregistrer sur l'équipe, ou `null` si l'axe régional ne
 * s'applique pas. Lève `RegionalLeagueError` si le choix manque ou si la
 * Ligue demandée n'est pas ouverte à ce roster.
 */
export function resolveRegionalLeagueForCreation({
  roster,
  ruleset,
  pack,
  requested,
  declaredRules,
}: ResolveRegionalLeagueInput): string | null {
  if (!allowsRegionalLeagueChoice(pack)) return null;

  const options = getRegionalLeagueOptions(roster, ruleset, declaredRules);
  if (options.length === 0) return null;

  const wanted = requested?.trim();
  if (wanted) {
    if (!options.some((o) => o.slug === wanted)) {
      throw new RegionalLeagueError(
        'invalid_choice',
        `Ligue régionale invalide pour ce roster. Choix possibles : ${options
          .map((o) => leagueLabel(o.slug))
          .join(', ')}`,
      );
    }
    return wanted;
  }

  // Une seule Ligue possible : rien à demander au coach.
  if (options.length === 1) return options[0].slug;

  throw new RegionalLeagueError(
    'choice_required',
    `Ce roster doit choisir sa Ligue régionale à la création. Choix possibles : ${options
      .map((o) => leagueLabel(o.slug))
      .join(', ')}`,
  );
}
