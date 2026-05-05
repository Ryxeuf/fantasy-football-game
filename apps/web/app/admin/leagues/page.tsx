"use client";
/**
 * L2.C.6 — Sprint Ligues v2 PR10 : console admin pour la gestion
 * globale des ligues.
 *
 * Reservee aux admins (gate cote UI via redirect /auth/me + role
 * check ; verite finale cote serveur via adminOnly middleware).
 *
 * Fonctionnalites :
 *   - liste paginee + filtre par status + recherche par nom
 *   - badge `Vide` quand seasonsCount=0 (eligible a l'archivage)
 *   - actions par-ligue : changer status, archive, voir detail
 *
 * UX volontairement minimale : scrollable list, modale legere pour
 * choisir le nouveau status. Le transfer-creator necessite de
 * connaitre l'userId cible — pour l'instant on expose une input
 * texte. Une autocomplete coach pourra etre ajoutee plus tard.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_BASE } from "../../auth-client";

type LeagueStatus =
  | "draft"
  | "open"
  | "in_progress"
  | "completed"
  | "archived";

interface AdminLeague {
  id: string;
  name: string;
  description: string | null;
  ruleset: string;
  status: LeagueStatus | string;
  isPublic: boolean;
  maxParticipants: number;
  creatorId: string;
  creator: {
    id: string;
    coachName: string | null;
    email: string;
  };
  seasonsCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ListResponse {
  data: { leagues: AdminLeague[] };
  meta: { total: number; limit: number; page: number };
}

const STATUS_OPTIONS: ReadonlyArray<{
  value: LeagueStatus | "all";
  label: string;
}> = [
  { value: "all", label: "Tous" },
  { value: "draft", label: "Brouillon" },
  { value: "open", label: "Ouverte" },
  { value: "in_progress", label: "En cours" },
  { value: "completed", label: "Terminee" },
  { value: "archived", label: "Archivee" },
];

async function fetchJSON<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("auth_token")
      : null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const body = (await res
      .json()
      .catch(() => ({ error: `HTTP ${res.status}` }))) as {
      error?: string;
    };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export default function AdminLeaguesPage() {
  const router = useRouter();
  const [leagues, setLeagues] = useState<AdminLeague[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<LeagueStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [transferTarget, setTransferTarget] = useState<{
    leagueId: string;
    userId: string;
  } | null>(null);

  // Auth gate cote client : redirige les non-admin vers /. Le serveur
  // refuse de toute facon (401/403), c'est cosmetique.
  useEffect(() => {
    let cancelled = false;
    async function checkAdmin() {
      try {
        const me = (await fetchJSON<{
          user: { id: string; role?: string; roles?: string[] } | null;
        }>("/auth/me")) ?? { user: null };
        const roles =
          me.user?.roles ??
          (me.user?.role ? [me.user.role] : []);
        if (cancelled) return;
        if (!roles.includes("admin")) {
          router.replace("/");
        }
      } catch {
        if (!cancelled) router.replace("/");
      }
    }
    checkAdmin();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search.trim().length > 0) params.set("search", search.trim());
      const path = `/admin/leagues${
        params.toString() ? `?${params.toString()}` : ""
      }`;
      const json = await fetchJSON<ListResponse>(path);
      setLeagues(json.data.leagues ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleSetStatus = useCallback(
    async (leagueId: string, status: LeagueStatus) => {
      try {
        setBusyId(leagueId);
        await fetchJSON(`/admin/leagues/${leagueId}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        });
        await reload();
      } catch (e: unknown) {
        alert(
          e instanceof Error ? e.message : "Echec du changement de status",
        );
      } finally {
        setBusyId(null);
      }
    },
    [reload],
  );

  const handleArchive = useCallback(
    async (leagueId: string) => {
      if (!confirm("Archiver cette ligue ?")) return;
      try {
        setBusyId(leagueId);
        await fetchJSON(`/admin/leagues/${leagueId}/archive`, {
          method: "POST",
        });
        await reload();
      } catch (e: unknown) {
        alert(e instanceof Error ? e.message : "Echec de l'archivage");
      } finally {
        setBusyId(null);
      }
    },
    [reload],
  );

  const handleTransfer = useCallback(async () => {
    if (!transferTarget) return;
    if (!transferTarget.userId.trim()) return;
    try {
      setBusyId(transferTarget.leagueId);
      await fetchJSON(
        `/admin/leagues/${transferTarget.leagueId}/creator`,
        {
          method: "PATCH",
          body: JSON.stringify({ userId: transferTarget.userId.trim() }),
        },
      );
      setTransferTarget(null);
      await reload();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Echec du transfert");
    } finally {
      setBusyId(null);
    }
  }, [transferTarget, reload]);

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const l of leagues) {
      out[l.status] = (out[l.status] ?? 0) + 1;
    }
    return out;
  }, [leagues]);

  return (
    <div
      data-testid="admin-leagues-page"
      className="w-full max-w-5xl mx-auto p-4 sm:p-6 space-y-4"
    >
      <div>
        <Link
          href="/admin"
          className="text-sm text-gray-600 hover:text-gray-800"
        >
          ← Admin
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold mt-2">
          🛠️ Console ligues
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Liste globale, force-status, archivage, transfert de creator.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <label className="block">
          <span className="text-xs font-medium text-gray-700">Status</span>
          <select
            data-testid="admin-leagues-status-filter"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as LeagueStatus | "all")
            }
            className="mt-1 block rounded-md border border-gray-300 px-3 py-1.5 text-sm bg-white"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
                {counts[s.value] !== undefined
                  ? ` (${counts[s.value]})`
                  : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="block flex-1 min-w-[200px]">
          <span className="text-xs font-medium text-gray-700">Recherche</span>
          <input
            data-testid="admin-leagues-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom de ligue…"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
        </label>
      </div>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p>Chargement…</p>
      ) : leagues.length === 0 ? (
        <p
          data-testid="admin-leagues-empty"
          className="text-sm text-gray-500"
        >
          Aucune ligue ne correspond aux filtres.
        </p>
      ) : (
        <ul
          data-testid="admin-leagues-list"
          className="grid grid-cols-1 gap-2"
        >
          {leagues.map((l) => (
            <li
              key={l.id}
              data-testid={`admin-league-${l.id}`}
              className="border border-gray-200 rounded-lg bg-white p-3 space-y-2"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <Link
                    href={`/leagues/${l.id}`}
                    className="font-semibold text-nuffle-anthracite hover:underline"
                  >
                    {l.name}
                  </Link>
                  <span className="ml-2 text-xs uppercase tracking-wide bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                    {l.status}
                  </span>
                  {l.seasonsCount === 0 ? (
                    <span className="ml-1 text-xs uppercase tracking-wide bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                      Vide
                    </span>
                  ) : (
                    <span className="ml-1 text-xs text-gray-500">
                      {l.seasonsCount} saison
                      {l.seasonsCount > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {l.creator.coachName ?? l.creator.email}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 items-center text-xs">
                <select
                  data-testid={`admin-league-status-${l.id}`}
                  value={l.status}
                  disabled={busyId === l.id}
                  onChange={(e) =>
                    handleSetStatus(l.id, e.target.value as LeagueStatus)
                  }
                  className="rounded border border-gray-300 px-2 py-1 bg-white"
                >
                  {STATUS_OPTIONS.filter((s) => s.value !== "all").map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                {l.status !== "archived" ? (
                  <button
                    type="button"
                    data-testid={`admin-league-archive-${l.id}`}
                    onClick={() => handleArchive(l.id)}
                    disabled={busyId === l.id}
                    className="px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50"
                  >
                    📦 Archiver
                  </button>
                ) : null}
                <button
                  type="button"
                  data-testid={`admin-league-transfer-${l.id}`}
                  onClick={() =>
                    setTransferTarget({ leagueId: l.id, userId: "" })
                  }
                  disabled={busyId === l.id}
                  className="px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50"
                >
                  🔄 Transferer
                </button>
                <span className="text-gray-400">
                  Maj{" "}
                  {new Date(l.updatedAt).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "short",
                  })}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {transferTarget ? (
        <div
          data-testid="admin-transfer-modal"
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4"
          onClick={() => setTransferTarget(null)}
        >
          <div
            className="bg-white rounded-lg shadow-lg max-w-md w-full p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">Transferer le creator</h2>
            <p className="text-xs text-gray-500">
              Coller l'identifiant utilisateur (cuid) du nouveau creator.
            </p>
            <input
              data-testid="admin-transfer-userid"
              type="text"
              value={transferTarget.userId}
              onChange={(e) =>
                setTransferTarget({
                  ...transferTarget,
                  userId: e.target.value,
                })
              }
              placeholder="user-id"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                data-testid="admin-transfer-confirm"
                onClick={handleTransfer}
                disabled={
                  transferTarget.userId.trim().length === 0 ||
                  busyId === transferTarget.leagueId
                }
                className="px-3 py-1.5 rounded-md bg-nuffle-gold text-white text-sm font-medium disabled:opacity-50"
              >
                Transferer
              </button>
              <button
                type="button"
                onClick={() => setTransferTarget(null)}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
