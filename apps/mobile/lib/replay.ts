// Pure helpers for the mobile replay screen.
// Network-free so they can be unit-tested in node.

import type { ReplayTurnPayload } from "@bb/game-engine";

export const REPLAY_DEFAULT_SPEED_MS = 1000;

export interface ReplaySpeedOption {
  label: string;
  ms: number;
}

export const REPLAY_SPEED_OPTIONS: readonly ReplaySpeedOption[] = [
  { label: "0.5x", ms: 2000 },
  { label: "1x", ms: 1000 },
  { label: "2x", ms: 500 },
  { label: "4x", ms: 250 },
];

export interface ReplayTeamMeta {
  coachName: string;
  teamName: string;
  roster: string;
}

export interface ReplayTeamsMeta {
  teamA: ReplayTeamMeta | null;
  teamB: ReplayTeamMeta | null;
}

export interface ReplayResponse {
  matchId: string;
  status: string;
  turns: ReplayTurnPayload[];
  teams: ReplayTeamsMeta;
  createdAt?: string;
}

export function clampFrameIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  if (index < 0) return 0;
  if (index >= length) return length - 1;
  return index;
}

export function nextFrameIndex(current: number, length: number): number {
  if (length <= 0) return 0;
  const last = length - 1;
  return current < last ? current + 1 : last;
}

export function prevFrameIndex(current: number): number {
  return current > 0 ? current - 1 : 0;
}

const MOVE_LABELS: Record<string, string> = {
  move: "Deplacement",
  block: "Blocage",
  blitz: "Blitz",
  pass: "Passe",
  handoff: "Transmission",
  foul: "Agression",
  "end-turn": "Fin de tour",
  select: "Selection",
  "choose-block-result": "Choix du bloc",
  "choose-push-direction": "Choix de poussee",
  "follow-up": "Poursuite",
};

export function getMoveLabel(moveType: string | undefined | null): string {
  if (!moveType) return "Action";
  return MOVE_LABELS[moveType] ?? moveType;
}

export function formatTeamsTitle(teams: ReplayTeamsMeta): string {
  const a = formatSingleTeam(teams.teamA, "Equipe A");
  const b = formatSingleTeam(teams.teamB, "Equipe B");
  return `${a} vs ${b}`;
}

function formatSingleTeam(
  team: ReplayTeamMeta | null,
  fallback: string,
): string {
  if (!team) return fallback;
  const name = team.teamName || fallback;
  const coach = team.coachName?.trim();
  return coach ? `${name} (${coach})` : name;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseTeamMeta(value: unknown): ReplayTeamMeta | null {
  if (!isRecord(value)) return null;
  const coachName = typeof value.coachName === "string" ? value.coachName : "";
  const teamName = typeof value.teamName === "string" ? value.teamName : "";
  const roster = typeof value.roster === "string" ? value.roster : "";
  return { coachName, teamName, roster };
}

export function parseReplayResponse(response: unknown): ReplayResponse {
  if (!isRecord(response)) {
    throw new Error("Invalid replay response");
  }

  const rawTurns = Array.isArray(response.turns) ? response.turns : [];
  const turns = rawTurns.filter(isRecord) as ReplayTurnPayload[];

  const rawTeams = isRecord(response.teams) ? response.teams : {};
  const teams: ReplayTeamsMeta = {
    teamA: parseTeamMeta(rawTeams.teamA),
    teamB: parseTeamMeta(rawTeams.teamB),
  };

  return {
    matchId: typeof response.matchId === "string" ? response.matchId : "",
    status: typeof response.status === "string" ? response.status : "",
    turns,
    teams,
    createdAt:
      typeof response.createdAt === "string" ? response.createdAt : undefined,
  };
}

export function formatMatchDate(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
