"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "../../../lib/api-client";

// Lot H — Page "Matchs a valider" du commissaire (cible du deep-link
// de la notification push). Liste les feuilles `both_submitted`.

interface PendingValidation {
  pairingId: string;
  matchSheetId: string;
  leagueId: string;
  leagueName: string;
  seasonId: string;
  seasonName: string;
  roundNumber: number;
  homeTeamName: string;
  awayTeamName: string;
  bothSubmittedAt: string | null;
}

export default function PendingValidationsPage() {
  const params = useParams<{ id: string }>();
  const leagueId = params?.id ?? "";

  const [items, setItems] = useState<PendingValidation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{
        pending: PendingValidation[];
        count: number;
      }>("/leagues/me/pending-validations");
      setItems(data.pending ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // La page est ciblee par ligue (deep-link) : on filtre la liste
  // globale du commissaire sur la ligue courante.
  const forThisLeague = useMemo(
    () => items.filter((i) => i.leagueId === leagueId),
    [items, leagueId],
  );

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-2xl font-bold">Matchs a valider</h1>
      <p className="mb-4 text-sm text-slate-600">
        Feuilles de match soumises par les 2 coachs, en attente de votre
        validation.
      </p>

      <div className="mb-4">
        <Link
          href={`/leagues/${leagueId}`}
          className="text-sm text-blue-600 underline"
        >
          ← Retour a la ligue
        </Link>
      </div>

      {loading && <p>Chargement...</p>}
      {error && (
        <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>
      )}
      {!loading && forThisLeague.length === 0 && (
        <p className="text-slate-600">Aucun match en attente de validation.</p>
      )}

      <ul className="space-y-3" data-testid="pending-validations-list">
        {forThisLeague.map((m) => (
          <li
            key={m.pairingId}
            className="rounded border border-amber-200 bg-amber-50 p-4 shadow-sm"
            data-testid={`pending-${m.pairingId}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">
                  {m.homeTeamName} <span className="text-slate-400">vs</span>{" "}
                  {m.awayTeamName}
                </p>
                <p className="text-xs text-slate-500">
                  {m.seasonName} — Journee {m.roundNumber}
                  {m.bothSubmittedAt && (
                    <>
                      {" "}
                      · soumis le{" "}
                      {new Date(m.bothSubmittedAt).toLocaleString("fr-FR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </>
                  )}
                </p>
              </div>
              <Link
                href={`/leagues/pairings/${m.pairingId}/sheet`}
                className="rounded bg-amber-600 px-3 py-1 text-sm font-medium text-white"
                data-testid={`validate-link-${m.pairingId}`}
              >
                Ouvrir la feuille
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
