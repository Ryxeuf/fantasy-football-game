"use client";

/**
 * Sprint R — Lot R.E.2 : page liste matches async.
 *
 * Liste les matches en mode `async` de l'utilisateur courant, classes :
 *   1. Ton tour en premier (isYourTurn=true)
 *   2. En attente adverse ensuite
 *   3. Termines/abandonnes a la fin
 *
 * Chaque ligne affiche le countdown via `<AsyncMatchCountdown>`.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

import { AsyncMatchCountdown } from "../../../components/AsyncMatchCountdown";
import { apiRequest } from "../../../lib/api-client";

interface AsyncMatch {
  readonly id: string;
  readonly status: string;
  readonly seed: string;
  readonly createdAt: string;
  readonly mode: "realtime" | "async";
  readonly currentTurnUserId: string | null;
  readonly currentTurnDeadline: string | null;
  readonly turnDeadlineHours: number;
}

interface ListResponse {
  readonly matches: readonly AsyncMatch[];
}

interface MeResponse {
  readonly user?: { id: string };
}

export default function AsyncMatchesPage(): JSX.Element {
  const [matches, setMatches] = useState<readonly AsyncMatch[] | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiRequest<ListResponse>("/me/matches?mode=async&limit=50&status=active"),
      apiRequest<MeResponse>("/auth/me").catch(() => ({ user: undefined }) as MeResponse),
    ])
      .then(([list, me]) => {
        setMatches(list.matches);
        setCurrentUserId(me.user?.id ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur reseau"));
  }, []);

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="mb-4 text-2xl font-bold">Matches async</h1>
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      </main>
    );
  }

  if (matches === null) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="mb-4 text-2xl font-bold">Matches async</h1>
        <p className="text-sm text-slate-400">Chargement…</p>
      </main>
    );
  }

  if (matches.length === 0) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="mb-2 text-2xl font-bold">Matches async</h1>
        <p
          data-testid="async-matches-empty"
          className="text-sm text-slate-400"
        >
          Aucun match async actif. Cree un match en mode async depuis ta ligue
          pour jouer un coup par jour.
        </p>
      </main>
    );
  }

  // Tri : ton tour en premier, puis adversaire, puis le reste.
  const sorted = [...matches].sort((a, b) => {
    const aYour = a.currentTurnUserId === currentUserId ? 0 : 1;
    const bYour = b.currentTurnUserId === currentUserId ? 0 : 1;
    if (aYour !== bYour) return aYour - bYour;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-2 text-2xl font-bold">Matches async</h1>
      <p className="mb-4 text-sm text-slate-400">
        1 coup par jour. Si tu ne joues pas avant la deadline, le tour passe
        automatiquement.
      </p>
      <ul className="space-y-2">
        {sorted.map((m) => (
          <li
            key={m.id}
            data-testid={`async-match-${m.id}`}
            className="flex items-center justify-between rounded border border-slate-800 bg-slate-900 p-3"
          >
            <div>
              <Link
                href={`/play/${m.id}` as never as string}
                className="font-mono text-sm text-slate-200 hover:underline"
              >
                #{m.id.slice(0, 8)}
              </Link>
              <p className="text-xs text-slate-500">
                {m.turnDeadlineHours}h par tour
              </p>
            </div>
            <AsyncMatchCountdown matchId={m.id} pollIntervalMs={60_000} />
          </li>
        ))}
      </ul>
    </main>
  );
}
