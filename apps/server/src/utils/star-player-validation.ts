import {
  getStarPlayerBySlug,
  getAvailableStarPlayers,
  TEAM_REGIONAL_RULES,
  type StarPlayerDefinition,
} from "@bb/game-engine";

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
export function validateStarPlayerHire(
  starPlayerSlug: string,
  teamRoster: string,
  currentPlayerCount: number,
  currentStarPlayers: TeamStarPlayerData[],
  availableBudget: number
): StarPlayerValidationResult {
  // 1. Vérifier que le Star Player existe
  const starPlayer = getStarPlayerBySlug(starPlayerSlug);
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

  // 3. Vérifier la disponibilité selon les règles régionales
  const regionalRules = TEAM_REGIONAL_RULES[teamRoster];
  if (!regionalRules) {
    return {
      valid: false,
      error: `Roster '${teamRoster}' non reconnu`,
    };
  }

  const availablePlayers = getAvailableStarPlayers(teamRoster, regionalRules);
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
 * Valide les paires obligatoires de Star Players
 * (Grak & Crumbleberry, Lucien & Valen Swift)
 */
export function validateStarPlayerPairs(
  starPlayerSlugs: string[]
): { valid: boolean; error?: string } {
  const slugSet = new Set(starPlayerSlugs);

  // Grak & Crumbleberry doivent être recrutés ensemble
  const hasGrak = slugSet.has("grak");
  const hasCrumbleberry = slugSet.has("crumbleberry");

  if (hasGrak !== hasCrumbleberry) {
    return {
      valid: false,
      error: "Grak et Crumbleberry doivent être recrutés ensemble",
    };
  }

  // Lucien & Valen Swift doivent être recrutés ensemble
  const hasLucien = slugSet.has("lucien_swift");
  const hasValen = slugSet.has("valen_swift");

  if (hasLucien !== hasValen) {
    return {
      valid: false,
      error: "Lucien Swift et Valen Swift doivent être recrutés ensemble",
    };
  }

  return { valid: true };
}

/**
 * Calcule le coût total des Star Players en incluant les paires
 */
export function calculateStarPlayersCost(starPlayerSlugs: string[]): number {
  let totalCost = 0;

  for (const slug of starPlayerSlugs) {
    const starPlayer = getStarPlayerBySlug(slug);
    if (starPlayer) {
      totalCost += starPlayer.cost;
    }
  }

  return totalCost;
}

/**
 * Obtient les Star Players disponibles pour une équipe donnée
 */
export function getTeamAvailableStarPlayers(
  teamRoster: string
): StarPlayerDefinition[] {
  const regionalRules = TEAM_REGIONAL_RULES[teamRoster];
  if (!regionalRules) {
    return [];
  }

  return getAvailableStarPlayers(teamRoster, regionalRules);
}

/**
 * Vérifie si un Star Player nécessite un partenaire
 */
export function requiresPair(starPlayerSlug: string): string | null {
  const pairs: Record<string, string> = {
    grak: "crumbleberry",
    crumbleberry: "grak",
    lucien_swift: "valen_swift",
    valen_swift: "lucien_swift",
  };

  return pairs[starPlayerSlug] || null;
}

/**
 * Valide une liste complète de Star Players pour une équipe
 */
export function validateStarPlayersForTeam(
  starPlayerSlugs: string[],
  teamRoster: string,
  currentPlayerCount: number,
  availableBudget: number
): { valid: boolean; error?: string; totalCost?: number } {
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
  const regionalRules = TEAM_REGIONAL_RULES[teamRoster];
  if (!regionalRules) {
    return {
      valid: false,
      error: `Roster '${teamRoster}' non reconnu`,
    };
  }

  const availablePlayers = getAvailableStarPlayers(teamRoster, regionalRules);
  const availableSlugs = new Set(availablePlayers.map((sp) => sp.slug));

  for (const slug of starPlayerSlugs) {
    const starPlayer = getStarPlayerBySlug(slug);
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
  const totalCost = calculateStarPlayersCost(starPlayerSlugs);
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

