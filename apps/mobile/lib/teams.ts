// Pure helpers for team management screens.
// Network-free so they can be unit-tested in node.

export const TEAM_NAME_MIN = 1;
export const TEAM_NAME_MAX = 100;
export const TEAM_VALUE_MIN = 100;
export const TEAM_VALUE_MAX = 2000;

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

export interface TeamSummary {
  id: string;
  name: string;
  roster: string;
  ruleset: string;
  createdAt: string;
  currentValue?: number;
}

export interface TeamPlayer {
  id: string;
  name: string;
  position: string;
  number: number;
  ma: number;
  st: number;
  ag: number;
  pa: number;
  av: number;
  skills: string;
}

export interface TeamDetail extends TeamSummary {
  treasury: number;
  rerolls: number;
  cheerleaders: number;
  assistants: number;
  apothecary: boolean;
  dedicatedFans: number;
  teamValue: number;
  initialBudget: number;
  players: TeamPlayer[];
  starPlayers?: Array<{
    id: string;
    slug: string;
    cost: number;
    name?: string;
  }>;
}

export interface RosterSummary {
  slug: string;
  name: string;
  budget: number;
  tier?: number | null;
  naf?: boolean | null;
}

export function validateTeamName(name: string): ValidationResult {
  const trimmed = name.trim();
  if (trimmed.length < TEAM_NAME_MIN) {
    return { valid: false, error: "Le nom de l'equipe est requis" };
  }
  if (trimmed.length > TEAM_NAME_MAX) {
    return {
      valid: false,
      error: `Le nom de l'equipe ne peut pas depasser ${TEAM_NAME_MAX} caracteres`,
    };
  }
  return { valid: true };
}

export function validateTeamValue(value: number): ValidationResult {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    return { valid: false, error: "La valeur d'equipe doit etre un entier" };
  }
  if (value < TEAM_VALUE_MIN || value > TEAM_VALUE_MAX) {
    return {
      valid: false,
      error: `La valeur d'equipe doit etre entre ${TEAM_VALUE_MIN} et ${TEAM_VALUE_MAX} K po`,
    };
  }
  return { valid: true };
}

// currentValue is stored as gold pieces (po). Display in thousands (K po).
export function formatTeamValue(currentValuePo: number | undefined): string {
  if (currentValuePo === undefined || currentValuePo === null) {
    return "0K po";
  }
  const k = Math.floor(currentValuePo / 1000);
  return `${k}K po`;
}

export function formatGoldShort(po: number): string {
  if (!po) return "0K";
  const k = po / 1000;
  if (Number.isInteger(k)) {
    return `${k}K`;
  }
  return `${k.toFixed(1)}K`;
}

export interface PositionCount {
  position: string;
  count: number;
}

export function countPlayersByPosition(players: TeamPlayer[]): PositionCount[] {
  const map = new Map<string, number>();
  for (const p of players) {
    map.set(p.position, (map.get(p.position) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([position, count]) => ({ position, count }))
    .sort((a, b) => a.position.localeCompare(b.position));
}

export function summarizeTeamRoster(team: TeamSummary): string {
  const value = formatTeamValue(team.currentValue);
  return `${team.roster} • ${value}`;
}

// Common BB3 budget choices, restricted to the supported range.
const BUDGET_CHOICES = [1000, 1100, 1200, 1300, 1500, 1800, 2000];

export function getTeamValueOptions(): number[] {
  return BUDGET_CHOICES.filter(
    (v) => v >= TEAM_VALUE_MIN && v <= TEAM_VALUE_MAX,
  );
}
