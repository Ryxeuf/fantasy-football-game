// Pure helpers for the leagues screens.
// Network-free so they can be unit-tested in Node.

export const LEAGUE_STATUSES = [
  "draft",
  "open",
  "in_progress",
  "completed",
  "archived",
] as const;

export const LEAGUE_SEASON_STATUSES = [
  "draft",
  "scheduled",
  "in_progress",
  "completed",
] as const;

export type LeagueStatus = (typeof LEAGUE_STATUSES)[number];
export type LeagueSeasonStatus = (typeof LEAGUE_SEASON_STATUSES)[number];
export type LeagueStatusFilter = "all" | LeagueStatus;

export interface League {
  id: string;
  name: string;
  description: string | null;
  creatorId: string;
  ruleset: string;
  status: LeagueStatus | string;
  isPublic: boolean;
  maxParticipants: number;
  allowedRosters: string[] | null;
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  forfeitPoints: number;
  createdAt: string;
  updatedAt: string;
}

export interface LeagueCreator {
  id: string;
  coachName: string | null;
  email: string;
}

export interface LeagueSeasonSummary {
  id: string;
  seasonNumber: number;
  name: string;
  status: LeagueSeasonStatus | string;
  startDate: string | null;
  endDate: string | null;
}

export interface LeagueDetail extends League {
  creator: LeagueCreator;
  seasons: LeagueSeasonSummary[];
}

export interface LeagueRoundDetail {
  id: string;
  roundNumber: number;
  name: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
}

export interface LeagueParticipantDetail {
  id: string;
  seasonElo: number;
  status: string;
  teamId: string;
  team: {
    id: string;
    name: string;
    roster: string;
    owner: { id: string; coachName: string | null };
  };
}

export interface LeagueSeasonDetail {
  id: string;
  seasonNumber: number;
  name: string;
  status: LeagueSeasonStatus | string;
  startDate: string | null;
  endDate: string | null;
  leagueId: string;
  rounds: LeagueRoundDetail[];
  participants: LeagueParticipantDetail[];
}

export interface StandingRow {
  teamId: string;
  teamName?: string;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
}

const STATUS_LABELS: Record<LeagueStatus, string> = {
  draft: "Brouillon",
  open: "Ouverte",
  in_progress: "En cours",
  completed: "Terminee",
  archived: "Archivee",
};

const SEASON_STATUS_LABELS: Record<LeagueSeasonStatus, string> = {
  draft: "Brouillon",
  scheduled: "Planifiee",
  in_progress: "En cours",
  completed: "Terminee",
};

const RULESET_LABELS: Record<string, string> = {
  season_2: "Saison 2",
  season_3: "Saison 3",
};

export function isValidLeagueStatus(value: unknown): value is LeagueStatus {
  return (
    typeof value === "string" &&
    (LEAGUE_STATUSES as readonly string[]).includes(value)
  );
}

export function isValidLeagueSeasonStatus(
  value: unknown,
): value is LeagueSeasonStatus {
  return (
    typeof value === "string" &&
    (LEAGUE_SEASON_STATUSES as readonly string[]).includes(value)
  );
}

export function formatLeagueStatusLabel(status: string): string {
  if (isValidLeagueStatus(status)) {
    return STATUS_LABELS[status];
  }
  return status;
}

export function formatLeagueSeasonStatusLabel(status: string): string {
  if (isValidLeagueSeasonStatus(status)) {
    return SEASON_STATUS_LABELS[status];
  }
  return status;
}

export function formatLeagueRulesetLabel(ruleset: string): string {
  return RULESET_LABELS[ruleset] ?? ruleset;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function parseAllowedRosters(value: unknown): string[] | null {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) return null;
  return value.filter((v): v is string => typeof v === "string");
}

function parseLeague(value: unknown): League | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = asString(raw.id, "");
  if (!id) return null;
  return {
    id,
    name: asString(raw.name, ""),
    description: asNullableString(raw.description),
    creatorId: asString(raw.creatorId, ""),
    ruleset: asString(raw.ruleset, ""),
    status: asString(raw.status, ""),
    isPublic: asBoolean(raw.isPublic, false),
    maxParticipants: asNumber(raw.maxParticipants, 0),
    allowedRosters: parseAllowedRosters(raw.allowedRosters),
    winPoints: asNumber(raw.winPoints, 0),
    drawPoints: asNumber(raw.drawPoints, 0),
    lossPoints: asNumber(raw.lossPoints, 0),
    forfeitPoints: asNumber(raw.forfeitPoints, 0),
    createdAt: asString(raw.createdAt, ""),
    updatedAt: asString(raw.updatedAt, ""),
  };
}

export function parseLeagueListResponse(response: unknown): League[] {
  const raw = (response ?? {}) as Record<string, unknown>;
  const list = Array.isArray(raw.leagues) ? raw.leagues : [];
  return list.map(parseLeague).filter((l): l is League => l !== null);
}

export function filterLeaguesByStatus(
  leagues: ReadonlyArray<League>,
  filter: LeagueStatusFilter,
): League[] {
  if (filter === "all") return [...leagues];
  return leagues.filter((l) => l.status === filter);
}

function parseCreator(value: unknown): LeagueCreator {
  const raw = (value ?? {}) as Record<string, unknown>;
  return {
    id: asString(raw.id, ""),
    coachName: asNullableString(raw.coachName),
    email: asString(raw.email, ""),
  };
}

function parseSeasonSummary(value: unknown): LeagueSeasonSummary | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = asString(raw.id, "");
  if (!id) return null;
  return {
    id,
    seasonNumber: asNumber(raw.seasonNumber, 0),
    name: asString(raw.name, ""),
    status: asString(raw.status, ""),
    startDate: asNullableString(raw.startDate),
    endDate: asNullableString(raw.endDate),
  };
}

export function parseLeagueDetailResponse(
  response: unknown,
): LeagueDetail | null {
  if (!response || typeof response !== "object") return null;
  const raw = response as Record<string, unknown>;
  const league = parseLeague(raw.league);
  if (!league) return null;
  const leagueRaw = raw.league as Record<string, unknown>;
  const seasonsInput = Array.isArray(leagueRaw.seasons) ? leagueRaw.seasons : [];
  return {
    ...league,
    creator: parseCreator(leagueRaw.creator),
    seasons: seasonsInput
      .map(parseSeasonSummary)
      .filter((s): s is LeagueSeasonSummary => s !== null),
  };
}

function parseRound(value: unknown): LeagueRoundDetail | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = asString(raw.id, "");
  if (!id) return null;
  return {
    id,
    roundNumber: asNumber(raw.roundNumber, 0),
    name: asNullableString(raw.name),
    status: asString(raw.status, ""),
    startDate: asNullableString(raw.startDate),
    endDate: asNullableString(raw.endDate),
  };
}

function parseParticipant(value: unknown): LeagueParticipantDetail | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = asString(raw.id, "");
  if (!id) return null;
  const teamRaw = (raw.team ?? {}) as Record<string, unknown>;
  const ownerRaw = (teamRaw.owner ?? {}) as Record<string, unknown>;
  return {
    id,
    seasonElo: asNumber(raw.seasonElo, 0),
    status: asString(raw.status, ""),
    teamId: asString(raw.teamId, asString(teamRaw.id, "")),
    team: {
      id: asString(teamRaw.id, ""),
      name: asString(teamRaw.name, ""),
      roster: asString(teamRaw.roster, ""),
      owner: {
        id: asString(ownerRaw.id, ""),
        coachName: asNullableString(ownerRaw.coachName),
      },
    },
  };
}

export function parseSeasonDetailResponse(
  response: unknown,
): LeagueSeasonDetail | null {
  if (!response || typeof response !== "object") return null;
  const raw = response as Record<string, unknown>;
  const seasonRaw = (raw.season ?? null) as Record<string, unknown> | null;
  if (!seasonRaw) return null;
  const id = asString(seasonRaw.id, "");
  if (!id) return null;
  const roundsInput = Array.isArray(seasonRaw.rounds) ? seasonRaw.rounds : [];
  const participantsInput = Array.isArray(seasonRaw.participants)
    ? seasonRaw.participants
    : [];
  return {
    id,
    seasonNumber: asNumber(seasonRaw.seasonNumber, 0),
    name: asString(seasonRaw.name, ""),
    status: asString(seasonRaw.status, ""),
    startDate: asNullableString(seasonRaw.startDate),
    endDate: asNullableString(seasonRaw.endDate),
    leagueId: asString(seasonRaw.leagueId, ""),
    rounds: roundsInput
      .map(parseRound)
      .filter((r): r is LeagueRoundDetail => r !== null),
    participants: participantsInput
      .map(parseParticipant)
      .filter((p): p is LeagueParticipantDetail => p !== null),
  };
}

function parseStandingRow(value: unknown): StandingRow | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const teamId = asString(raw.teamId, "");
  if (!teamId) return null;
  return {
    teamId,
    teamName: typeof raw.teamName === "string" ? raw.teamName : undefined,
    points: asNumber(raw.points, 0),
    wins: asNumber(raw.wins, 0),
    draws: asNumber(raw.draws, 0),
    losses: asNumber(raw.losses, 0),
    goalsFor: asNumber(raw.goalsFor, 0),
    goalsAgainst: asNumber(raw.goalsAgainst, 0),
  };
}

export function parseStandingsResponse(response: unknown): StandingRow[] {
  const raw = (response ?? {}) as Record<string, unknown>;
  const list = Array.isArray(raw.standings) ? raw.standings : [];
  return list.map(parseStandingRow).filter((s): s is StandingRow => s !== null);
}
