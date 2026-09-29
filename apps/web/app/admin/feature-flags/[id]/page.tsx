"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  adminAddFlagUser,
  adminListFlagUsers,
  adminListFlags,
  adminRemoveFlagUser,
  type FeatureFlag,
  type FeatureFlagUser,
} from "../../../lib/featureFlags";
import { API_BASE } from "../../../auth-client";

interface AdminUser {
  id: string;
  email: string;
  name?: string | null;
  coachName?: string | null;
}

async function searchUsers(query: string): Promise<AdminUser[]> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  const res = await fetch(
    `${API_BASE}/admin/users?search=${encodeURIComponent(query)}&limit=10`,
    {
      headers: { Authorization: token ? `Bearer ${token}` : "" },
    },
  );
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  const json = (await res.json().catch(() => ({}))) as {
    users?: AdminUser[];
    data?: AdminUser[];
  };
  return json.users ?? json.data ?? [];
}

export default function AdminFeatureFlagDetailPage() {
  const params = useParams<{ id: string }>();
  const flagId = params?.id;
  const [flag, setFlag] = useState<FeatureFlag | null>(null);
  const [users, setUsers] = useState<FeatureFlagUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>("");
  const [searchResults, setSearchResults] = useState<AdminUser[]>([]);

  const load = useCallback(async () => {
    if (!flagId) return;
    setLoading(true);
    setError(null);
    try {
      const [all, flagUsers] = await Promise.all([
        adminListFlags(),
        adminListFlagUsers(flagId),
      ]);
      setFlag(all.find((f) => f.id === flagId) ?? null);
      setUsers(flagUsers);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [flagId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (search.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const results = await searchUsers(search.trim());
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [search]);

  const addUser = async (userId: string) => {
    if (!flagId) return;
    try {
      await adminAddFlagUser(flagId, userId);
      setSearch("");
      setSearchResults([]);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  const removeUser = async (userId: string) => {
    if (!flagId) return;
    try {
      await adminRemoveFlagUser(flagId, userId);
      setUsers((prev) => prev.filter((u) => u.userId !== userId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  if (loading) return <div className="text-gray-500">Chargement...</div>;
  if (!flag)
    return (
      <div className="text-gray-500">
        Flag introuvable.{" "}
        <Link
          href="/admin/feature-flags"
          className="text-nuffle-bronze underline"
        >
          Retour
        </Link>
      </div>
    );

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <Link
          href="/admin/feature-flags"
          className="text-sm text-gray-500 hover:text-nuffle-bronze"
        >
          ← Retour aux feature flags
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-nuffle-anthracite font-mono break-all">
          {flag.key}
        </h1>
        {flag.description && (
          <p className="text-sm text-gray-600 mt-1">{flag.description}</p>
        )}
        <div className="mt-2 text-xs">
          <span
            className={`px-2 py-1 rounded ${flag.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
          >
            Global : {flag.enabled ? "ON" : "OFF"}
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
        <h2 className="font-semibold mb-2">Ajouter un utilisateur</h2>
        <input
          type="text"
          placeholder="Rechercher par email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded"
        />
        {searchResults.length > 0 && (
          <ul className="mt-2 border border-gray-200 rounded divide-y divide-gray-100 max-h-56 overflow-y-auto">
            {searchResults.map((u) => (
              <li
                key={u.id}
                className="px-3 py-2 flex justify-between items-center gap-3 hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium break-all">{u.email}</div>
                  {u.coachName && (
                    <div className="text-xs text-gray-500">{u.coachName}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => addUser(u.id)}
                  className="shrink-0 text-xs px-3 py-1.5 bg-nuffle-gold text-white rounded hover:bg-nuffle-bronze"
                >
                  Ajouter
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-sm">
            Utilisateurs avec override ({users.length})
          </h2>
        </div>
        {users.length === 0 ? (
          <div className="p-6 text-sm text-gray-500 text-center">
            Aucun override utilisateur.
          </div>
        ) : (
          // Liste plutôt que tableau : sur mobile, la colonne « Retirer »
          // sortait de la carte (`overflow-hidden`) et l'override devenait
          // impossible à supprimer.
          <ul className="divide-y divide-gray-100 text-sm">
            {users.map((u) => (
              <li
                key={u.id}
                data-testid={`flag-override-${u.userId}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
              >
                <div className="min-w-0 flex-1 basis-56">
                  <div className="break-all font-medium">{u.email}</div>
                  <div className="text-xs text-gray-500">
                    {u.coachName && <span>{u.coachName} · </span>}
                    ajouté le {new Date(u.createdAt).toLocaleString("fr-FR")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeUser(u.userId)}
                  aria-label={`Retirer l'override de ${u.email}`}
                  className="shrink-0 px-3 py-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50 hover:text-red-800 text-xs"
                >
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
