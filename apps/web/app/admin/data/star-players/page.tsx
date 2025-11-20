"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE } from "../../../auth-client";

type StarPlayer = {
  id: string;
  slug: string;
  displayName: string;
  cost: number;
  ma: number;
  st: number;
  ag: number;
  pa: number | null;
  av: number;
  specialRule: string | null;
  imageUrl: string | null;
  skills: Array<{ skill: { slug: string; nameFr: string } }>;
  hirableBy: Array<{ rule: string; roster: { slug: string; name: string } | null }>;
};

type Roster = {
  id: string;
  slug: string;
  name: string;
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

async function putJSON(path: string, data: any) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
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

export default function AdminStarPlayersPage() {
  const router = useRouter();
  const [starPlayers, setStarPlayers] = useState<StarPlayer[]>([]);
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nameSearch, setNameSearch] = useState<string>("");
  const [skillSearch, setSkillSearch] = useState<string>("");
  const [costMin, setCostMin] = useState<string>("");
  const [costMax, setCostMax] = useState<string>("");
  const [statsSearch, setStatsSearch] = useState<string>("");
  const [rosterFilter, setRosterFilter] = useState<string>("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
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
      const [{ starPlayers: spData }, { rosters: rostData }] = await Promise.all([
        fetchJSON("/admin/data/star-players"),
        fetchJSON("/admin/data/rosters"),
      ]);
      setStarPlayers(spData);
      setRosters(rostData);
    } catch (e: any) {
      setError(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  // Calculate min/max cost for gauge normalization (convert from po to k)
  const costRange = useMemo(() => {
    if (starPlayers.length === 0) return { min: 0, max: 300 };
    const costs = starPlayers.map(sp => Math.round(sp.cost / 1000)); // Convert po to k
    return {
      min: Math.min(...costs),
      max: Math.max(...costs, 300)
    };
  }, [starPlayers]);

  // Cost gauge component for display
  const CostGauge = ({ cost }: { cost: number }) => {
    const costInK = Math.round(cost / 1000);
    const percentage = ((costInK - costRange.min) / (costRange.max - costRange.min)) * 100;
    const getColor = () => {
      if (costInK <= 60) return "bg-green-500";
      if (costInK <= 100) return "bg-yellow-500";
      if (costInK <= 200) return "bg-orange-500";
      return "bg-red-500";
    };

    return (
      <div className="flex items-center gap-3 min-w-[120px]">
        <span className="text-sm font-medium text-gray-700 w-16 text-right">{costInK}k</span>
        <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full ${getColor()} transition-all duration-300`}
            style={{ width: `${Math.max(percentage, 2)}%` }}
          />
        </div>
      </div>
    );
  };

  // Cost range gauge component for filtering
  const CostRangeGauge = () => {
    const minCost = costMin ? parseInt(costMin) : costRange.min;
    const maxCost = costMax ? parseInt(costMax) : costRange.max;
    const minPercentage = ((minCost - costRange.min) / (costRange.max - costRange.min)) * 100;
    const maxPercentage = ((maxCost - costRange.min) / (costRange.max - costRange.min)) * 100;

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-xs text-gray-600 mb-1">Min: {minCost}k</label>
            <input
              type="range"
              min={costRange.min}
              max={costRange.max}
              value={minCost}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setCostMin(val.toString());
                if (val > maxCost) setCostMax(val.toString());
              }}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #10b981 0%, #10b981 ${minPercentage}%, #e5e7eb ${minPercentage}%, #e5e7eb 100%)`
              }}
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-600 mb-1">Max: {maxCost}k</label>
            <input
              type="range"
              min={costRange.min}
              max={costRange.max}
              value={maxCost}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setCostMax(val.toString());
                if (val < minCost) setCostMin(val.toString());
              }}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #e5e7eb 0%, #e5e7eb ${maxPercentage}%, #ef4444 ${maxPercentage}%, #ef4444 100%)`
              }}
            />
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{costRange.min}k</span>
          <span className="font-medium text-gray-700">
            {minCost}k - {maxCost}k
          </span>
          <span>{costRange.max}k</span>
        </div>
      </div>
    );
  };

  // Filter star players based on search criteria
  const filteredStarPlayers = useMemo(() => {
    return starPlayers.filter((sp) => {
      // Name search
      if (nameSearch && !sp.displayName.toLowerCase().includes(nameSearch.toLowerCase())) {
        return false;
      }

      // Skill search
      if (skillSearch) {
        const skillsStr = sp.skills.map(s => s.skill.nameFr).join(" ").toLowerCase();
        if (!skillsStr.includes(skillSearch.toLowerCase())) {
          return false;
        }
      }

      // Cost filter (convert po to k)
      const costInK = Math.round(sp.cost / 1000);
      if (costMin && costInK < parseInt(costMin)) {
        return false;
      }
      if (costMax && costInK > parseInt(costMax)) {
        return false;
      }

      // Roster filter (check if hirable by roster)
      if (rosterFilter) {
        const hirableByRoster = sp.hirableBy.some(h => h.roster?.id === rosterFilter);
        if (!hirableByRoster) {
          return false;
        }
      }

      // Stats search (format: MA/ST/AG/PA/AV, partial, or specific stat like "MA:7" or "ST:4")
      if (statsSearch) {
        const searchLower = statsSearch.toLowerCase().trim();
        
        // Check for specific stat format (e.g., "MA:7", "ST:4", "AG:3")
        const specificStatMatch = searchLower.match(/^(ma|st|ag|pa|av):\s*(\d+)$/);
        if (specificStatMatch) {
          const statName = specificStatMatch[1];
          const statValue = parseInt(specificStatMatch[2]);
          const playerStats: Record<string, number | null> = {
            ma: sp.ma,
            st: sp.st,
            ag: sp.ag,
            pa: sp.pa,
            av: sp.av
          };
          if (playerStats[statName] !== statValue) {
            return false;
          }
        } else {
          // Partial search in full stats string
          const statsStr = `${sp.ma}/${sp.st}/${sp.ag}/${sp.pa ?? "-"}/${sp.av}`;
          if (!statsStr.includes(statsSearch)) {
            return false;
          }
        }
      }

      return true;
    });
  }, [starPlayers, nameSearch, skillSearch, costMin, costMax, statsSearch, rosterFilter]);


  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce Star Player ?")) return;
    try {
      await deleteJSON(`/admin/data/star-players/${id}`);
      loadData();
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
            ⭐ Star Players
          </h1>
          <p className="text-sm text-gray-600">
            Gérez les Star Players
          </p>
        </div>
        <button
          onClick={() => router.push("/admin/data/star-players/new")}
          className="px-5 py-2.5 bg-nuffle-gold text-white rounded-lg font-medium hover:bg-nuffle-gold/90 shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
        >
          <span>+</span>
          <span>Nouveau Star Player</span>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Roster
            </label>
            <select
              value={rosterFilter}
              onChange={(e) => setRosterFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all bg-white"
            >
              <option value="">Tous les rosters</option>
              {rosters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rechercher par nom
            </label>
            <input
              type="text"
              placeholder="Nom du Star Player..."
              value={nameSearch}
              onChange={(e) => setNameSearch(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rechercher par compétence
            </label>
            <input
              type="text"
              placeholder="Nom de la compétence..."
              value={skillSearch}
              onChange={(e) => setSkillSearch(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtrer par coût (k)
            </label>
            <CostRangeGauge />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rechercher par stats
            </label>
            <input
              type="text"
              placeholder="Ex: 6/3/3/4/8 ou MA:7 ou ST:4"
              value={statsSearch}
              onChange={(e) => setStatsSearch(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all"
            />
            <p className="mt-1 text-xs text-gray-500">
              Format: recherche partielle (6/3/3) ou stat précise (MA:7, ST:4, AG:3, PA:4, AV:8)
            </p>
          </div>
        </div>
        {(nameSearch || skillSearch || costMin || costMax || statsSearch || rosterFilter) && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                setNameSearch("");
                setSkillSearch("");
                setCostMin("");
                setCostMax("");
                setStatsSearch("");
                setRosterFilter("");
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
                  Coût
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Stats
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Compétences
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Recrutable par
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredStarPlayers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Aucun Star Player trouvé
                  </td>
                </tr>
              ) : (
                filteredStarPlayers.map((sp) => (
                  <tr
                    key={sp.id}
                    className="hover:bg-gray-50 transition-colors duration-150"
                  >
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {sp.displayName}
                    </td>
                    <td className="px-6 py-4">
                      <CostGauge cost={sp.cost} />
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm text-gray-700">
                        {sp.ma}/{sp.st}/{sp.ag}/{sp.pa ?? "-"}/{sp.av}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600 max-w-xs">
                      <div className="flex flex-wrap gap-1">
                        {sp.skills.length > 0 ? (
                          sp.skills.slice(0, 3).map((s, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800"
                            >
                              {s.skill.nameFr}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400">Aucune</span>
                        )}
                        {sp.skills.length > 3 && (
                          <span className="text-gray-500">+{sp.skills.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600 max-w-xs">
                      <div className="truncate" title={sp.hirableBy.map(h => h.rule).join(", ")}>
                        {sp.hirableBy.length > 0 ? (
                          sp.hirableBy.map((h, idx) => (
                            <span key={idx}>
                              {h.roster ? (
                                <Link
                                  href={`/admin/data/rosters/${h.roster.id}`}
                                  className="text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  {h.roster.name}
                                </Link>
                              ) : (
                                h.rule
                              )}
                              {idx < sp.hirableBy.length - 1 && ", "}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => router.push(`/admin/data/star-players/${sp.id}/edit`)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-nuffle-gold/10 text-nuffle-bronze rounded-lg hover:bg-nuffle-gold/20 transition-colors text-sm font-medium"
                          title="Modifier"
                        >
                          <span>✏️</span>
                          <span>Modifier</span>
                        </button>
                        <button
                          onClick={() => handleDelete(sp.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                          title="Supprimer"
                        >
                          <span>🗑️</span>
                          <span>Supprimer</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


