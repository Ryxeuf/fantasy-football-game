"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "../../lib/api-client";

import { type GazetteEdition, EditionDisplay } from "./_shared";

/**
 * Page d'accueil de la Nuffle Gazette — sprint 1.E.2.
 *
 * Affiche la dernière édition publiée + lien vers l'archive.
 */

interface LatestResponse {
  readonly edition: GazetteEdition | null;
}

interface DatesResponse {
  readonly dates: readonly string[];
}

export default function GazetteHomePage(): JSX.Element {
  const [edition, setEdition] = useState<GazetteEdition | null>(null);
  const [archiveDates, setArchiveDates] = useState<readonly string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      apiRequest<LatestResponse>("/pro-league/gazette/latest"),
      apiRequest<DatesResponse>("/pro-league/gazette/dates?limit=20"),
    ])
      .then(([latest, dates]) => {
        if (cancelled) return;
        setEdition(latest.edition);
        setArchiveDates(dates.dates);
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
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col bg-slate-950 px-4 py-6 text-slate-100">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-amber-200">
            🗞️ Nuffle Gazette
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Le quotidien officiel de la Pro League
          </p>
        </div>
        <Link
          href="/pro-league"
          className="rounded border border-slate-700 px-3 py-1 text-sm text-slate-300 hover:bg-slate-800"
        >
          ← Hub
        </Link>
      </header>

      {loading ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : error ? (
        <p
          role="alert"
          className="rounded border border-rose-700 bg-rose-950 px-3 py-2 text-sm text-rose-200"
        >
          {error}
        </p>
      ) : !edition ? (
        <p
          data-testid="gazette-no-edition"
          className="rounded border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-slate-400"
        >
          La Gazette n'a encore rien publié. Reviens demain matin pour le
          premier numéro !
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm text-slate-500">
            Édition du{" "}
            <span className="font-mono text-slate-300">{edition.date}</span>
          </p>
          <EditionDisplay edition={edition} />
        </>
      )}

      {archiveDates.length > 1 ? (
        <section className="mt-8" data-testid="gazette-archive">
          <h2 className="mb-2 text-lg font-semibold text-slate-100">
            Archive
          </h2>
          <ul className="flex flex-wrap gap-2">
            {archiveDates.slice(1).map((d) => (
              <li key={d}>
                <Link
                  href={`/pro-league/gazette/${d}`}
                  className="rounded border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
                >
                  {d}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
