"use client";

/**
 * Sprint Q lot Q.A.3 — Section "Rivalries" sur la page team.
 *
 * Fetch les top N rivaux d'une team (par defaut 3) et affiche un bilan
 * compact W-D-L par rival, avec un bouton "Voir l'historique" vers
 * la page vs.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "../../../../lib/api-client";

interface TeamBrief {
  id: string;
  slug: string;
  city: string;
  name: string;
  race: string;
  primaryColor: string | null;
  secondaryColor: string | null;
}

interface MatchBrief {
  matchId: string;
  seasonYear: number | null;
  scheduledAt: string | null;
  scoreHome: number | null;
  scoreAway: number | null;
}

interface TopRivalEntry {
  team: TeamBrief;
  totalMatches: number;
  winsFor: number;
  winsAgainst: number;
  draws: number;
  lastMatch: MatchBrief | null;
}

interface RivalriesResponse {
  rivals: TopRivalEntry[];
}

interface TeamRivalriesSectionProps {
  readonly teamSlug: string;
}

export function TeamRivalriesSection({
  teamSlug,
}: TeamRivalriesSectionProps): JSX.Element {
  const [rivals, setRivals] = useState<TopRivalEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiRequest<RivalriesResponse>(
      `/pro-league/teams/${encodeURIComponent(teamSlug)}/rivalries`,
    )
      .then((d) => {
        if (!cancelled) setRivals(Array.isArray(d?.rivals) ? d.rivals : []);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "fetch error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [teamSlug]);

  if (error) {
    return (
      <section className="mb-6" data-testid="rivalries-error">
        <h2 className="mb-2 text-lg font-semibold text-slate-100">
          Rivalries
        </h2>
        <p className="text-sm text-rose-400">{error}</p>
      </section>
    );
  }

  if (rivals === null) {
    return (
      <section className="mb-6" data-testid="rivalries-loading">
        <h2 className="mb-2 text-lg font-semibold text-slate-100">
          Rivalries
        </h2>
        <p className="text-sm text-slate-500">Chargement…</p>
      </section>
    );
  }

  if (rivals.length === 0) {
    return (
      <section className="mb-6" data-testid="rivalries-empty">
        <h2 className="mb-2 text-lg font-semibold text-slate-100">
          Rivalries
        </h2>
        <p className="text-sm text-slate-500">
          Pas encore de rival — il faut au moins 1 match completed contre
          une autre equipe.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-6" data-testid="rivalries-section">
      <h2 className="mb-2 text-lg font-semibold text-slate-100">
        Rivalries
      </h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rivals.map((r) => (
          <RivalCard key={r.team.id} teamSlug={teamSlug} entry={r} />
        ))}
      </div>
    </section>
  );
}

function RivalCard({
  teamSlug,
  entry,
}: {
  teamSlug: string;
  entry: TopRivalEntry;
}): JSX.Element {
  const { team, totalMatches, winsFor, winsAgainst, draws } = entry;
  return (
    <article
      className="rounded-lg border border-slate-800 bg-slate-900 p-3"
      data-testid={`rival-card-${team.slug}`}
      style={{
        borderLeftWidth: "4px",
        borderLeftColor: team.primaryColor ?? undefined,
      }}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-100">
            {team.city} {team.name}
          </div>
          <div className="text-xs text-slate-500">{team.race}</div>
        </div>
        <span className="font-mono text-xs text-slate-400">
          {totalMatches} match{totalMatches > 1 ? "es" : ""}
        </span>
      </div>
      <div
        className="my-2 flex items-center gap-2 text-xs"
        data-testid={`rival-record-${team.slug}`}
      >
        <span className="rounded bg-emerald-900/50 px-1.5 py-0.5 font-mono text-emerald-300">
          {winsFor}W
        </span>
        <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-300">
          {draws}D
        </span>
        <span className="rounded bg-rose-900/50 px-1.5 py-0.5 font-mono text-rose-300">
          {winsAgainst}L
        </span>
      </div>
      <Link
        href={`/pro-league/teams/${teamSlug}/vs/${team.slug}` as never}
        className="block text-xs text-amber-300 hover:underline"
        data-testid={`rival-link-${team.slug}`}
      >
        Voir l&apos;historique →
      </Link>
    </article>
  );
}
