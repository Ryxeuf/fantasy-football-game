"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../lib/api-client";

type Invitation = {
  id: string;
  code: string;
  status: string;
  message: string | null;
  inviteeUserId: string | null;
  invitee?: { id: string; coachName: string | null } | null;
  createdAt: string;
};

type Coach = { id: string; coachName: string | null };

function shareUrl(code: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/cups/invitations/${code}`;
}

export default function CupInvitationsManager({ cupId }: { cupId: string }) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiRequest<{ invitations: Invitation[] }>(
        `/cup/${cupId}/invitations`,
      );
      setInvitations(res.invitations ?? []);
    } catch (e: any) {
      setError(e?.message || "Erreur de chargement des invitations");
    } finally {
      setLoading(false);
    }
  }, [cupId]);

  useEffect(() => {
    load();
  }, [load]);

  // Autocomplete coachs (debounce léger).
  useEffect(() => {
    if (search.trim().length < 2) {
      setCoaches([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await apiRequest<{ coaches: Coach[] }>(
          `/cup/coaches/search?q=${encodeURIComponent(search.trim())}`,
        );
        setCoaches(res.coaches ?? []);
      } catch {
        setCoaches([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const createInvitation = async (inviteeUserId?: string) => {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/cup/${cupId}/invitations`, {
        method: "POST",
        body: JSON.stringify({
          inviteeUserId,
          message: message.trim() || undefined,
        }),
      });
      setSearch("");
      setCoaches([]);
      await load();
    } catch (e: any) {
      setError(e?.message || "Échec de la création de l'invitation");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (invitationId: string) => {
    setBusy(true);
    try {
      await apiRequest(`/cup/invitations/${invitationId}`, { method: "DELETE" });
      await load();
    } catch (e: any) {
      setError(e?.message || "Échec de l'annulation");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl(code));
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard indisponible */
    }
  };

  return (
    <div
      className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 space-y-4"
      data-testid="cup-invitations-manager"
    >
      <h2 className="text-lg font-semibold text-gray-900">Inviter des coachs</h2>
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Message (optionnel)
        </label>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={500}
          placeholder="Rejoins ma coupe !"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => createInvitation(undefined)}
          disabled={busy}
          className="px-4 py-2 bg-nuffle-gold text-white rounded-lg text-sm font-medium hover:bg-nuffle-gold/90 disabled:opacity-50"
          data-testid="cup-create-share-link"
        >
          🔗 Générer un lien partageable
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Inviter un coach par son nom
        </label>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nom du coach (min. 2 caractères)"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          data-testid="cup-invite-search"
        />
        {coaches.length > 0 && (
          <ul className="mt-1 border border-gray-200 rounded-lg divide-y">
            {coaches.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between px-3 py-2 text-sm"
              >
                <span>{c.coachName ?? c.id}</span>
                <button
                  onClick={() => createInvitation(c.id)}
                  disabled={busy}
                  className="text-nuffle-gold hover:underline"
                >
                  Inviter
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          Invitations envoyées
        </h3>
        {loading ? (
          <p className="text-sm text-gray-500">Chargement…</p>
        ) : invitations.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune invitation.</p>
        ) : (
          <ul className="space-y-2">
            {invitations.map((inv) => (
              <li
                key={inv.id}
                className="border border-gray-200 rounded-lg p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {inv.invitee?.coachName ?? "Lien partageable"}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      inv.status === "pending"
                        ? "bg-blue-50 text-blue-700"
                        : inv.status === "accepted"
                          ? "bg-green-50 text-green-700"
                          : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {inv.status}
                  </span>
                </div>
                {inv.status === "pending" && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      readOnly
                      value={shareUrl(inv.code)}
                      className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs text-gray-600 bg-gray-50"
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <button
                      onClick={() => copy(inv.code)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {copied === inv.code ? "Copié !" : "Copier"}
                    </button>
                    <button
                      onClick={() => cancel(inv.id)}
                      disabled={busy}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Annuler
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
