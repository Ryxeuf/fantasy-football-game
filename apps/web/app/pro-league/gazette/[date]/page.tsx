"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest, ApiClientError } from "../../../lib/api-client";

import { type GazetteEdition, EditionDisplay } from "../_shared";

/**
 * Archive : édition d'une date donnée — sprint 1.E.2.
 */

interface PageProps {
  readonly params: { date: string };
}

interface EditionResponse {
  readonly edition: GazetteEdition;
}

export default function GazetteArchivePage({
  params,
}: PageProps): JSX.Element {
  const [edition, setEdition] = useState<GazetteEdition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiRequest<EditionResponse>(
      `/pro-league/gazette/${encodeURIComponent(params.date)}`,
    )
      .then((d) => {
        if (cancelled) return;
        setEdition(d.edition);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiClientError && e.status === 400) {
          setError("Date invalide.");
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
  }, [params.date]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col bg-slate-950 px-4 py-6 text-slate-100">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-amber-200">
            🗞️ Nuffle Gazette
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Édition du{" "}
            <span className="font-mono text-slate-300">{params.date}</span>
          </p>
        </div>
        <Link
          href="/pro-league/gazette"
          className="rounded border border-slate-700 px-3 py-1 text-sm text-slate-300 hover:bg-slate-800"
        >
          ← Latest
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
      ) : edition ? (
        <EditionDisplay edition={edition} />
      ) : (
        <p
          data-testid="gazette-empty"
          className="text-sm text-slate-500"
        >
          Aucun article pour cette date.
        </p>
      )}
    </main>
  );
}
