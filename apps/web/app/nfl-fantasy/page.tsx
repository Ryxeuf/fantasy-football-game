"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest, ApiClientError } from "../lib/api-client";
import type { ListLeaguesResponse, NflFantasyLeague } from "./types";

function statusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Draft en cours";
    case "in_progress":
      return "En saison";
    case "completed":
      return "Terminée";
    default:
      return status;
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "draft":
      return "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30";
    case "in_progress":
      return "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30";
    case "completed":
      return "bg-slate-500/20 text-slate-300 ring-1 ring-slate-500/30";
    default:
      return "bg-slate-500/20 text-slate-300 ring-1 ring-slate-500/30";
  }
}

export default function NflFantasyDashboardPage() {
  const [leagues, setLeagues] = useState<NflFantasyLeague[] | null>(null);
  const [error, setError] = useState<{ message: string; status?: number } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const body = await apiRequest<ListLeaguesResponse>(
          "/api/nfl-fantasy/leagues",
        );
        if (!cancelled) setLeagues(body.leagues ?? []);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiClientError) {
          setError({ message: err.message, status: err.status });
        } else {
          setError({
            message: err instanceof Error ? err.message : "Erreur inconnue",
          });
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error?.status === 401) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-6">
        <h1 className="text-xl font-semibold">Authentification requise</h1>
        <p className="mt-2 text-sm text-slate-400">
          Connecte-toi pour accéder à tes leagues NFL Fantasy.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-flex items-center rounded-md bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-400"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Mes leagues NFL Fantasy</h1>
          <p className="mt-1 text-sm text-slate-400">
            Drafte, choisis ton lineup chaque semaine, batte tes adversaires en SPP.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/nfl-fantasy/new"
            className="rounded-md bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-400"
            data-testid="nfl-fantasy-create-cta"
          >
            + Créer une league
          </Link>
          <Link
            href="/nfl-fantasy/join"
            className="rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 hover:border-slate-500"
            data-testid="nfl-fantasy-join-cta"
          >
            Rejoindre
          </Link>
        </div>
      </div>

      {error && error.status !== 401 && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          Erreur : {error.message}
        </div>
      )}

      {leagues === null && !error && (
        <div className="text-sm text-slate-400">Chargement…</div>
      )}

      {leagues !== null && leagues.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-10 text-center">
          <p className="text-base text-slate-300">
            Tu n&apos;es membre d&apos;aucune league pour le moment.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Crée la tienne ou rejoins-en une via un invite code.
          </p>
        </div>
      )}

      {leagues !== null && leagues.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="nfl-fantasy-league-list">
          {leagues.map((lg) => (
            <li
              key={lg.id}
              className="group rounded-lg border border-slate-800 bg-slate-900/60 p-4 hover:border-slate-600"
            >
              <Link href={`/nfl-fantasy/leagues/${lg.id}`} className="block">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-semibold text-slate-100 group-hover:text-orange-300">
                    {lg.name}
                  </h2>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${statusBadgeClass(lg.status)}`}
                  >
                    {statusLabel(lg.status)}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
                  <div>
                    <dt className="text-slate-500">Saison</dt>
                    <dd>{lg.seasonId}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Taille</dt>
                    <dd>{lg.size}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Draft</dt>
                    <dd className="capitalize">{lg.draftMode}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Type</dt>
                    <dd className="capitalize">{lg.type}</dd>
                  </div>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
