"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiClientError, apiRequest } from "../../lib/api-client";

/**
 * Newsfeed perso Pro League — sprint 1.C.4.
 *
 * Liste les matchs upcoming + recent des équipes suivies par l'user.
 * Auth-required (401 → message "se connecter").
 */

interface FeedTeam {
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly primaryColor: string | null;
}

interface FeedEntry {
  readonly matchId: string;
  readonly status: string;
  readonly scheduledAt: string;
  readonly roundNumber: number;
  readonly seasonYear: number;
  readonly followedTeam: FeedTeam;
  readonly opponent: FeedTeam;
  readonly isHome: boolean;
  readonly scoreHome: number | null;
  readonly scoreAway: number | null;
  readonly outcome: string | null;
  readonly category: "upcoming" | "recent";
}

function FeedRow({ entry }: { entry: FeedEntry }): JSX.Element {
  const at = new Date(entry.scheduledAt);
  const formatted = at.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const finished = entry.category === "recent";
  const won =
    finished &&
    ((entry.isHome && entry.outcome === "home") ||
      (!entry.isHome && entry.outcome === "away"));
  const drew = finished && entry.outcome === "draw";
  const resultClass = finished
    ? won
      ? "text-emerald-300"
      : drew
        ? "text-slate-300"
        : "text-rose-300"
    : "text-emerald-200";

  return (
    <Link
      href={`/pro-league/matches/${entry.matchId}/live`}
      data-testid="feed-row"
      className="flex items-center justify-between gap-3 rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm hover:bg-slate-800"
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block h-3 w-3 rounded-full ring-1 ring-slate-700"
          style={{ background: entry.followedTeam.primaryColor ?? "#475569" }}
        />
        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-slate-100">
            <span className="font-medium">{entry.followedTeam.name}</span>
            <span className="text-xs text-slate-500">
              {entry.isHome ? "vs" : "@"}
            </span>
            <span>{entry.opponent.name}</span>
          </div>
          <span className="text-xs text-slate-500">
            R{entry.roundNumber} · saison {entry.seasonYear}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end">
        {finished ? (
          <span className={`font-mono ${resultClass}`}>
            {entry.scoreHome}–{entry.scoreAway}
          </span>
        ) : (
          <span className={`font-mono text-xs uppercase ${resultClass}`}>
            {entry.status}
          </span>
        )}
        <span className="text-xs text-slate-500">{formatted}</span>
      </div>
    </Link>
  );
}

export default function ProLeagueFeedPage(): JSX.Element {
  const [entries, setEntries] = useState<readonly FeedEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNeedsAuth(false);
    apiRequest<{ entries: readonly FeedEntry[] }>("/pro-league/me/feed")
      .then((d) => {
        if (cancelled) return;
        setEntries(d.entries);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiClientError && e.status === 401) {
          setNeedsAuth(true);
          return;
        }
        const msg = e instanceof Error ? e.message : "fetch error";
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const recent = entries?.filter((e) => e.category === "recent") ?? [];
  const upcoming = entries?.filter((e) => e.category === "upcoming") ?? [];

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col bg-slate-950 px-4 py-6 text-slate-100">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-wide text-slate-50">
          Mon feed
        </h1>
        <Link
          href="/pro-league"
          className="rounded border border-slate-700 px-3 py-1 text-sm text-slate-300 hover:bg-slate-800"
        >
          ← Hub
        </Link>
      </header>

      {loading ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : needsAuth ? (
        <p
          data-testid="auth-required"
          className="rounded border border-amber-700 bg-amber-950 px-3 py-2 text-sm text-amber-200"
        >
          Connecte-toi pour suivre tes équipes Pro League préférées et
          consulter ton feed personnalisé.
        </p>
      ) : error ? (
        <p
          role="alert"
          className="rounded border border-rose-700 bg-rose-950 px-3 py-2 text-sm text-rose-200"
        >
          {error}
        </p>
      ) : entries && entries.length === 0 ? (
        <p
          data-testid="empty-feed"
          className="rounded border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-slate-400"
        >
          Tu ne suis aucune équipe pour l'instant. Explore les fiches
          équipes et clique sur "+ Suivre" pour personnaliser ton feed.
        </p>
      ) : (
        <>
          {recent.length > 0 ? (
            <section data-testid="feed-recent" className="mb-6">
              <h2 className="mb-2 text-lg font-semibold text-slate-100">
                Derniers résultats
              </h2>
              <div className="flex flex-col gap-2">
                {recent.map((e) => (
                  <FeedRow key={`r-${e.matchId}`} entry={e} />
                ))}
              </div>
            </section>
          ) : null}
          {upcoming.length > 0 ? (
            <section data-testid="feed-upcoming">
              <h2 className="mb-2 text-lg font-semibold text-slate-100">
                À venir
              </h2>
              <div className="flex flex-col gap-2">
                {upcoming.map((e) => (
                  <FeedRow key={`u-${e.matchId}`} entry={e} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
