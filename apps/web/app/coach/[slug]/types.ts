/**
 * Public DTO returned by `GET /coach/:slug` (S26.3c).
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
  eloRating: number;
  isSupporter: boolean;
  supporterTier: string | null;
  /** ISO 8601 timestamp of the User.createdAt. */
  memberSince: string;
}
