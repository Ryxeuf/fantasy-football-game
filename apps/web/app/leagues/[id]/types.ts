export type LeagueStatus =
  | "draft"
  | "open"
  | "in_progress"
  | "completed"
  | "archived";

export type LeagueSeasonStatus =
  | "draft"
  | "scheduled"
  | "in_progress"
  | "completed";

export type LeagueRoundStatus = "pending" | "in_progress" | "completed";

export type LeagueParticipantStatus = "active" | "withdrawn";

export interface LeagueSeasonSummary {
  id: string;
  seasonNumber: number;
  name: string;
  status: LeagueSeasonStatus | string;
  startDate: string | null;
  endDate: string | null;
}

export interface LeagueDetail {
  id: string;
  name: string;
  description: string | null;
  creatorId: string;
  creator: { id: string; coachName: string | null; email: string };
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
  seasons: LeagueSeasonSummary[];
}

export interface LeagueRoundDetail {
  id: string;
  roundNumber: number;
  name: string | null;
  status: LeagueRoundStatus | string;
  startDate: string | null;
  endDate: string | null;
}

export interface LeagueParticipantDetail {
  id: string;
  seasonElo: number;
  status: LeagueParticipantStatus | string;
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
  league: {
    id: string;
    name: string;
    creatorId: string;
    allowedRosters: string[] | null;
  };
  rounds: LeagueRoundDetail[];
  participants: LeagueParticipantDetail[];
}

export interface StandingRow {
  participantId: string;
  teamId: string;
  teamName: string;
  roster: string;
  ownerId: string;
  coachName: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  touchdownsFor: number;
  touchdownsAgainst: number;
  touchdownDifference: number;
  casualtiesFor: number;
  casualtiesAgainst: number;
  seasonElo: number;
  status: string;
}
