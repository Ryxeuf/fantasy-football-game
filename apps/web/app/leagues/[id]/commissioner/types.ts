/**
 * Types partages par l'editeur commissaire d'une equipe de ligue.
 *
 * Miroir des reponses de `GET /leagues/:leagueId/teams/:teamId/roster`
 * et `GET /leagues/:leagueId/teams/:teamId/settings`.
 */

export interface EditPlayer {
  id: string;
  name: string;
  position: string;
  number: number;
  ma: number;
  st: number;
  ag: number;
  pa: number | null;
  av: number;
  skills: string;
  spp: number;
  dead: boolean;
}

/** Acces competences + innees d'un poste (fourni par l'API). */
export interface PositionAccess {
  /** Nom d'affichage du poste (ex: "Blitzer Orque"). Optionnel pour
      retro-compat avec un serveur pre-deploiement de ce champ. */
  displayName?: string;
  primarySkills: string | null;
  secondarySkills: string | null;
  innateSkills: string[];
}

export interface RosterResponse {
  team: {
    id: string;
    name: string;
    roster: string;
    treasury: number;
    ruleset?: string | null;
  };
  players: EditPlayer[];
  accessByPosition?: Record<string, PositionAccess>;
}

export interface SkillCatalogItem {
  slug: string;
  nameFr: string;
  category: string;
}

export interface TeamStaff {
  rerolls: number;
  cheerleaders: number;
  assistants: number;
  apothecary: boolean;
  dedicatedFans: number;
}

export interface StaffConfig {
  rerollCost: number;
  maxRerolls: number;
  apothecaryAllowed: boolean;
  apothecaryCost: number;
  maxCheerleaders: number;
  cheerleaderCost: number;
  maxAssistants: number;
  assistantCost: number;
  maxDedicatedFans: number;
  dedicatedFanCost: number;
}

export interface RegionalLeagueOption {
  slug: string;
  label: string;
  description: string | null;
  grants: string[];
}

/** `GET .../settings` — staff, plafonds/couts et Ligue regionale. */
export interface TeamSettings {
  team: {
    id: string;
    name: string;
    roster: string;
    ruleset: string;
    format: string;
    treasury: number;
    teamValue: number;
    currentValue: number;
    tournamentRuleset: string | null;
    tournamentRulesetLabel: string | null;
  };
  staff: TeamStaff;
  staffConfig: StaffConfig;
  regionalLeague: {
    current: string | null;
    currentLabel: string | null;
    applicable: boolean;
    options: RegionalLeagueOption[];
  };
  starPlayers: string[];
}

/** Resultat de `PATCH .../regional-league`. */
export interface RegionalLeagueUpdate {
  regionalLeague: string | null;
  label: string | null;
  orphanedStarPlayers: string[];
}
