// Pure helpers for the matchmaking queue screen.
// Network-free so they can be unit-tested in Node.

export const TV_RANGE_PO = 150_000;

export interface TeamOption {
  id: string;
  name: string;
  roster: string;
  currentValue: number;
}

export interface QueueStatusResponse {
  inQueue: boolean;
  status?: string;
  teamId?: string;
  teamValue?: number;
  matchId?: string | null;
  joinedAt?: string;
}

export interface JoinQueueMatchedResponse {
  matched: true;
  matchId: string;
  opponentUserId: string;
  matchToken: string;
}

export interface JoinQueueQueuedResponse {
  matched: false;
  queueId: string;
  teamValue: number;
  position: number;
}

export type JoinQueueResponse =
  | JoinQueueMatchedResponse
  | JoinQueueQueuedResponse;

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

export type QueueTransition =
  | { kind: "idle" }
  | { kind: "searching"; teamId?: string; teamValue?: number }
  | { kind: "matched"; matchId: string };

export function formatElapsed(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0:00";
  }
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatTVShort(po: number): string {
  if (!Number.isFinite(po) || po <= 0) {
    return "0k";
  }
  const k = Math.floor(po / 1000);
  return `${k}k`;
}

export function formatTVRange(teamValuePo: number): string {
  const min = Math.max(0, teamValuePo - TV_RANGE_PO);
  const max = teamValuePo + TV_RANGE_PO;
  return `${formatTVShort(min)} - ${formatTVShort(max)}`;
}

export function canStartSearch(teamId: string): ValidationResult {
  if (!teamId.trim()) {
    return { valid: false, error: "Selectionnez une equipe" };
  }
  return { valid: true };
}

export function reduceQueueTransition(
  status: QueueStatusResponse,
): QueueTransition {
  if (!status.inQueue) {
    return { kind: "idle" };
  }
  if (status.status === "searching") {
    return {
      kind: "searching",
      teamId: status.teamId,
      teamValue: status.teamValue,
    };
  }
  if (status.status === "matched" && status.matchId) {
    return { kind: "matched", matchId: status.matchId };
  }
  return { kind: "idle" };
}

export function getMatchmakingStatusLabel(status: string): string {
  switch (status) {
    case "searching":
      return "Recherche en cours";
    case "matched":
      return "Adversaire trouve";
    case "cancelled":
      return "Annulee";
    default:
      return status;
  }
}
