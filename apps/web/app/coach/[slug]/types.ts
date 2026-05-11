/**
 * Public DTO returned by `GET /coach/:slug` (S26.3c, enriched in S26.3f).
 *
 * Mirrors the server-side `CoachPublicProfile` from
 * `apps/server/src/services/coach-profile.ts`. Duplicated rather than
 * imported because the web app must not pull server-only modules
 * (Prisma, etc.) through a shared type barrel.
 */
export interface CoachPublicProfile {
  id: string;
  slug: string;
  coachName: string;
  /**
   * ELO du coach. `null` quand le coach est masque du classement par un admin
   * (`leaderboardStatusVisible === false`) — un badge "Non classe" est rendu
   * a la place et la courbe ELO 90j est masquee.
   */
  eloRating: number | null;
  isSupporter: boolean;
  supporterTier: string | null;
  /** ISO 8601 timestamp of the User.createdAt. */
  memberSince: string;
  /**
   * `true` (defaut) si le coach apparait dans le classement ELO public et que
   * son ELO est visible sur son profil. `false` si un admin a masque le coach
   * via `PATCH /admin/users/:id/leaderboard-status`. Optionnel pour
   * retro-compat avec les reponses API ne renvoyant pas encore le champ.
   */
  leaderboardStatusVisible?: boolean;
  /** S26.3f — vitrine des derniers succes deverrouilles. */
  achievements: CoachShowcaseAchievement[];
  /** S26.3h — equipes recentes du coach. */
  recentTeams: CoachRecentTeam[];
  /** S26.6d/e — titres de saisons thematiques remportes (Champion {Theme} {YYYY}). */
  championships?: CoachThemedChampionship[];
  /** S27.1d/e — titres de Nuffle Cup mensuelles remportes. */
  cupChampionships?: CoachCupChampionship[];
  /** L2.C.2 — titres de saisons de ligue remportes (toutes ligues confondues). */
  leagueChampionships?: CoachLeagueChampionship[];
}

export interface CoachCupChampionship {
  cupId: string;
  cupName: string;
  monthlyYear: number;
  monthlyMonth: number;
  /** "Champion Nuffle Cup {Mois} {YYYY}". */
  label: string;
}

export interface CoachLeagueChampionship {
  seasonId: string;
  leagueId: string;
  leagueName: string;
  seasonNumber: number;
  seasonName: string;
  /** "Champion {LeagueName} — {SeasonName}". */
  label: string;
  /** ISO 8601 timestamp du snapshot d'awards (createdAt). null si pas de snapshot. */
  wonAt: string | null;
}

export interface CoachThemedChampionship {
  seasonId: string;
  theme: string;
  themeYear: number;
  /** "Champion {Theme} {YYYY}". */
  label: string;
  leagueId: string;
  leagueName: string;
  /** Couleur hex du badge (derivee du catalogue serveur). */
  badgeColor: string;
}

export interface CoachShowcaseAchievement {
  slug: string;
  nameFr: string;
  nameEn: string;
  icon: string;
  category: string;
  /** ISO 8601 timestamp. */
  unlockedAt: string;
}

export interface CoachRecentTeam {
  id: string;
  name: string;
  roster: string;
  currentValue: number;
  /** ISO 8601 timestamp of the team creation. */
  createdAt: string;
}

/**
 * S26.3n — Single point in the ELO history curve rendered by `CoachEloChart`.
 *
 * Mirrors the server-side `CoachEloSnapshot` from
 * `apps/server/src/services/coach-profile.ts`. Duplicated for the same
 * reason as `CoachPublicProfile` above.
 */
export interface CoachEloSnapshot {
  rating: number;
  delta: number;
  /** ISO 8601 timestamp. */
  recordedAt: string;
}
