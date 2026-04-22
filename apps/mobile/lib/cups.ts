// Pure helpers for the cups screens.
// Network-free so they can be unit-tested in Node.

export const CUP_STATUSES = [
  "ouverte",
  "en_cours",
  "terminee",
  "archivee",
] as const;

export type CupStatus = (typeof CUP_STATUSES)[number];
export type CupStatusFilter = "all" | CupStatus;

export interface CupCreator {
  id: string;
  coachName: string;
  email: string;
}

export interface CupParticipant {
  id: string;
  name: string;
  roster: string;
  ruleset: string;
  owner: CupCreator;
}

export interface Cup {
  id: string;
  name: string;
  ruleset: string;
  status: CupStatus | string;
  isPublic: boolean;
  creatorId: string;
  creator: CupCreator;
  participantCount: number;
  participants: CupParticipant[];
  createdAt: string;
  updatedAt: string;
}

export interface CupStandingRow {
  teamId: string;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor?: number;
  goalsAgainst?: number;
}

export interface CupMatchSummary {
  id: string;
  status: string;
}

export interface CupDetail extends Cup {
  standings: CupStandingRow[];
  matches: CupMatchSummary[];
}

const STATUS_LABELS: Record<CupStatus, string> = {
  ouverte: "Ouverte",
  en_cours: "En cours",
  terminee: "Terminee",
  archivee: "Archivee",
};

export function isValidCupStatus(value: unknown): value is CupStatus {
  return (
    typeof value === "string" && (CUP_STATUSES as readonly string[]).includes(value)
  );
}

export function formatCupStatusLabel(status: string): string {
  if (isValidCupStatus(status)) {
    return STATUS_LABELS[status];
  }
  return status;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function parseCreator(value: unknown): CupCreator {
  const raw = (value ?? {}) as Record<string, unknown>;
  return {
    id: asString(raw.id, ""),
    coachName: asString(raw.coachName, ""),
    email: asString(raw.email, ""),
  };
}

function parseParticipant(value: unknown): CupParticipant | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = asString(raw.id, "");
  if (!id) return null;
  return {
    id,
    name: asString(raw.name, ""),
    roster: asString(raw.roster, ""),
    ruleset: asString(raw.ruleset, ""),
    owner: parseCreator(raw.owner),
  };
}

function parseCup(value: unknown): Cup | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = asString(raw.id, "");
  if (!id) return null;
  const participantsInput = Array.isArray(raw.participants) ? raw.participants : [];
  const participants = participantsInput
    .map(parseParticipant)
    .filter((p): p is CupParticipant => p !== null);
  const creatorId = asString(raw.creatorId, "");
  const creator = parseCreator(raw.creator);
  if (!creator.id && creatorId) {
    creator.id = creatorId;
  }
  return {
    id,
    name: asString(raw.name, ""),
    ruleset: asString(raw.ruleset, ""),
    status: asString(raw.status, ""),
    isPublic: asBoolean(raw.isPublic, false),
    creatorId,
    creator,
    participantCount: asNumber(raw.participantCount, 0),
    participants,
    createdAt: asString(raw.createdAt, ""),
    updatedAt: asString(raw.updatedAt, ""),
  };
}

export function parseCupListResponse(response: unknown): Cup[] {
  const raw = (response ?? {}) as Record<string, unknown>;
  const list = Array.isArray(raw.cups) ? raw.cups : [];
  return list.map(parseCup).filter((c): c is Cup => c !== null);
}

export function filterCupsByStatus(
  cups: ReadonlyArray<Cup>,
  filter: CupStatusFilter,
): Cup[] {
  if (filter === "all") return [...cups];
  return cups.filter((c) => c.status === filter);
}

export function sortCupsByRecent(cups: ReadonlyArray<Cup>): Cup[] {
  return [...cups].sort((a, b) => {
    if (a.updatedAt === b.updatedAt) return 0;
    return a.updatedAt < b.updatedAt ? 1 : -1;
  });
}

function parseStandingRow(value: unknown): CupStandingRow | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const teamId = asString(raw.teamId, "");
  if (!teamId) return null;
  return {
    teamId,
    points: asNumber(raw.points, 0),
    wins: asNumber(raw.wins, 0),
    draws: asNumber(raw.draws, 0),
    losses: asNumber(raw.losses, 0),
    goalsFor: asNumber(raw.goalsFor, 0),
    goalsAgainst: asNumber(raw.goalsAgainst, 0),
  };
}

function parseCupMatch(value: unknown): CupMatchSummary | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = asString(raw.id, "");
  if (!id) return null;
  return { id, status: asString(raw.status, "") };
}

export function parseCupDetailResponse(response: unknown): CupDetail | null {
  if (!response || typeof response !== "object") return null;
  const cup = parseCup(response);
  if (!cup) return null;
  const raw = response as Record<string, unknown>;
  const standings = Array.isArray(raw.standings) ? raw.standings : [];
  const matches = Array.isArray(raw.matches) ? raw.matches : [];
  return {
    ...cup,
    standings: standings
      .map(parseStandingRow)
      .filter((s): s is CupStandingRow => s !== null),
    matches: matches
      .map(parseCupMatch)
      .filter((m): m is CupMatchSummary => m !== null),
  };
}
