"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest, ApiClientError } from "../../lib/api-client";

// Liste des invitations de ligue EN ATTENTE reçues par l'utilisateur courant.
// Branché sur :
//   - GET  /leagues/me/invitations            (liste pending)
//   - POST /leagues/invitations/:code/decline (refus inline)
//
// "Accepter" pointe vers la page d'acceptation (/leagues/invitations/:code)
// car l'inscription requiert le choix d'une équipe. "Refuser" est inline.
//
// Réutilisé par la page /leagues (panneau coach) et /me/league-invitations.

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

interface PendingLeagueInvitationsProps {
  /**
   * Si true, affiche un message quand il n'y a aucune invitation. Si false
   * (defaut), le composant ne rend rien du tout — pratique pour l'intégrer
   * dans une page existante sans la polluer.
   */
  showWhenEmpty?: boolean;
  /** Titre du bloc. */
  title?: string;
}

export function PendingLeagueInvitations({
  showWhenEmpty = false,
  title = "Invitations en attente",
}: PendingLeagueInvitationsProps) {
  const [items, setItems] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ invitations: PendingInvitation[] }>(
        "/leagues/me/invitations",
      );
      setItems(data.invitations ?? []);
    } catch (e: unknown) {
      // Non connecté (401) ou erreur réseau : on n'affiche rien (liste vide).
      setItems([]);
      if (e instanceof ApiClientError && e.status === 401) {
        setError(null);
      } else {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleDecline = useCallback(
    async (code: string, id: string) => {
      setDecliningId(id);
      setError(null);
      try {
        await apiRequest(`/leagues/invitations/${code}/decline`, {
          method: "POST",
        });
        await reload();
      } catch (e: unknown) {
        setError(
          e instanceof ApiClientError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Erreur lors du refus",
        );
      } finally {
        setDecliningId(null);
      }
    },
    [reload],
  );

  // Rien à montrer et on ne veut pas d'état vide → ne rend rien.
  if (!loading && items.length === 0 && !showWhenEmpty && !error) {
    return null;
  }

  return (
    <section
      className="rounded-lg border border-nuffle-gold/40 bg-amber-50/50 p-4"
      data-testid="pending-league-invitations"
    >
      <h2 className="mb-3 text-base font-semibold text-nuffle-anthracite">
        ✉️ {title}
        {!loading ? (
          <span className="ml-2 text-xs font-normal text-slate-500">
            ({items.length})
          </span>
        ) : null}
      </h2>

      {error ? (
        <p className="mb-2 rounded bg-red-50 p-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Chargement...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-600">Aucune invitation en attente.</p>
      ) : (
        <ul className="space-y-2" data-testid="pending-invitations-list">
          {items.map((inv) => (
            <li
              key={inv.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-white p-3"
              data-testid={`pending-invitation-${inv.id}`}
            >
              <div className="min-w-0">
                <span className="font-medium text-nuffle-anthracite">
                  {inv.league.name}
                </span>
                {inv.season ? (
                  <span className="ml-2 text-xs text-slate-500">
                    Saison {inv.season.seasonNumber}
                  </span>
                ) : null}
                {inv.inviter ? (
                  <span className="ml-2 text-xs text-slate-400">
                    par @{inv.inviter.coachName}
                  </span>
                ) : null}
                {inv.message ? (
                  <p className="mt-1 text-xs italic text-slate-600">
                    « {inv.message} »
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/leagues/invitations/${inv.code}`}
                  className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
                  data-testid={`accept-invitation-${inv.id}`}
                >
                  Accepter
                </Link>
                <button
                  type="button"
                  onClick={() => void handleDecline(inv.code, inv.id)}
                  disabled={decliningId === inv.id}
                  className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  data-testid={`decline-invitation-${inv.id}`}
                >
                  {decliningId === inv.id ? "..." : "Refuser"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
