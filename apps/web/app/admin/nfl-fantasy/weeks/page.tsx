"use client";

/**
 * Page admin Phase 3.D — calendrier 22 weeks de la saison selectionnee
 * avec compteurs games + statut ingestion.
 *
 * Phase 3.F+G : ajout d'actions bulk saison (recompute SPP + replay).
 */

import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiClientError, apiRequest } from "../../../lib/api-client";
import { useNflFantasySeason } from "../_components/SeasonContext";
import SeasonActions from "../_components/SeasonActions";

interface WeekRow {
  readonly id: string;
  readonly seasonId: string;
  readonly weekNumber: number;
  readonly startDate: string;
  readonly endDate: string;
  readonly isPlayoffs: boolean;
  readonly gamesCount: number;
  readonly gamesFinal: number;
  readonly ingestStatus: string | null;
}

interface WeeksResponse {
  readonly weeks: ReadonlyArray<WeekRow>;
}

function ingestBadge(status: string | null): JSX.Element {
  if (!status) {
    return (
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-500">
        non ingéré
      </span>
    );
  }
  const color =
    status === "success"
      ? "bg-emerald-100 text-emerald-700"
      : status === "partial"
        ? "bg-amber-100 text-amber-700"
        : status === "failed"
          ? "bg-red-100 text-red-700"
          : "bg-sky-100 text-sky-700";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${color}`}
    >
      {status}
    </span>
  );
}

export default function AdminNflFantasyWeeksPage(): JSX.Element {
  const { selectedSeasonId } = useNflFantasySeason();
  const [weeks, setWeeks] = useState<ReadonlyArray<WeekRow>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedSeasonId) {
      setWeeks([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiRequest<WeeksResponse>(
      `/admin/nfl-fantasy/explore/weeks?seasonId=${selectedSeasonId}`,
    )
      .then((d) => {
        if (cancelled) return;
        setWeeks(d.weeks);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiClientError) {
          setError(`${e.message}${e.status ? ` (HTTP ${e.status})` : ""}`);
        } else {
          setError(e instanceof Error ? e.message : "Erreur");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSeasonId]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-nuffle-anthracite">
          📅 Calendrier saison {selectedSeasonId ?? "—"}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          22 weeks NFL (1-18 regulière + 19-22 playoffs : WC, Div, Conf, SB).
          Click sur une week pour voir les games et stats lines.
        </p>
      </header>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!selectedSeasonId && (
        <div className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-500">
          Sélectionne une saison dans le picker en haut à droite.
        </div>
      )}

      {selectedSeasonId && <SeasonActions seasonId={selectedSeasonId} />}

      {selectedSeasonId && (
        <div
          className="overflow-x-auto rounded-md border border-gray-200 bg-white shadow-sm"
          data-testid="nfl-fantasy-weeks-table"
        >
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Week</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Période</th>
                <th className="px-3 py-2 text-right">Games</th>
                <th className="px-3 py-2 text-right">Final</th>
                <th className="px-3 py-2">Ingest</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-gray-400"
                  >
                    Chargement…
                  </td>
                </tr>
              )}
              {!loading && weeks.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-gray-400"
                  >
                    Aucune week — utilise « Seed d'une saison » dans Actions.
                  </td>
                </tr>
              )}
              {!loading &&
                weeks.map((w) => (
                  <tr
                    key={w.id}
                    className="hover:bg-nuffle-gold/5"
                    data-testid={`nfl-fantasy-week-row-${w.weekNumber}`}
                  >
                    <td className="px-3 py-2 font-mono font-semibold text-nuffle-anthracite">
                      <Link
                        href={`/admin/nfl-fantasy/weeks/${w.id}` as never}
                        className="hover:underline"
                      >
                        W{String(w.weekNumber).padStart(2, "0")}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs uppercase text-gray-500">
                      {w.isPlayoffs ? "playoffs" : "regular"}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {new Date(w.startDate).toLocaleDateString("fr-FR")} →{" "}
                      {new Date(w.endDate).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-600">
                      {w.gamesCount}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-emerald-700">
                      {w.gamesFinal}
                    </td>
                    <td className="px-3 py-2">{ingestBadge(w.ingestStatus)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
