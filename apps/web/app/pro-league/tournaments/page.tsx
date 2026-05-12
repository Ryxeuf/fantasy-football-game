"use client";

/**
 * Sprint P — Lot P.B.2 : page Tournois Pro League.
 *
 * Liste les tournois ouverts aux inscriptions (`status='open'`).
 * Bouton "S'inscrire (X Crowns)" qui debit le wallet et confirme.
 * Idempotent : un user deja inscrit voit le badge "Inscrit".
 *
 * Auth requise pour s'inscrire — fallback redirect login si pas
 * connecte.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest, ApiClientError } from "../../lib/api-client";

interface Tournament {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly entryFeeCrowns: number;
  readonly maxEntries: number | null;
  readonly status: string;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
  readonly entriesCount: number;
  readonly createdAt: string;
}

interface ListResponse {
  readonly tournaments: readonly Tournament[];
}

interface EnterResponse {
  readonly granted: boolean;
  readonly entryId: string;
  readonly paidCrowns: number;
  readonly balance: number;
}

export default function TournamentsPage(): JSX.Element {
  const [tournaments, setTournaments] = useState<readonly Tournament[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enteringId, setEnteringId] = useState<string | null>(null);
  const [enteredIds, setEnteredIds] = useState<Set<string>>(new Set());
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    apiRequest<ListResponse>("/pro-league/tournaments")
      .then((r) => setTournaments(r.tournaments))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Erreur reseau"),
      );
  }, []);

  async function handleEnter(tournament: Tournament): Promise<void> {
    setError(null);
    setEnteringId(tournament.id);
    try {
      const result = await apiRequest<EnterResponse>(
        `/pro-league/tournaments/${encodeURIComponent(tournament.id)}/enter`,
        { method: "POST" },
      );
      setEnteredIds((prev) => new Set([...prev, tournament.id]));
      setWalletBalance(result.balance);
    } catch (e) {
      if (e instanceof ApiClientError) {
        if (e.status === 401) {
          window.location.href =
            "/login?redirect=" +
            encodeURIComponent("/pro-league/tournaments");
          return;
        }
        setError(e.message || `Erreur ${e.status}`);
      } else {
        setError(e instanceof Error ? e.message : "Erreur reseau");
      }
    } finally {
      setEnteringId(null);
    }
  }

  if (tournaments === null && error === null) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="mb-4 text-2xl font-bold">Tournois Pro League</h1>
        <p className="text-sm text-slate-400">Chargement…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-2 text-2xl font-bold">Tournois Pro League</h1>
      <p className="mb-4 text-sm text-slate-400">
        Inscris-toi a un tournoi (entry fee en Crowns). Une inscription
        par utilisateur par tournoi.
      </p>

      {walletBalance !== null ? (
        <p
          data-testid="wallet-balance"
          className="mb-4 text-sm text-emerald-300"
        >
          Solde wallet : {walletBalance.toLocaleString("fr-FR")} Crowns
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          data-testid="tournament-error"
          className="mb-4 rounded border border-red-700 bg-red-900/30 p-3 text-sm text-red-200"
        >
          {error}
        </p>
      ) : null}

      {tournaments && tournaments.length === 0 ? (
        <p
          data-testid="tournaments-empty"
          className="text-sm text-slate-400"
        >
          Aucun tournoi ouvert pour le moment. Reviens plus tard !
        </p>
      ) : null}

      <ul className="space-y-3">
        {(tournaments ?? []).map((t) => {
          const entered = enteredIds.has(t.id);
          const full =
            t.maxEntries !== null && t.entriesCount >= t.maxEntries;
          return (
            <li
              key={t.id}
              data-testid={`tournament-${t.slug}`}
              className="rounded border border-slate-800 bg-slate-900 p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">
                    {t.name}
                  </h2>
                  {t.description ? (
                    <p className="mt-1 text-sm text-slate-400">
                      {t.description}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-slate-500">
                    {t.entriesCount} inscrit{t.entriesCount > 1 ? "s" : ""}
                    {t.maxEntries !== null ? ` / ${t.maxEntries} max` : ""}
                  </p>
                </div>
                {entered ? (
                  <span
                    data-testid={`tournament-entered-${t.slug}`}
                    className="rounded bg-emerald-900/40 px-3 py-1.5 text-sm text-emerald-200"
                  >
                    Inscrit
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleEnter(t)}
                    disabled={enteringId === t.id || full}
                    data-testid={`tournament-enter-${t.slug}`}
                    className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-emerald-50 hover:bg-emerald-600 disabled:opacity-50"
                  >
                    {full
                      ? "Complet"
                      : enteringId === t.id
                        ? "Inscription…"
                        : `S'inscrire (${t.entryFeeCrowns} Crowns)`}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 text-xs text-slate-500">
        <Link href="/pro-league/me/wallet" className="underline">
          Voir mon wallet
        </Link>
      </p>
    </main>
  );
}
