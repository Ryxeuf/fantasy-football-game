"use client";

import type {
  NflFantasyEntry,
  NflFantasyMatchup,
} from "../../../types";

interface OpponentBannerProps {
  matchup: NflFantasyMatchup | null;
  myEntryId: string;
  entries: ReadonlyArray<NflFantasyEntry>;
}

/**
 * Banniere "Tu joues contre X cette semaine". S'affiche entre le
 * picker semaine et la table du lineup. Si pas de matchup encore
 * genere pour cette semaine (cycle sans cycleId, ou settle pas
 * encore passe sur la 1ere semaine), n'affiche rien.
 */
export function OpponentBanner({
  matchup,
  myEntryId,
  entries,
}: OpponentBannerProps) {
  if (!matchup) return null;
  const opponentId =
    matchup.homeEntryId === myEntryId
      ? matchup.awayEntryId
      : matchup.homeEntryId;
  const opponent = entries.find((e) => e.id === opponentId);
  const opponentName = opponent?.teamName ?? "Adversaire inconnu";
  const isHome = matchup.homeEntryId === myEntryId;
  const settled = matchup.settledAt != null;

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-nuffle-bronze/30 bg-nuffle-ivory/40 px-4 py-3"
      data-testid="lineup-opponent-banner"
    >
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-nuffle-anthracite/60">
          Tu joues {isHome ? "à domicile" : "à l'extérieur"} contre
        </p>
        <p className="truncate text-base font-semibold text-nuffle-anthracite">
          🏈 {opponentName}
        </p>
      </div>
      {settled && (
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-nuffle-anthracite/60">
            Résultat
          </p>
          <p className="font-mono text-sm">
            {matchup.homeScore} - {matchup.awayScore}
            {matchup.winnerId === myEntryId && (
              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                Victoire
              </span>
            )}
            {matchup.winnerId !== null &&
              matchup.winnerId !== myEntryId && (
                <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  Défaite
                </span>
              )}
            {matchup.winnerId === null && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                Égalité
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
