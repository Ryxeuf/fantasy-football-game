"use client";
import { useCallback, useEffect, useState } from "react";
import { apiRequest, ApiClientError } from "../../lib/api-client";

// Panneau commissaire : liste les invitations ENVOYEES pour la ligue et
// permet de les annuler. Branche sur :
//   - GET    /leagues/:leagueId/invitations  (liste)
//   - DELETE /leagues/invitations/:id         (annulation, pending only)
//
// Complement de `InviteCoachModal` (creation). Le `refreshKey` est
// incremente par la page parente apres une invitation envoyee pour
// re-fetcher la liste sans rechargement.

interface SentInvitation {
  id: string;
  status: string; // pending | accepted | declined | cancelled | expired
  code: string;
  message: string | null;
  inviteeEmail: string | null;
  expiresAt: string;
  createdAt: string;
  invitee: { id: string; coachName: string } | null;
  inviteeTeam: { id: string; name: string } | null;
  season: { id: string; name: string | null; seasonNumber: number | null } | null;
}

interface SentInvitationsPanelProps {
  leagueId: string;
  /** Incremente par le parent pour forcer un re-fetch (apres envoi). */
  refreshKey?: number;
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending: { label: "En attente", cls: "bg-amber-100 text-amber-800" },
  accepted: { label: "Acceptee", cls: "bg-green-100 text-green-800" },
  declined: { label: "Refusee", cls: "bg-slate-200 text-slate-700" },
  cancelled: { label: "Annulee", cls: "bg-slate-200 text-slate-500" },
  expired: { label: "Expiree", cls: "bg-slate-200 text-slate-500" },
};

function isExpired(inv: SentInvitation): boolean {
  return inv.status === "pending" && new Date(inv.expiresAt).getTime() < Date.now();
}

function effectiveStatus(inv: SentInvitation): string {
  return isExpired(inv) ? "expired" : inv.status;
}

function targetLabel(inv: SentInvitation): string {
  if (inv.invitee) return `@${inv.invitee.coachName}`;
  if (inv.inviteeEmail) return inv.inviteeEmail;
  return "Lien public";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function SentInvitationsPanel({
  leagueId,
  refreshKey,
}: SentInvitationsPanelProps) {
  const [items, setItems] = useState<SentInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ invitations: SentInvitation[] }>(
        `/leagues/${leagueId}/invitations`,
      );
      setItems(data.invitations ?? []);
    } catch (e: unknown) {
      setError(
        e instanceof ApiClientError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Erreur de chargement",
      );
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const handleCancel = useCallback(
    async (id: string) => {
      setCancellingId(id);
      setError(null);
      try {
        await apiRequest(`/leagues/invitations/${id}`, { method: "DELETE" });
        await load();
      } catch (e: unknown) {
        setError(
          e instanceof ApiClientError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Erreur lors de l'annulation",
        );
      } finally {
        setCancellingId(null);
      }
    },
    [load],
  );

  return (
    <div
      className="mt-4 rounded-lg border border-slate-200 bg-white p-4"
      data-testid="sent-invitations-panel"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-nuffle-anthracite">
          Invitations envoyees
          {!loading ? (
            <span className="ml-2 text-xs font-normal text-slate-500">
              ({items.length})
            </span>
          ) : null}
        </h3>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="text-xs text-nuffle-bronze underline disabled:opacity-50"
          data-testid="sent-invitations-refresh"
        >
          Rafraichir
        </button>
      </div>

      {error ? (
        <p
          className="mb-2 rounded bg-red-50 p-2 text-sm text-red-700"
          data-testid="sent-invitations-error"
        >
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Chargement...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500" data-testid="sent-invitations-empty">
          Aucune invitation envoyee pour le moment.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100" data-testid="sent-invitations-list">
          {items.map((inv) => {
            const status = effectiveStatus(inv);
            const badge = STATUS_LABELS[status] ?? {
              label: status,
              cls: "bg-slate-200 text-slate-700",
            };
            const canCancel = inv.status === "pending" && !isExpired(inv);
            return (
              <li
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                data-testid={`sent-invitation-${inv.id}`}
              >
                <div className="min-w-0">
                  <span className="font-medium text-nuffle-anthracite">
                    {targetLabel(inv)}
                  </span>
                  {inv.season ? (
                    <span className="ml-2 text-xs text-slate-500">
                      Saison {inv.season.seasonNumber ?? inv.season.name ?? ""}
                    </span>
                  ) : null}
                  <span className="ml-2 text-xs text-slate-400">
                    expire le {formatDate(inv.expiresAt)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${badge.cls}`}
                  >
                    {badge.label}
                  </span>
                  {canCancel ? (
                    <button
                      type="button"
                      onClick={() => void handleCancel(inv.id)}
                      disabled={cancellingId === inv.id}
                      className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                      data-testid={`cancel-invitation-${inv.id}`}
                    >
                      {cancellingId === inv.id ? "..." : "Annuler"}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
