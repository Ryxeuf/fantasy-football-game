"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE } from "../../../auth-client";
import { RULESET_OPTIONS, getRulesetLabel } from "../ruleset-utils";

type Position = {
  id: string;
  slug: string;
  displayName: string;
  cost: number;
  min: number;
  max: number;
  ma: number;
  st: number;
  ag: number;
  pa: number;
  av: number;
  roster: { id: string; slug: string; name: string; ruleset: string };
  skills: Array<{ skill: { slug: string; nameFr: string } }>;
};

type Roster = {
  id: string;
  slug: string;
  name: string;
  ruleset: string;
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

export default function AdminPositionsPage() {
  const router = useRouter();
  const [positions, setPositions] = useState<Position[]>([]);
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rosterFilter, setRosterFilter] = useState<string>("");
  const [rulesetFilter, setRulesetFilter] = useState<string>("");
  const [nameSearch, setNameSearch] = useState<string>("");
  const [skillSearch, setSkillSearch] = useState<string>("");
  const [costMin, setCostMin] = useState<string>("");
  const [costMax, setCostMax] = useState<string>("");
  const [statsSearch, setStatsSearch] = useState<string>("");

  useEffect(() => {
    loadData();
  }, [rosterFilter, rulesetFilter]);

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
      const params = new URLSearchParams();
      if (rosterFilter) params.append("rosterId", rosterFilter);
      if (rulesetFilter) params.append("ruleset", rulesetFilter);
      const [{ positions: posData }, { rosters: rostData }] = await Promise.all([
        fetchJSON(`/admin/data/positions?${params}`),
        fetchJSON("/admin/data/rosters"),
      ]);
      setPositions(posData);
      setRosters(rostData);
    } catch (e: any) {
      setError(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };


  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette position ?")) return;
    try {
      await deleteJSON(`/admin/data/positions/${id}`);
      loadData();
    } catch (e: any) {
      setError(e.message || "Erreur lors de la suppression");
    }
  };

  // Calculate min/max cost for gauge normalization
  const costRange = useMemo(() => {
    if (positions.length === 0) return { min: 0, max: 200 };
    const costs = positions.map(p => p.cost);
    return {
      min: Math.min(...costs),
      max: Math.max(...costs, 200)
    };
  }, [positions]);

  // Cost gauge component for display
  const CostGauge = ({ cost }: { cost: number }) => {
    const percentage = ((cost - costRange.min) / (costRange.max - costRange.min)) * 100;
    const getColor = () => {
      if (cost <= 60) return "bg-green-500";
      if (cost <= 100) return "bg-yellow-500";
      if (cost <= 130) return "bg-orange-500";
      return "bg-red-500";
    };

    return (
      <div className="flex items-center gap-3 min-w-[120px]">
        <span className="text-sm font-medium text-gray-700 w-12 text-right">{cost}k</span>
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

  // Filter positions based on search criteria
  const filteredPositions = useMemo(() => {
    return positions.filter((position) => {
      // Roster filter
      if (rosterFilter && position.roster.id !== rosterFilter) {
        return false;
      }
      if (rulesetFilter && position.roster.ruleset !== rulesetFilter) {
        return false;
      }

      // Name search
      if (nameSearch && !position.displayName.toLowerCase().includes(nameSearch.toLowerCase())) {
        return false;
      }

      // Skill search
      if (skillSearch) {
        const skillsStr = position.skills.map(s => s.skill.nameFr).join(" ").toLowerCase();
        if (!skillsStr.includes(skillSearch.toLowerCase())) {
          return false;
        }
      }

      // Cost filter
      if (costMin && position.cost < parseInt(costMin)) {
        return false;
      }
      if (costMax && position.cost > parseInt(costMax)) {
        return false;
      }

      // Stats search (format: MA/ST/AG/PA/AV, partial, or specific stat like "MA:7" or "ST:4")
      if (statsSearch) {
        const searchLower = statsSearch.toLowerCase().trim();
        
        // Check for specific stat format (e.g., "MA:7", "ST:4", "AG:3")
        const specificStatMatch = searchLower.match(/^(ma|st|ag|pa|av):\s*(\d+)$/);
        if (specificStatMatch) {
          const statName = specificStatMatch[1];
          const statValue = parseInt(specificStatMatch[2]);
          const positionStats: Record<string, number> = {
            ma: position.ma,
            st: position.st,
            ag: position.ag,
            pa: position.pa,
            av: position.av
          };
          if (positionStats[statName] !== statValue) {
            return false;
          }
        } else {
          // Partial search in full stats string
          const statsStr = `${position.ma}/${position.st}/${position.ag}/${position.pa}/${position.av}`;
          if (!statsStr.includes(statsSearch)) {
            return false;
          }
        }
      }

      return true;
    });
  }, [positions, rosterFilter, rulesetFilter, nameSearch, skillSearch, costMin, costMax, statsSearch]);


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
            🎯 Positions
          </h1>
          <p className="text-sm text-gray-600">
            Gérez les positions des joueurs
          </p>
        </div>
        <button
          onClick={() => router.push("/admin/data/positions/new")}
          className="px-5 py-2.5 bg-nuffle-gold text-white rounded-lg font-medium hover:bg-nuffle-gold/90 shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
        >
          <span>+</span>
          <span>Nouvelle position</span>
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
              Ruleset
            </label>
            <select
              value={rulesetFilter}
              onChange={(e) => {
                setRulesetFilter(e.target.value);
                setRosterFilter("");
              }}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all bg-white"
            >
              <option value="">Tous les rulesets</option>
              {RULESET_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
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
                  {r.name} • {getRulesetLabel(r.ruleset)}
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
              placeholder="Nom de la position..."
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
        {(nameSearch || skillSearch || costMin || costMax || statsSearch || rosterFilter || rulesetFilter) && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                setNameSearch("");
                setSkillSearch("");
                setCostMin("");
                setCostMax("");
                setStatsSearch("");
                setRosterFilter("");
                setRulesetFilter("");
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
                  Roster
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Ruleset
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Nom
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Coût
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Min/Max
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Stats
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Compétences
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredPositions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    Aucune position trouvée
                  </td>
                </tr>
              ) : (
                filteredPositions.map((position) => (
                  <tr
                    key={position.id}
                    className="hover:bg-gray-50 transition-colors duration-150"
                  >
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/data/rosters/${position.roster.id}` as any}
                        className="font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                      >
                        {position.roster.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        {getRulesetLabel(position.roster.ruleset)}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {position.displayName}
                    </td>
                    <td className="px-6 py-4">
                      <CostGauge cost={position.cost} />
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {position.min}/{position.max}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm text-gray-700">
                        {position.ma}/{position.st}/{position.ag}/{position.pa}/{position.av}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600 max-w-xs">
                      <div className="truncate" title={position.skills.map(s => s.skill.nameFr).join(", ") || "—"}>
                        {position.skills.map(s => s.skill.nameFr).join(", ") || "—"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => router.push(`/admin/data/positions/${position.id}/edit`)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-nuffle-gold/10 text-nuffle-bronze rounded-lg hover:bg-nuffle-gold/20 transition-colors text-sm font-medium"
                          title="Modifier"
                        >
                          <span>✏️</span>
                          <span>Modifier</span>
                        </button>
                        <button
                          onClick={() => handleDelete(position.id)}
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


