"use client";
import Link from "next/link";
import TeamLogo from "../../components/TeamLogo";
import TeamRosterLink from "../../leagues/[id]/TeamRosterLink";
import { dynamicRoute } from "../../lib/typed-route";
import { cupPredictionsPagePath } from "../../leagues/_components/prediction-rounds";
import { pointsLabel } from "../../leagues/_components/predictions";
import type { CupChampion, OracleEntry } from "./cup-champion";

/**
 * Palmarès d'une coupe jouée : son champion (vainqueur de la finale, sinon
 * premier du classement d'une coupe close) et son Oracle — ce que le récap
 * de saison annonce pour une ligue. Rien tant que la coupe n'est pas jouée.
 */
export function CupChampionBanner({
  cupId,
  champion,
  oracles,
}: {
  cupId: string;
  champion: CupChampion | null;
  oracles: readonly OracleEntry[];
}) {
  if (!champion) return null;
  return (
    <section
      data-testid="cup-champion"
      className="flex flex-wrap items-center gap-4 rounded-xl border border-nuffle-gold bg-gradient-to-r from-nuffle-gold/15 to-white p-4 shadow"
    >
      <TeamLogo
        slug={champion.team.roster}
        logoUrl={champion.team.logoUrl ?? null}
        size={56}
        className="shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-nuffle-bronze">
          🏆 Champion de la coupe
        </p>
        <p className="text-xl font-bold text-nuffle-anthracite">
          <TeamRosterLink
            leagueId={cupId}
            competition="cup"
            teamId={champion.team.id}
            canViewRoster
            testIdSuffix="champion"
          >
            {champion.team.name}
          </TeamRosterLink>
        </p>
        <p data-testid="cup-champion-detail" className="text-sm text-gray-600">
          {champion.team.coachName ? `Coach ${champion.team.coachName} · ` : ""}
          {champion.source === "final"
            ? `vainqueur de la finale${champion.finalScore ? ` (${champion.finalScore})` : ""}`
            : "en tête du classement final"}
        </p>
      </div>
      {oracles.length > 0 ? (
        <p data-testid="cup-oracle" className="text-sm text-gray-700">
          🔮 Oracle :{" "}
          <span className="font-semibold">
            {oracles.map((o) => o.displayName).join(", ")}
          </span>{" "}
          ({pointsLabel(oracles[0].points)}) —{" "}
          <Link
            href={dynamicRoute(cupPredictionsPagePath(cupId))}
            className="text-nuffle-bronze underline"
          >
            pronostics
          </Link>
        </p>
      ) : null}
    </section>
  );
}
