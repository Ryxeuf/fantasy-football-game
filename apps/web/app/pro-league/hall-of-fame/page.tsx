"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "../../lib/api-client";

import { WalletBadge } from "../_components/WalletBadge";

/**
 * Hall of Fame Pro League — sprint 1.E.5.
 *
 * Liste des joueurs immortalises (mort en match au MVP, autres
 * criteres a venir). Filtrable par equipe via query param `team=slug`.
 */

interface HallOfFameEntry {
  readonly id: string;
  readonly playerName: string;
  readonly teamSlug: string;
  readonly teamName: string;
  readonly race: string;
  readonly position: string;
  readonly reason: string;
  readonly citation: string | null;
  readonly inductedAt: string;
}

interface HallOfFameData {
  readonly entries: readonly HallOfFameEntry[];
}

const REASON_LABELS: Record<string, string> = {
  death_in_match: "Mort en match",
  career_tds: "TDs carriere",
  mvp_legend: "Legende MVP",
  title: "Titre",
};

function reasonLabel(code: string): string {
  return REASON_LABELS[code] ?? code;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function HallOfFamePage(): JSX.Element {
  const [data, setData] = useState<HallOfFameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiRequest<HallOfFameData>(`/pro-league/hall-of-fame?limit=100`)
      .then((d) => {
        if (cancelled) return;
        setData(d);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
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

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col bg-slate-950 px-4 py-6 text-slate-100">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-wide text-amber-200">
          Hall of Fame
        </h1>
        <div className="flex items-center gap-2">
          <WalletBadge />
          <Link
            href="/pro-league"
            className="rounded border border-slate-700 px-3 py-1 text-sm text-slate-300 hover:bg-slate-800"
          >
            ← Hub
          </Link>
        </div>
      </header>

      <p className="mb-4 text-sm text-slate-400">
        Les joueurs immortalises de la Old World League. Tombes au champ
        d&apos;honneur de Nuffle ou couronnes par leur palmares.
      </p>

      {loading ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : error ? (
        <p
          role="alert"
          className="rounded border border-rose-700 bg-rose-950 px-3 py-2 text-sm text-rose-200"
        >
          {error}
        </p>
      ) : !data || data.entries.length === 0 ? (
        <p
          data-testid="empty-hof"
          className="rounded border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-slate-400"
        >
          Aucun joueur au Hall of Fame pour le moment. Soyez patient — Nuffle
          finira par reclamer son du.
        </p>
      ) : (
        <ul
          data-testid="hof-list"
          className="flex flex-col gap-2"
        >
          {data.entries.map((e) => (
            <li
              key={e.id}
              data-testid="hof-entry"
              className="rounded border border-slate-800 bg-slate-900 px-3 py-3"
            >
              <div className="flex items-baseline justify-between">
                <h2 className="text-base font-semibold text-amber-100">
                  {e.playerName}
                </h2>
                <span className="text-xs font-mono text-slate-500">
                  {formatDate(e.inductedAt)}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-slate-400">
                <Link
                  href={`/pro-league/teams/${e.teamSlug}`}
                  className="text-slate-300 hover:text-amber-200"
                >
                  {e.teamName}
                </Link>{" "}
                — {e.race} · {e.position}
              </p>
              <p className="mt-1 text-xs uppercase tracking-wide text-amber-400/80">
                {reasonLabel(e.reason)}
              </p>
              {e.citation ? (
                <p className="mt-1 text-sm italic text-slate-300">
                  « {e.citation} »
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
