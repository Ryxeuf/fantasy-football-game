"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest, ApiClientError } from "../../lib/api-client";

// Lot A — Modale "Inviter un coach" pour le commissaire.
// Utilise l'endpoint GET /leagues/coaches/search pour l'autocomplete
// + POST /leagues/:leagueId/invitations pour creer l'invitation.

interface CoachCandidate {
  id: string;
  coachName: string;
  alreadyInSeason: boolean;
}

interface InviteCoachModalProps {
  open: boolean;
  onClose: () => void;
  onInvited: () => void;
  leagueId: string;
  /**
   * Saison cible optionnelle. Si fournie, on filtre les coachs deja
   * inscrits (`alreadyInSeason=true`) et l'invitation est rattachee
   * a cette saison precise.
   */
  seasonId?: string;
}

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;

export function InviteCoachModal({
  open,
  onClose,
  onInvited,
  leagueId,
  seasonId,
}: InviteCoachModalProps) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<CoachCandidate[]>([]);
  const [selected, setSelected] = useState<CoachCandidate | null>(null);
  const [message, setMessage] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(14);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCode, setSuccessCode] = useState<string | null>(null);

  // Reset state on open/close.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setCandidates([]);
      setSelected(null);
      setMessage("");
      setError(null);
      setSuccessCode(null);
    }
  }, [open]);

  // Debounced search.
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim().replace(/^@+/, "");
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setCandidates([]);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError(null);
        try {
          const qs = new URLSearchParams({ q: trimmed, limit: "10" });
          if (seasonId) qs.set("seasonId", seasonId);
          const data = await apiRequest<{
            coaches: CoachCandidate[];
          }>(`/leagues/coaches/search?${qs.toString()}`);
          if (!cancelled) setCandidates(data.coaches ?? []);
        } catch (e: unknown) {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : "Erreur de recherche");
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, open, seasonId]);

  const handleSubmit = useCallback(async () => {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiRequest<{
        code: string;
        id: string;
      }>(`/leagues/${leagueId}/invitations`, {
        method: "POST",
        body: JSON.stringify({
          seasonId: seasonId ?? undefined,
          inviteeUserId: selected.id,
          message: message.trim() || undefined,
          expiresInDays,
        }),
      });
      setSuccessCode(result.code);
      onInvited();
    } catch (e: unknown) {
      if (e instanceof ApiClientError) {
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : "Erreur lors de l'envoi");
      }
    } finally {
      setSubmitting(false);
    }
  }, [selected, leagueId, seasonId, message, expiresInDays, onInvited]);

  const shareUrl = useMemo(() => {
    if (!successCode) return null;
    if (typeof window === "undefined") return null;
    return `${window.location.origin}/leagues/invitations/${successCode}`;
  }, [successCode]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h2 className="mb-4 text-xl font-bold">Inviter un coach</h2>

        {successCode && shareUrl ? (
          <div className="space-y-3" data-testid="invite-success">
            <p className="text-green-700">Invitation envoyee !</p>
            <div className="rounded bg-slate-100 p-3 text-sm">
              <p className="mb-1 font-medium">Lien d&apos;invitation :</p>
              <code
                className="block break-all text-xs"
                data-testid="invite-share-url"
              >
                {shareUrl}
              </code>
            </div>
            <button
              type="button"
              className="rounded bg-slate-200 px-3 py-1 text-sm"
              onClick={() => {
                void navigator.clipboard.writeText(shareUrl);
              }}
            >
              Copier le lien
            </button>
            <button
              type="button"
              className="ml-2 rounded bg-blue-600 px-3 py-1 text-sm text-white"
              onClick={onClose}
            >
              Fermer
            </button>
          </div>
        ) : (
          <>
            <label className="mb-2 block text-sm font-medium">
              Rechercher un coach
            </label>
            <input
              type="text"
              className="mb-2 w-full rounded border px-3 py-2"
              placeholder="@nom_du_coach"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(null);
              }}
              data-testid="invite-search-input"
            />
            {loading && (
              <p className="text-xs text-gray-500">Recherche...</p>
            )}
            {candidates.length > 0 && !selected && (
              <ul
                className="mb-3 max-h-40 overflow-y-auto rounded border bg-white"
                data-testid="invite-results-list"
              >
                {candidates.map((c) => (
                  <li
                    key={c.id}
                    className={`cursor-pointer border-b px-3 py-2 text-sm hover:bg-slate-50 ${
                      c.alreadyInSeason ? "opacity-50" : ""
                    }`}
                  >
                    <button
                      type="button"
                      disabled={c.alreadyInSeason}
                      onClick={() => setSelected(c)}
                      className="w-full text-left"
                      data-testid={`invite-candidate-${c.id}`}
                    >
                      @{c.coachName}
                      {c.alreadyInSeason && (
                        <span className="ml-2 text-xs text-red-600">
                          deja inscrit
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {selected && (
              <div className="mb-3 rounded bg-blue-50 p-3 text-sm">
                Coach selectionne : <strong>@{selected.coachName}</strong>{" "}
                <button
                  type="button"
                  className="ml-2 text-xs text-blue-600 underline"
                  onClick={() => setSelected(null)}
                >
                  changer
                </button>
              </div>
            )}

            <label className="mb-2 mt-2 block text-sm font-medium">
              Message (optionnel, max 500 caracteres)
            </label>
            <textarea
              className="mb-3 w-full rounded border px-3 py-2 text-sm"
              rows={3}
              maxLength={500}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Salut, rejoins la Skaven Cup !"
              data-testid="invite-message"
            />

            <label className="mb-2 block text-sm font-medium">
              Expire dans (jours, 1-90)
            </label>
            <input
              type="number"
              min={1}
              max={90}
              className="mb-4 w-24 rounded border px-3 py-1"
              value={expiresInDays}
              onChange={(e) =>
                setExpiresInDays(
                  Math.max(1, Math.min(90, Number(e.target.value))),
                )
              }
              data-testid="invite-expires"
            />

            {error && (
              <p
                className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700"
                data-testid="invite-error"
              >
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded bg-slate-200 px-4 py-2 text-sm"
                onClick={onClose}
                disabled={submitting}
              >
                Annuler
              </button>
              <button
                type="button"
                className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                disabled={!selected || submitting}
                onClick={handleSubmit}
                data-testid="invite-submit"
              >
                {submitting ? "Envoi..." : "Envoyer l'invitation"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
