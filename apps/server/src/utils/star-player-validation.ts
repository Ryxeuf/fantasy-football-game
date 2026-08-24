import {
  getStarPlayerPair,
  getStarPlayerPairs,
  resolveTeamRegionalRules,
  DEFAULT_RULESET,
  type Ruleset,
  type StarPlayerDefinition,
} from "@bb/game-engine";
import { getStarPlayerBySlugDb, getAvailableStarPlayersDb } from "./star-player-repository";

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
 * Lot G — la table des paires vient du catalogue (`getStarPlayerPairs`) et non
 * plus d'un `if` par paire : la version câblée ne couvrait que Grak &
 * Crumbleberry et les jumeaux Swift, en oubliant Dribl & Drull, pourtant déjà
 * déclarés dans `requiresPair`.
 */
export function validateStarPlayerPairs(
  starPlayerSlugs: string[],
  ruleset: Ruleset = DEFAULT_RULESET,
): { valid: boolean; error?: string } {
  const slugSet = new Set(starPlayerSlugs);
  const pairs = getStarPlayerPairs(ruleset);

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
): Promise<StarPlayerDefinition[]> {
  const regionalRules = resolveTeamRegionalRules(
    teamRoster,
    ruleset,
    regionalLeague,
  );
  if (!regionalRules || regionalRules.length === 0) {
    return [];
  }

  return getAvailableStarPlayersDb(teamRoster, regionalRules, ruleset);
}

/**
 * Vérifie si un Star Player nécessite un partenaire.
 * Lot G — source unique : le catalogue (`pairWith`), plus de table en dur.
 */
export function requiresPair(
  starPlayerSlug: string,
  ruleset: Ruleset = DEFAULT_RULESET,
): string | null {
  return getStarPlayerPair(starPlayerSlug, ruleset)?.partnerSlug ?? null;
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
): Promise<{ valid: boolean; error?: string; totalCost?: number }> {
  // 1. Vérifier les paires obligatoires
  const pairValidation = validateStarPlayerPairs(starPlayerSlugs);
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

