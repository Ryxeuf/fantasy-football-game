/**
 * Saison NFL cote web — miroir de `currentSeasonId` du cron serveur
 * (`apps/server/src/services/nfl-fantasy-cron.ts`) : juillet-decembre =
 * saison de l'annee, janvier-juin = saison precedente. Pur.
 */
export function currentNflSeasonId(now: Date): string {
  const year = now.getUTCFullYear();
  return String(now.getUTCMonth() >= 6 ? year : year - 1);
}

/** Premiere saison ingeree (backfill 2023+2024, cf. doc 22). */
export const OLDEST_NFL_SEASON = 2023;

/** Saisons proposees dans un selecteur, la plus recente d'abord. Pur. */
export function nflSeasonOptions(now: Date): readonly string[] {
  const latest = Number(currentNflSeasonId(now));
  const out: string[] = [];
  for (let y = latest; y >= OLDEST_NFL_SEASON; y--) out.push(String(y));
  return out;
}
