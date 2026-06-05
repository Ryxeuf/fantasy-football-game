"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "../../lib/api-client";

// Lot A — "Mes invitations" : liste des invitations pending recues
// par l'utilisateur courant.

interface PendingInvitation {
  id: string;
  code: string;
  message: string | null;
  expiresAt: string;
  createdAt: string;
  league: { id: string; name: string };
  season: {
    id: string;
    name: string;
    seasonNumber: number;
    status: string;
  } | null;
  inviter: { id: string; coachName: string } | null;
  inviteeTeam: { id: string; name: string } | null;
}

export default function MyInvitationsPage() {
  const [items, setItems] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{ invitations: PendingInvitation[] }>(
        "/leagues/me/invitations",
      );
      setItems(data.invitations ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-bold">Mes invitations de ligue</h1>

      {loading && <p>Chargement...</p>}
      {error && (
        <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>
      )}
      {!loading && items.length === 0 && (
        <p className="text-slate-600">
          Aucune invitation en attente.
        </p>
      )}

      <ul className="space-y-3" data-testid="my-invitations-list">
        {items.map((inv) => (
          <li
            key={inv.id}
            className="rounded border border-slate-200 bg-white p-4 shadow-sm"
            data-testid={`my-invitation-${inv.id}`}
          >
            <div className="mb-2 flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{inv.league.name}</h3>
                {inv.season && (
                  <p className="text-sm text-slate-600">
                    Saison : {inv.season.name} (#{inv.season.seasonNumber})
                  </p>
                )}
                {inv.inviter && (
                  <p className="text-xs text-slate-500">
                    par @{inv.inviter.coachName}
                  </p>
                )}
              </div>
              <div className="text-right text-xs text-slate-500">
                Expire le{" "}
                {new Date(inv.expiresAt).toLocaleString("fr-FR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </div>
            </div>
            {inv.message && (
              <blockquote className="mb-2 border-l-2 border-blue-300 bg-blue-50 p-2 text-sm italic">
                {inv.message}
              </blockquote>
            )}
            <Link
              href={`/leagues/invitations/${inv.code}`}
              className="inline-block rounded bg-blue-600 px-3 py-1 text-sm text-white"
            >
              Voir l&apos;invitation
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
