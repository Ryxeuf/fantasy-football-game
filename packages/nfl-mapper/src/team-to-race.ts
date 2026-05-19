import teamsData from '../data/teams.json' with { type: 'json' };
import type { BbRace, NflTeamCode, TeamMeta, TeamPalette } from './types.js';

interface RawTeam {
  readonly code: string;
  readonly city: string;
  readonly race: string;
  readonly raceLabel: string;
}

interface RawData {
  readonly teams: readonly RawTeam[];
  readonly palettesByRace: Readonly<Record<string, TeamPalette>>;
}

const RAW = teamsData as unknown as RawData;

function buildTeamMeta(raw: RawTeam, palette: TeamPalette): TeamMeta {
  return {
    code: raw.code as NflTeamCode,
    city: raw.city,
    race: raw.race as BbRace,
    raceLabel: raw.raceLabel,
    palette,
  };
}

const TEAMS_BY_CODE: ReadonlyMap<NflTeamCode, TeamMeta> = (() => {
  const map = new Map<NflTeamCode, TeamMeta>();
  for (const raw of RAW.teams) {
    const palette = RAW.palettesByRace[raw.race];
    if (!palette) {
      throw new Error(`[nfl-mapper] missing palette for race "${raw.race}" (team ${raw.code})`);
    }
    map.set(raw.code as NflTeamCode, buildTeamMeta(raw, palette));
  }
  return map;
})();

const ALL_TEAMS: readonly TeamMeta[] = Object.freeze([...TEAMS_BY_CODE.values()]);

const TEAMS_BY_RACE: ReadonlyMap<BbRace, readonly TeamMeta[]> = (() => {
  const map = new Map<BbRace, TeamMeta[]>();
  for (const team of ALL_TEAMS) {
    const list = map.get(team.race);
    if (list) {
      list.push(team);
    } else {
      map.set(team.race, [team]);
    }
  }
  const frozen = new Map<BbRace, readonly TeamMeta[]>();
  for (const [race, list] of map) {
    frozen.set(race, Object.freeze([...list]));
  }
  return frozen;
})();

/**
 * Retourne les metadonnees d'une equipe par son code NFL.
 *
 * @throws {Error} Si le code n'existe pas dans la table.
 */
export function getTeamMeta(code: NflTeamCode): TeamMeta {
  const team = TEAMS_BY_CODE.get(code);
  if (!team) {
    throw new Error(`[nfl-mapper] unknown team code "${code}"`);
  }
  return team;
}

/**
 * Variante safe : retourne undefined si le code n'existe pas.
 * Utile cote ingestion ou un team code inattendu peut apparaitre
 * (relocation future, typo dans le payload upstream).
 */
export function tryGetTeamMeta(code: string): TeamMeta | undefined {
  return TEAMS_BY_CODE.get(code as NflTeamCode);
}

/**
 * Retourne les 32 equipes NFL, ordre stable (ordre du JSON source).
 */
export function getAllTeams(): readonly TeamMeta[] {
  return ALL_TEAMS;
}

/**
 * Retourne les equipes assignees a une race BB donnee.
 * Q5 : 4 equipes par race, fixe.
 */
export function getTeamsByRace(race: BbRace): readonly TeamMeta[] {
  return TEAMS_BY_RACE.get(race) ?? [];
}
