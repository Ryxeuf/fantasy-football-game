import {
  resolveTeamRegionalRules,
  DEFAULT_RULESET,
  type Ruleset,
  type StarPlayerDefinition,
} from "@bb/game-engine";
import {
  getStarPlayerBySlugDb,
  getAvailableStarPlayersDb,
  getStarPlayerPairDb,
  getStarPlayerPairsDb,
} from "./star-player-repository";
import { getDeclaredRegionalRules } from "./roster-helpers";

/**
 * Ligues DÉCLARÉES par le roster (`Roster.regionalRules`, repli catalogue via
 * `effectiveRegionalRules`).
 *
 * Sans cette liste, `resolveTeamRegionalRules` retombe silencieusement sur la
 * table `TEAM_REGIONAL_RULES_BY_RULESET` compilée : une Ligue retirée ou
 * ajoutée en admin ne changeait ni l'embauche ni l'offre de Star Players (le
 * GET la prenait en compte, le POST non), et un roster créé uniquement en base
 * était refusé avec « Roster 'X' non reconnu ».
 *
 * Les appelants qui ont déjà la liste sous la main (build, création) peuvent
 * la passer pour éviter une lecture supplémentaire.
 */
async function declaredRulesFor(
  rosterSlug: string,
  ruleset: Ruleset,
  provided?: readonly string[] | null,
): Promise<readonly string[] | null> {
  if (provided && provided.length > 0) return provided;
  return getDeclaredRegionalRules(rosterSlug, ruleset);
}

export interface StarPlayerValidationResult {
  valid: boolean;
  error?: string;
  starPlayer?: StarPlayerDefinition;
}

export interface TeamStarPlayerData {
  starPlayerSlug: string;
  cost: number;
}

/**
 * Valide si un Star Player peut être recruté par une équipe
 */
export async function validateStarPlayerHire(
  starPlayerSlug: string,
  teamRoster: string,
  currentPlayerCount: number,
  currentStarPlayers: TeamStarPlayerData[],
  availableBudget: number,
  ruleset: Ruleset = DEFAULT_RULESET,
  regionalLeague?: string | null,
  declaredRules?: readonly string[] | null,
): Promise<StarPlayerValidationResult> {
  // 1. Vérifier que le Star Player existe
  const starPlayer = await getStarPlayerBySlugDb(starPlayerSlug, ruleset);
  if (!starPlayer) {
    return {
      valid: false,
      error: `Star Player '${starPlayerSlug}' introuvable`,
    };
  }

  // 2. Vérifier que le Star Player n'est pas déjà recruté
  const alreadyHired = currentStarPlayers.some(
    (sp) => sp.starPlayerSlug === starPlayerSlug
  );
  if (alreadyHired) {
    return {
      valid: false,
      error: `${starPlayer.displayName} est déjà recruté dans cette équipe`,
    };
  }

  // 3. Vérifier la disponibilité selon les règles régionales EFFECTIVES :
  // la Ligue choisie à la création (et l'alignement qu'elle apporte), ou
  // l'union historique du roster si l'équipe n'a pas de choix enregistré.
  const regionalRules = resolveTeamRegionalRules(
    teamRoster,
    ruleset,
    regionalLeague,
    await declaredRulesFor(teamRoster, ruleset, declaredRules),
  );
  if (!regionalRules || regionalRules.length === 0) {
    return {
      valid: false,
      error: `Roster '${teamRoster}' non reconnu`,
    };
  }

  const availablePlayers = await getAvailableStarPlayersDb(
    teamRoster,
    regionalRules,
    ruleset,
  );
  const isAvailable = availablePlayers.some((sp) => sp.slug === starPlayerSlug);

  if (!isAvailable) {
    return {
      valid: false,
      error: `${starPlayer.displayName} n'est pas disponible pour les équipes ${teamRoster}`,
    };
  }

  // 4. Vérifier la limite de 16 joueurs (joueurs normaux + Star Players)
  const totalPlayers = currentPlayerCount + currentStarPlayers.length;
  if (totalPlayers >= 16) {
    return {
      valid: false,
      error: `Limite de 16 joueurs atteinte (${currentPlayerCount} joueurs + ${currentStarPlayers.length} Star Players)`,
    };
  }

  // 5. Vérifier le budget
  if (starPlayer.cost > availableBudget) {
    return {
      valid: false,
      error: `Budget insuffisant. Coût: ${(starPlayer.cost / 1000).toLocaleString()} K po, disponible: ${(availableBudget / 1000).toLocaleString()} K po`,
    };
  }

  return {
    valid: true,
    starPlayer,
  };
}

/**
 * Valide les paires obligatoires de Star Players.
 *
 * Lot G — la table des paires vient du catalogue et non plus d'un `if` par
 * paire : la version câblée ne couvrait que Grak & Crumbleberry et les
 * jumeaux Swift, en oubliant Dribl & Drull.
 *
 * Lot 6.3 — ce catalogue est maintenant servi par la BASE
 * (`StarPlayer.pairWithSlug`), avec repli sur la table compilée du moteur :
 * une paire corrigée en admin s'applique immédiatement à l'embauche.
 */
export async function validateStarPlayerPairs(
  starPlayerSlugs: string[],
  ruleset: Ruleset = DEFAULT_RULESET,
): Promise<{ valid: boolean; error?: string }> {
  const slugSet = new Set(starPlayerSlugs);
  const pairs = await getStarPlayerPairsDb(ruleset);

  for (const slug of slugSet) {
    const pair = pairs[slug];
    if (!pair) continue;
    if (!slugSet.has(pair.partnerSlug)) {
      return {
        valid: false,
        error: `Ce Star Player doit être recruté avec ${pair.partnerName}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Calcule le coût total des Star Players en incluant les paires
 */
export async function calculateStarPlayersCost(starPlayerSlugs: string[], ruleset: Ruleset = DEFAULT_RULESET): Promise<number> {
  let totalCost = 0;

  for (const slug of starPlayerSlugs) {
    const starPlayer = await getStarPlayerBySlugDb(slug, ruleset);
    if (starPlayer) {
      totalCost += starPlayer.cost;
    }
  }

  return totalCost;
}

/**
 * Obtient les Star Players disponibles pour une équipe donnée
 */
export async function getTeamAvailableStarPlayers(
  teamRoster: string,
  ruleset: Ruleset = DEFAULT_RULESET,
  regionalLeague?: string | null,
  declaredRules?: readonly string[] | null,
): Promise<StarPlayerDefinition[]> {
  const regionalRules = resolveTeamRegionalRules(
    teamRoster,
    ruleset,
    regionalLeague,
    await declaredRulesFor(teamRoster, ruleset, declaredRules),
  );
  if (!regionalRules || regionalRules.length === 0) {
    return [];
  }

  return getAvailableStarPlayersDb(teamRoster, regionalRules, ruleset);
}

/**
 * Vérifie si un Star Player nécessite un partenaire.
 * Lot G — source unique : le catalogue (`pairWith`), plus de table en dur.
 * Lot 6.3 — résolu en base (`StarPlayer.pairWithSlug`), repli moteur.
 */
export async function requiresPair(
  starPlayerSlug: string,
  ruleset: Ruleset = DEFAULT_RULESET,
): Promise<string | null> {
  return (
    (await getStarPlayerPairDb(starPlayerSlug, ruleset))?.partnerSlug ?? null
  );
}

/**
 * Valide une liste complète de Star Players pour une équipe
 */
export async function validateStarPlayersForTeam(
  starPlayerSlugs: string[],
  teamRoster: string,
  currentPlayerCount: number,
  availableBudget: number,
  ruleset: Ruleset = DEFAULT_RULESET,
  regionalLeague?: string | null,
  declaredRules?: readonly string[] | null,
): Promise<{ valid: boolean; error?: string; totalCost?: number }> {
  // 1. Vérifier les paires obligatoires (au ruleset de l'équipe : les paires
  // de la Saison 3 ne s'appliquent pas à une équipe Saison 2).
  const pairValidation = await validateStarPlayerPairs(starPlayerSlugs, ruleset);
  if (!pairValidation.valid) {
    return pairValidation;
  }

  // 2. Vérifier la limite de 16 joueurs
  const totalPlayers = currentPlayerCount + starPlayerSlugs.length;
  if (totalPlayers > 16) {
    return {
      valid: false,
      error: `Limite de 16 joueurs dépassée (${currentPlayerCount} joueurs + ${starPlayerSlugs.length} Star Players = ${totalPlayers})`,
    };
  }

  // 3. Vérifier que tous les Star Players existent et sont disponibles
  const regionalRules = resolveTeamRegionalRules(
    teamRoster,
    ruleset,
    regionalLeague,
    await declaredRulesFor(teamRoster, ruleset, declaredRules),
  );
  if (!regionalRules || regionalRules.length === 0) {
    return {
      valid: false,
      error: `Roster '${teamRoster}' non reconnu`,
    };
  }

  const availablePlayers = await getAvailableStarPlayersDb(
    teamRoster,
    regionalRules,
    ruleset,
  );
  const availableSlugs = new Set(availablePlayers.map((sp) => sp.slug));

  for (const slug of starPlayerSlugs) {
    const starPlayer = await getStarPlayerBySlugDb(slug, ruleset);
    if (!starPlayer) {
      return {
        valid: false,
        error: `Star Player '${slug}' introuvable`,
      };
    }

    if (!availableSlugs.has(slug)) {
      return {
        valid: false,
        error: `${starPlayer.displayName} n'est pas disponible pour cette équipe`,
      };
    }
  }

  // 4. Vérifier qu'il n'y a pas de doublons
  const uniqueSlugs = new Set(starPlayerSlugs);
  if (uniqueSlugs.size !== starPlayerSlugs.length) {
    return {
      valid: false,
      error: "Un Star Player ne peut être recruté qu'une seule fois",
    };
  }

  // 5. Vérifier le budget
  const totalCost = await calculateStarPlayersCost(starPlayerSlugs, ruleset);
  if (totalCost > availableBudget) {
    return {
      valid: false,
      error: `Budget insuffisant. Coût total: ${(totalCost / 1000).toLocaleString()} K po, disponible: ${(availableBudget / 1000).toLocaleString()} K po`,
    };
  }

  return {
    valid: true,
    totalCost,
  };
}

