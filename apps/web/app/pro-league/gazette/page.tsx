"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "../../lib/api-client";
import { useLanguage } from "../../contexts/LanguageContext";

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
  const { t } = useLanguage();
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
            {t.proLeague.gazette.title}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {t.proLeague.gazette.subtitle}
          </p>
        </div>
        <Link
          href="/pro-league"
          className="rounded border border-slate-700 px-3 py-1 text-sm text-slate-300 hover:bg-slate-800"
        >
          {t.proLeague.common.backToHub}
        </Link>
      </header>

      {loading ? (
        <p className="text-sm text-slate-400">{t.proLeague.common.loading}</p>
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
          {t.proLeague.gazette.noEditionYet}
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm text-slate-500">
            {t.proLeague.gazette.editionDate}{" "}
            <span className="font-mono text-slate-300">{edition.date}</span>
          </p>
          <EditionDisplay edition={edition} />
        </>
      )}

      {archiveDates.length > 1 ? (
        <section className="mt-8" data-testid="gazette-archive">
          <h2 className="mb-2 text-lg font-semibold text-slate-100">
            {t.proLeague.gazette.archiveTitle}
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
