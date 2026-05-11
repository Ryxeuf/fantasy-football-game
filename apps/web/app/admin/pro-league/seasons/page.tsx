"use client";

/**
 * Lot P.B.3 — Page admin de gestion des saisons Pro League.
 *
 * Liste les saisons avec leurs counters (rounds, matches, played) et
 * un menu d'actions par ligne :
 *  - Cloner (modal year input)
 *  - Regenerer le calendrier (confirm)
 *  - Reset standings (confirm)
 *  - Annuler la saison (confirm)
 *
 * Chaque action declenche un POST audit-loggue cote serveur. Apres
 * succes, la liste est rechargee pour refleter le nouvel etat.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE } from "../../../auth-client";
import CloneSeasonModal from "./_components/CloneSeasonModal";
import CreateSeasonModal from "./_components/CreateSeasonModal";

interface Season {
  id: string;
  leagueId: string;
  year: number;
  status: string;
  driverKind: string;
  engineVer: string;
  startsAt: string | null;
  endsAt: string | null;
  roundCount: number;
  matchCount: number;
  playedCount: number;
  createdAt: string;
}

async function fetchJSON(path: string, options?: RequestInit) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error || `Erreur ${res.status}`);
  }
  return json;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  archived: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function AdminProLeagueSeasonsPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [cloneSource, setCloneSource] = useState<Season | null>(null);
  const [cloneLoading, setCloneLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJSON("/admin/pro-league/seasons");
      setSeasons(data.seasons ?? []);
    } catch (e: any) {
      setError(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAction = async (
    seasonId: string,
    action: "regenerate-schedule" | "reset-standings" | "cancel",
    confirmMessage: string,
  ) => {
    if (!confirm(confirmMessage)) return;
    setActionLoading(`${seasonId}:${action}`);
    try {
      await fetchJSON(`/admin/pro-league/seasons/${seasonId}/${action}`, {
        method: "POST",
        body: "{}",
      });
      await load();
    } catch (e: any) {
      alert(e.message || `Erreur lors de ${action}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateConfirm = async (payload: {
    year: number;
    driverKind?: "hybrid" | "full";
    autoSchedule: boolean;
  }) => {
    setCreateLoading(true);
    try {
      await fetchJSON("/admin/pro-league/seasons", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setCreateOpen(false);
      await load();
    } catch (e: any) {
      alert(e.message || "Erreur lors de la creation");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCloneConfirm = async (payload: {
    year: number;
    driverKind?: "hybrid" | "full";
  }) => {
    if (!cloneSource) return;
    setCloneLoading(true);
    try {
      await fetchJSON("/admin/pro-league/seasons/clone", {
        method: "POST",
        body: JSON.stringify({
          fromSeasonId: cloneSource.id,
          year: payload.year,
          ...(payload.driverKind ? { driverKind: payload.driverKind } : {}),
        }),
      });
      setCloneSource(null);
      await load();
    } catch (e: any) {
      alert(e.message || "Erreur lors du clone");
    } finally {
      setCloneLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-nuffle-gold mb-4" />
          <p className="text-gray-600">Chargement…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite mb-1">
            🏆 Saisons Pro League
          </h1>
          <p className="text-sm text-gray-600">
            Gestion administrative des saisons : creation, clone, regeneration
            de calendrier, reset des standings, annulation.
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          data-testid="btn-create-season"
          className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm"
        >
          + Creer une saison
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Annee</th>
              <th className="text-left p-3">Statut</th>
              <th className="text-left p-3">Driver</th>
              <th className="text-left p-3">Engine</th>
              <th className="text-right p-3">Rounds</th>
              <th className="text-right p-3">Matches</th>
              <th className="text-right p-3">Joues</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {seasons.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-gray-500 italic">
                  Aucune saison.
                </td>
              </tr>
            ) : (
              seasons.map((s) => {
                const loadingKey = (action: string) =>
                  actionLoading === `${s.id}:${action}`;
                const anyLoading = actionLoading?.startsWith(`${s.id}:`);
                const canModify =
                  s.status !== "archived" && s.status !== "cancelled";

                return (
                  <tr
                    key={s.id}
                    data-testid={`season-row-${s.id}`}
                    className="border-t border-gray-100"
                  >
                    <td className="p-3 font-semibold">
                      <Link
                        href={`/admin/pro-league/seasons/${s.id}` as any}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {s.year}
                      </Link>
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          STATUS_COLORS[s.status] ?? "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-xs">{s.driverKind}</td>
                    <td className="p-3 font-mono text-xs">{s.engineVer}</td>
                    <td className="p-3 text-right">{s.roundCount}</td>
                    <td className="p-3 text-right">{s.matchCount}</td>
                    <td className="p-3 text-right">
                      {s.playedCount}
                      {s.matchCount > 0 && (
                        <span className="text-xs text-gray-400 ml-1">
                          / {s.matchCount}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        <button
                          onClick={() => setCloneSource(s)}
                          disabled={!!anyLoading}
                          data-testid={`btn-clone-${s.id}`}
                          className="px-2 py-1 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
                        >
                          Cloner
                        </button>
                        {canModify && (
                          <>
                            <button
                              onClick={() =>
                                handleAction(
                                  s.id,
                                  "regenerate-schedule",
                                  `Regenerer le calendrier de la saison ${s.year} ? Tous les matchs scheduled seront recrees.`,
                                )
                              }
                              disabled={!!anyLoading}
                              data-testid={`btn-regen-${s.id}`}
                              className="px-2 py-1 text-xs text-white bg-purple-600 hover:bg-purple-700 rounded disabled:opacity-50"
                            >
                              {loadingKey("regenerate-schedule")
                                ? "…"
                                : "Regenerer"}
                            </button>
                            <button
                              onClick={() =>
                                handleAction(
                                  s.id,
                                  "reset-standings",
                                  `Reset les standings de la saison ${s.year} ? Tous les compteurs (points, wins, etc.) repartent a zero.`,
                                )
                              }
                              disabled={!!anyLoading}
                              data-testid={`btn-reset-${s.id}`}
                              className="px-2 py-1 text-xs text-white bg-orange-600 hover:bg-orange-700 rounded disabled:opacity-50"
                            >
                              {loadingKey("reset-standings")
                                ? "…"
                                : "Reset"}
                            </button>
                            <button
                              onClick={() =>
                                handleAction(
                                  s.id,
                                  "cancel",
                                  `Annuler la saison ${s.year} ? Le statut passera a "cancelled".`,
                                )
                              }
                              disabled={!!anyLoading}
                              data-testid={`btn-cancel-${s.id}`}
                              className="px-2 py-1 text-xs text-white bg-red-600 hover:bg-red-700 rounded disabled:opacity-50"
                            >
                              {loadingKey("cancel") ? "…" : "Annuler"}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <CreateSeasonModal
        open={createOpen}
        loading={createLoading}
        onClose={() => setCreateOpen(false)}
        onConfirm={handleCreateConfirm}
      />

      <CloneSeasonModal
        open={cloneSource !== null}
        sourceSeasonId={cloneSource?.id ?? null}
        sourceSeasonLabel={
          cloneSource ? `Saison ${cloneSource.year} (${cloneSource.status})` : ""
        }
        loading={cloneLoading}
        onClose={() => setCloneSource(null)}
        onConfirm={handleCloneConfirm}
      />
    </div>
  );
}
