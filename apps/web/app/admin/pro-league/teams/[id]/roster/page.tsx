"use client";

/**
 * Admin Pro League — gestion roster d'une team.
 *
 * Liste tous les joueurs (active / injured / dead / retired) avec
 * stats + boutons d'action :
 *  - Replenish (combler les manques jusqu'a 12 actives)
 *  - Regenerate (DESTRUCTIF — wipe + re-seed)
 *  - Retire (par joueur)
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { API_BASE } from "../../../../../auth-client";

interface RosterPlayer {
  readonly id: string;
  readonly name: string;
  readonly position: string;
  readonly ma: number;
  readonly st: number;
  readonly ag: number;
  readonly pa: number | null;
  readonly av: number;
  readonly skills: readonly string[];
  readonly status: string;
  readonly form: number;
  readonly spp: number;
  readonly level: number;
  readonly tvCached: number;
  readonly niggling: number;
  readonly tdCount: number;
  readonly casCount: number;
  readonly compCount: number;
  readonly mvpCount: number;
}

interface RosterResponse {
  readonly team: {
    readonly id: string;
    readonly slug: string;
    readonly city: string;
    readonly name: string;
    readonly race: string;
  };
  readonly counts: {
    readonly total: number;
    readonly active: number;
    readonly injured: number;
    readonly dead: number;
    readonly retired: number;
  };
  readonly players: readonly RosterPlayer[];
}

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  injured: "bg-yellow-100 text-yellow-800",
  dead: "bg-red-100 text-red-800",
  retired: "bg-gray-100 text-gray-700",
};

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

export default function AdminProLeagueTeamRosterPage() {
  const params = useParams<{ id: string }>();
  const teamId = params?.id;

  const [data, setData] = useState<RosterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    setError(null);
    try {
      const res = (await fetchJSON(
        `/admin/pro-league/teams/${teamId}/roster`,
      )) as RosterResponse;
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleReplenish = async () => {
    if (!teamId) return;
    if (!confirm("Combler les manques jusqu'a 12 joueurs actifs ?")) return;
    setActionLoading("replenish");
    setActionMessage(null);
    setError(null);
    try {
      const res = await fetchJSON(
        `/admin/pro-league/teams/${teamId}/roster/replenish`,
        { method: "POST", body: JSON.stringify({ targetSize: 12 }) },
      );
      setActionMessage(
        `Replenish OK : ${res.created} rookie(s) ajoute(s) (${res.activeBefore} → ${res.targetSize}).`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRegenerate = async () => {
    if (!teamId) return;
    if (
      !confirm(
        "DESTRUCTIF : wipe complet du roster + re-seed 12 rookies. Confirmer ?",
      )
    ) {
      return;
    }
    setActionLoading("regenerate");
    setActionMessage(null);
    setError(null);
    try {
      const res = await fetchJSON(
        `/admin/pro-league/teams/${teamId}/roster/regenerate`,
        { method: "POST", body: JSON.stringify({ count: 12 }) },
      );
      setActionMessage(
        `Roster regenere : ${res.deleted} joueur(s) supprime(s), ${res.created} cree(s).`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRetire = async (playerId: string, playerName: string) => {
    if (!confirm(`Retirer ${playerName} (status → retired) ?`)) return;
    setActionLoading(`retire:${playerId}`);
    setActionMessage(null);
    setError(null);
    try {
      await fetchJSON(`/admin/pro-league/rosters/${playerId}/retire`, {
        method: "POST",
      });
      setActionMessage(`${playerName} retire.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="text-sm text-gray-500" data-testid="roster-loading">
        Chargement…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-4">
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
          {error}
        </div>
        <Link
          href={"/admin/pro-league/teams" as any}
          className="text-sm text-blue-700 hover:underline"
        >
          ← Liste teams
        </Link>
      </div>
    );
  }

  if (!data) return null;

  const { team, counts, players } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite">
          👥 Roster — {team.city} {team.name}
        </h1>
        <div className="flex gap-3 text-sm">
          <Link
            href={`/admin/pro-league/teams/${team.id}` as any}
            className="text-blue-700 hover:underline"
          >
            Branding
          </Link>
          <Link
            href={"/admin/pro-league/teams" as any}
            className="text-blue-700 hover:underline"
          >
            ← Liste teams
          </Link>
        </div>
      </div>

      <div
        className="grid grid-cols-2 md:grid-cols-5 gap-3"
        data-testid="roster-counts"
      >
        <div className="p-3 rounded-lg bg-white border border-gray-200">
          <div className="text-xs text-gray-500">Total</div>
          <div className="text-2xl font-bold">{counts.total}</div>
        </div>
        <div className="p-3 rounded-lg bg-green-50 border border-green-200">
          <div className="text-xs text-green-700">Active</div>
          <div className="text-2xl font-bold text-green-800">
            {counts.active}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200">
          <div className="text-xs text-yellow-700">Injured</div>
          <div className="text-2xl font-bold text-yellow-800">
            {counts.injured}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-red-50 border border-red-200">
          <div className="text-xs text-red-700">Dead</div>
          <div className="text-2xl font-bold text-red-800">{counts.dead}</div>
        </div>
        <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
          <div className="text-xs text-gray-600">Retired</div>
          <div className="text-2xl font-bold text-gray-700">
            {counts.retired}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleReplenish}
          disabled={actionLoading !== null}
          className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
          data-testid="btn-replenish"
        >
          {actionLoading === "replenish"
            ? "Replenish…"
            : "Replenish (combler manques)"}
        </button>
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={actionLoading !== null}
          className="px-4 py-2 rounded bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
          data-testid="btn-regenerate"
        >
          {actionLoading === "regenerate"
            ? "Regeneration…"
            : "⚠️ Regenerate (DESTRUCTIF)"}
        </button>
      </div>

      {actionMessage && (
        <div
          className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800"
          data-testid="action-message"
        >
          {actionMessage}
        </div>
      )}

      {error && (
        <div
          className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800"
          data-testid="action-error"
        >
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border bg-white border-gray-200">
        <table
          className="min-w-full text-sm"
          data-testid="roster-table"
        >
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Nom</th>
              <th className="px-3 py-2 text-left">Position</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">MA/ST/AG/PA/AV</th>
              <th className="px-3 py-2 text-right">Lvl</th>
              <th className="px-3 py-2 text-right">SPP</th>
              <th className="px-3 py-2 text-right">TV</th>
              <th className="px-3 py-2 text-right">TD/CAS/MVP</th>
              <th className="px-3 py-2 text-left">Skills</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr
                key={p.id}
                className="border-t border-gray-100 hover:bg-gray-50"
                data-testid={`roster-row-${p.id}`}
              >
                <td className="px-3 py-2 font-medium">{p.name}</td>
                <td className="px-3 py-2">{p.position}</td>
                <td className="px-3 py-2">
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[p.status] ?? "bg-gray-100 text-gray-700"}`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs">
                  {p.ma}/{p.st}/{p.ag}/{p.pa ?? "-"}/{p.av}
                </td>
                <td className="px-3 py-2 text-right">{p.level}</td>
                <td className="px-3 py-2 text-right">{p.spp}</td>
                <td className="px-3 py-2 text-right">
                  {(p.tvCached / 1000).toFixed(0)}k
                </td>
                <td className="px-3 py-2 text-right text-xs text-gray-600">
                  {p.tdCount}/{p.casCount}/{p.mvpCount}
                </td>
                <td className="px-3 py-2 text-xs text-gray-600">
                  {p.skills.length ? p.skills.join(", ") : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  {p.status !== "retired" && p.status !== "dead" && (
                    <button
                      type="button"
                      onClick={() => handleRetire(p.id, p.name)}
                      disabled={actionLoading !== null}
                      className="text-xs text-red-600 hover:underline disabled:opacity-50"
                      data-testid={`btn-retire-${p.id}`}
                    >
                      Retire
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {players.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className="px-3 py-6 text-center text-sm text-gray-500"
                >
                  Aucun joueur dans le roster.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
