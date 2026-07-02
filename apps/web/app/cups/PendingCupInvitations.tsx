"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "../lib/api-client";

type PendingInvitation = {
  code: string;
  message: string | null;
  cup: { id: string; name: string; ruleset: string; format: string | null };
  inviter: { id: string; coachName: string | null };
};

/**
 * Invitations de coupe `pending` reçues par le coach connecté. Affiché en haut
 * de /cups. Silencieux (rien de rendu) s'il n'y en a aucune ou hors connexion.
 */
export default function PendingCupInvitations() {
  const [items, setItems] = useState<PendingInvitation[]>([]);
  const [busy, setBusy] = useState(false);

  const load = () => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    if (!token) return;
    apiRequest<{ invitations: PendingInvitation[] }>("/cup/me/invitations")
      .then((r) => setItems(r.invitations ?? []))
      .catch(() => setItems([]));
  };

  useEffect(load, []);

  const decline = async (code: string) => {
    setBusy(true);
    try {
      await apiRequest(`/cup/invitations/${code}/decline`, { method: "POST" });
      setItems((prev) => prev.filter((i) => i.code !== code));
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  if (items.length === 0) return null;

  return (
    <div
      className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6"
      data-testid="pending-cup-invitations"
    >
      <h2 className="text-sm font-semibold text-amber-900 mb-2">
        Invitations reçues ({items.length})
      </h2>
      <ul className="space-y-2">
        {items.map((inv) => (
          <li
            key={inv.code}
            className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-lg border border-amber-200 px-3 py-2"
          >
            <div className="text-sm">
              <span className="font-medium">{inv.cup.name}</span>
              <span className="text-gray-500">
                {" "}
                · invité par {inv.inviter.coachName ?? "un commissaire"}
              </span>
              {inv.message && (
                <span className="block text-xs text-gray-600 italic">
                  « {inv.message} »
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`/cups/invitations/${inv.code}`}
                className="px-3 py-1.5 bg-nuffle-gold text-white rounded-lg text-xs font-medium hover:bg-nuffle-gold/90"
              >
                Voir & rejoindre
              </a>
              <button
                onClick={() => decline(inv.code)}
                disabled={busy}
                className="text-xs text-red-600 hover:underline"
              >
                Refuser
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
