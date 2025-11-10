"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE } from "../../../auth-client";

type Roster = {
  id: string;
  slug: string;
  name: string;
  nameEn: string;
  budget: number;
  tier: string;
  naf: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { positions: number };
};

async function fetchJSON(path: string) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: token ? `Bearer ${token}` : "" },
  });
  if (!res.ok)
    throw new Error(
      (await res.json().catch(() => ({})))?.error || `Erreur ${res.status}`,
    );
  return res.json();
}

async function deleteJSON(path: string) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: { Authorization: token ? `Bearer ${token}` : "" },
  });
  if (!res.ok)
    throw new Error(
      (await res.json().catch(() => ({})))?.error || `Erreur ${res.status}`,
    );
  return res.json();
}

export default function AdminRostersPage() {
  const router = useRouter();
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nameSearch, setNameSearch] = useState<string>("");

  useEffect(() => {
    loadRosters();
  }, []);

  const loadRosters = async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await fetchJSON("/auth/me");
      if (me?.user?.role !== "admin") {
        window.location.href = "/";
        return;
      }
      const { rosters: data } = await fetchJSON("/admin/data/rosters");
      setRosters(data);
    } catch (e: any) {
      setError(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  // Filter rosters based on search criteria
  const filteredRosters = useMemo(() => {
    return rosters.filter((roster) => {
      // Name search
      if (nameSearch && !roster.name.toLowerCase().includes(nameSearch.toLowerCase()) && 
          !roster.nameEn.toLowerCase().includes(nameSearch.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [rosters, nameSearch]);

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce roster ?")) return;
    try {
      await deleteJSON(`/admin/data/rosters/${id}`);
      loadRosters();
    } catch (e: any) {
      setError(e.message || "Erreur lors de la suppression");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-nuffle-gold mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite mb-1">
            ⚽ Rosters
          </h1>
          <p className="text-sm text-gray-600">
            Gérez les rosters des équipes
          </p>
        </div>
        <button
          onClick={() => router.push("/admin/data/rosters/new")}
          className="px-5 py-2.5 bg-nuffle-gold text-white rounded-lg font-medium hover:bg-nuffle-gold/90 shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
        >
          <span>+</span>
          <span>Nouveau roster</span>
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Rechercher par nom..."
            value={nameSearch}
            onChange={(e) => setNameSearch(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2.5 flex-1 focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all"
          />
        </div>
        {nameSearch && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={() => setNameSearch("")}
              className="text-sm text-gray-600 hover:text-gray-800 underline"
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gradient-to-r from-nuffle-gold/10 to-nuffle-gold/5">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Slug
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Nom (FR)
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Nom (EN)
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Budget
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Tier
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  NAF
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Positions
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredRosters.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    Aucun roster trouvé
                  </td>
                </tr>
              ) : (
                filteredRosters.map((roster) => (
                <tr
                  key={roster.id}
                  className="hover:bg-gray-50 transition-colors duration-150"
                >
                  <td className="px-6 py-4 font-mono text-xs text-gray-600">
                    {roster.slug}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {roster.name}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-700">
                    {roster.nameEn}
                  </td>
                  <td className="px-6 py-4 text-gray-700">{roster.budget}k</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {roster.tier}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {roster.naf ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Oui
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Non
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-700">
                    {roster._count?.positions || 0}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/data/rosters/${roster.id}` as any}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                        title="Voir"
                      >
                        <span>👁️</span>
                        <span>Voir</span>
                      </Link>
                      <button
                        onClick={() => router.push(`/admin/data/rosters/${roster.id}/edit`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-nuffle-gold/10 text-nuffle-bronze rounded-lg hover:bg-nuffle-gold/20 transition-colors text-sm font-medium"
                        title="Modifier"
                      >
                        <span>✏️</span>
                        <span>Modifier</span>
                      </button>
                      <button
                        onClick={() => handleDelete(roster.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                        title="Supprimer"
                      >
                        <span>🗑️</span>
                        <span>Supprimer</span>
                      </button>
                    </div>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


