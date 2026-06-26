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
  /** FR17 — coups de pouce autorisés (slugs) ; null = tous autorisés. */
  allowedInducements?: string[] | null;
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  forfeitPoints: number;
  /**
   * E1 — Regles de points bonus (JSON brut renvoye par l'API : array
   * natif PG ou string serialisee sqlite). Parse cote client via
   * `parseBonusRulesFromApi`. Optionnel pour retro-compat pre-E1.
   */
  bonusPointsConfig?: unknown;
  createdAt: string;
  updatedAt: string;
  seasons: LeagueSeasonSummary[];
  /**
   * L2.D — verrou d'edition : true des qu'un match d'une saison a ete
   * joue/saisi. Quand true, le commissaire ne peut plus modifier les
   * parametres de la ligue (le bouton "Modifier" est masque).
   */
  hasScoredMatch?: boolean;
}

export type LeaguePairingStatus =
  | "scheduled"
  | "in_progress"
  | "played"
  | "forfeit_home"
  | "forfeit_away"
  | "cancelled";

export interface LeaguePairingTeamDetail {
  id: string;
  teamId: string;
  team: {
    id: string;
    name: string;
    roster: string;
    ownerId: string;
  };
}

export interface LeaguePairingDetail {
  id: string;
  status: LeaguePairingStatus | string;
  scheduledAt: string | null;
  deadlineAt: string | null;
  homeParticipant: LeaguePairingTeamDetail;
  awayParticipant: LeaguePairingTeamDetail;
  match: { id: string; status: string; mode?: string } | null;
  /**
   * E3 — Snapshot des points bonus appliqués à ce pairing (Lot E,
   * renseigné à la validation du résultat). `bonusBreakdown` est le
   * détail brut [{ ruleId, label, side, points }] (array PG ou string
   * sqlite). Optionnels pour rétro-compat.
   */
  bonusPointsHome?: number;
  bonusPointsAway?: number;
  bonusBreakdown?: unknown;
}

export interface LeagueRoundDetail {
  id: string;
  roundNumber: number;
  name: string | null;
  status: LeagueRoundStatus | string;
  startDate: string | null;
  endDate: string | null;
  pairings?: LeaguePairingDetail[];
}

/** Lot C — poule (groupe) d'une saison. */
export interface LeaguePool {
  id: string;
  name: string;
  order: number;
  color: string | null;
  /** Nombre d'équipes de cette poule qualifiées pour les play-offs. */
  qualifiesForPlayoffs: number;
  _count?: { participants: number };
}

/** Lot C — classement d'une poule (un bloc de standings par poule). */
export interface PoolStandings {
  poolId: string;
  poolName: string;
  poolOrder: number;
  qualifiesForPlayoffs: number;
  standings: StandingRow[];
}

export interface LeagueParticipantDetail {
  id: string;
  seasonElo: number;
  status: LeagueParticipantStatus | string;
  teamId: string;
  /** Lot C — poule d'affectation (null si non assigné). */
  poolId?: string | null;
  // L2.B.5 — flag "coup de mecene" deja joue pour cette saison.
  mecenePlayed?: boolean;
  mecenePlayedAt?: string | null;
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
  /**
   * L2.B.5 — "Coup de mecene" activable par le commissaire. Optionnel
   * pour retro-compat API pre-L2.B.5 (absent => considere desactive).
   */
  meceneEnabled?: boolean;
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
  /** Lot C — poule d'affectation (null si non assigné). */
  poolId?: string | null;
  /**
   * E2 — Sous-total de points bonus de la saison (déjà inclus dans
   * `points`). Optionnel pour rétro-compat API pré-E2.
   */
  bonusPoints?: number;
}
