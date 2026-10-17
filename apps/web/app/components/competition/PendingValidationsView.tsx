"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiRequest } from "../../lib/api-client";
import { dynamicRoute } from "../../lib/typed-route";
import {
  competitionBackLabel,
  competitionHref,
  matchSheetHref,
  type CompetitionKind,
} from "../../lib/competition-links";

/**
 * « Matchs à valider » d'un commissaire, pour UNE compétition (cible du
 * deep-link de la notification). Le serveur sert la boîte entière
 * (`GET /leagues/me/pending-validations`, ligues ET coupes) ; la page la
 * filtre sur la compétition courante.
 *
 * Partagée par `/leagues/[id]/pending-validations` et
 * `/cups/[id]/pending-validations` : seuls changent le filtre, le lien
 * retour, le lien de feuille et le vocabulaire (journée / ronde).
 */

export interface PendingValidation {
  /** Absent d'un serveur antérieur : lu comme une ligue. */
  kind?: CompetitionKind;
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

/** Feuilles de la compétition courante (PUR). */
export function pendingForCompetition(
  items: readonly PendingValidation[],
  competition: CompetitionKind,
  competitionId: string,
): PendingValidation[] {
  return items.filter(
    (i) => (i.kind ?? "league") === competition && i.leagueId === competitionId,
  );
}

/** « Saison 1 — Journée 3 », « Ronde 2 ». */
export function pendingRoundLabel(item: PendingValidation): string {
  if ((item.kind ?? "league") === "cup") return `Ronde ${item.roundNumber}`;
  return item.seasonName
    ? `${item.seasonName} — Journée ${item.roundNumber}`
    : `Journée ${item.roundNumber}`;
}

export default function PendingValidationsView({
  competition,
  competitionId,
}: {
  competition: CompetitionKind;
  competitionId: string;
}) {
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

  const mine = useMemo(
    () => pendingForCompetition(items, competition, competitionId),
    [items, competition, competitionId],
  );

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-2xl font-bold">Matchs à valider</h1>
      <p className="mb-4 text-sm text-slate-600">
        Feuilles de match soumises par les 2 coachs, en attente de votre
        validation.
      </p>

      <div className="mb-4">
        <Link
          href={dynamicRoute(competitionHref(competition, competitionId))}
          data-testid="pending-back-link"
          className="text-sm text-blue-600 underline"
        >
          {competitionBackLabel(competition)}
        </Link>
      </div>

      {loading && <p>Chargement...</p>}
      {error && (
        <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>
      )}
      {!loading && mine.length === 0 && (
        <p className="text-slate-600">Aucun match en attente de validation.</p>
      )}

      <ul className="space-y-3" data-testid="pending-validations-list">
        {mine.map((m) => (
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
                  {pendingRoundLabel(m)}
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
                href={dynamicRoute(matchSheetHref(competition, m.pairingId))}
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
