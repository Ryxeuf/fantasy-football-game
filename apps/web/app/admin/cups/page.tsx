"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../../auth-client";

type Cup = {
  id: string;
  name: string;
  creator: {
    id: string;
    coachName: string;
    email: string;
  };
  creatorId: string;
  validated: boolean;
  isPublic: boolean;
  status: string;
  participantCount: number;
  participants: Array<{
    id: string;
    name: string;
    roster: string;
    owner: {
      id: string;
      coachName: string;
      email: string;
    };
  }>;
  createdAt: string;
  updatedAt: string;
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

async function postJSON(path: string, data: any) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok)
    throw new Error(
      (await res.json().catch(() => ({})))?.error || `Erreur ${res.status}`,
    );
  return res.json();
}

export default function AdminCupsPage() {
  const router = useRouter();
  const [cups, setCups] = useState<Cup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  useEffect(() => {
    loadCups();
  }, []);

  const loadCups = async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await fetchJSON("/auth/me");
      const user = me?.user;
      const roles: string[] | undefined = Array.isArray(user?.roles)
        ? user.roles
        : user?.role
          ? [user.role]
          : undefined;
      if (!roles || !roles.includes("admin")) {
        window.location.href = "/";
        return;
      }
      // Récupérer toutes les coupes (publiques, privées et archivées) pour l'admin
      const { cups: data } = await fetchJSON("/cup?publicOnly=false");
      setCups(data);
    } catch (e: any) {
      setError(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async (cupId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir valider cette coupe ? Cela fermera les inscriptions.")) {
      return;
    }
    setError(null);
    try {
      await postJSON(`/cup/${cupId}/validate`, {});
      loadCups();
    } catch (e: any) {
      setError(e.message || "Erreur lors de la validation");
    }
  };

  // Filter cups based on search and status
  const filteredCups = useMemo(() => {
    return cups.filter((cup) => {
      // Status filter
      if (statusFilter === "open" && cup.validated) return false;
      if (statusFilter === "closed" && !cup.validated) return false;
      
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        if (
          !cup.name.toLowerCase().includes(searchLower) &&
          !cup.creator.coachName.toLowerCase().includes(searchLower) &&
          !cup.creator.email.toLowerCase().includes(searchLower) &&
          !cup.id.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }
      
      return true;
    });
  }, [cups, statusFilter, search]);

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
            🏆 Coupes
          </h1>
          <p className="text-sm text-gray-600">
            Gérez toutes les coupes du système
          </p>
        </div>
        <div className="text-sm text-gray-600 bg-white px-4 py-2 rounded-lg border border-gray-200">
          {filteredCups.length} coupe{filteredCups.length !== 1 ? "s" : ""}
        </div>
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
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all bg-white"
          >
            <option value="">Tous les statuts</option>
            <option value="open">Ouvertes</option>
            <option value="closed">Fermées</option>
          </select>
          <input
            type="text"
            placeholder="Rechercher (nom, créateur)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2.5 flex-1 focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all"
          />
        </div>
        {(statusFilter || search) && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                setStatusFilter("");
                setSearch("");
              }}
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
                  Nom
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Créateur
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Statut
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Visibilité
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Équipes
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Créée le
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Aucune coupe trouvée
                  </td>
                </tr>
              ) : (
                filteredCups.map((cup) => (
                  <tr
                    key={cup.id}
                    className="hover:bg-gray-50 transition-colors duration-150"
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{cup.name}</div>
                      <div className="text-xs text-gray-500 font-mono mt-1">
                        {cup.id}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">
                        {cup.creator.coachName}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">
                        {cup.creator.email}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {cup.status === "ouverte" && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Ouverte
                        </span>
                      )}
                      {cup.status === "en_cours" && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          En cours
                        </span>
                      )}
                      {cup.status === "terminee" && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Terminée
                        </span>
                      )}
                      {cup.status === "archivee" && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          Archivée
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {cup.isPublic ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Publique
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          🔒 Privée
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {cup.participantCount}
                        </span>
                        <span className="text-sm text-gray-500">
                          équipe{cup.participantCount > 1 ? "s" : ""}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(cup.createdAt).toLocaleDateString("fr-FR", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => router.push(`/admin/cups/${cup.id}`)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                          title="Gérer la coupe"
                        >
                          <span>⚙️</span>
                          <span>Gérer</span>
                        </button>
                        <button
                          onClick={() => router.push(`/cups/${cup.id}`)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium"
                          title="Voir les détails"
                        >
                          <span>👁️</span>
                          <span>Détails</span>
                        </button>
                        {!cup.validated && (
                          <button
                            onClick={() => handleValidate(cup.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-nuffle-gold/10 text-nuffle-bronze rounded-lg hover:bg-nuffle-gold/20 transition-colors text-sm font-medium"
                            title="Valider la coupe"
                          >
                            <span>✓</span>
                            <span>Valider</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <div className="text-sm text-gray-600 mb-1">Total de coupes</div>
          <div className="text-3xl font-bold text-nuffle-anthracite">
            {cups.length}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <div className="text-sm text-gray-600 mb-1">Coupes ouvertes</div>
          <div className="text-3xl font-bold text-green-600">
            {cups.filter((c) => !c.validated).length}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <div className="text-sm text-gray-600 mb-1">Coupes fermées</div>
          <div className="text-3xl font-bold text-red-600">
            {cups.filter((c) => c.validated).length}
          </div>
        </div>
      </div>
    </div>
  );
}

