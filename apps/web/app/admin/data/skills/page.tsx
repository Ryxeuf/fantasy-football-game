"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../../../auth-client";
import { RULESET_OPTIONS, getRulesetLabel } from "../ruleset-utils";

type Skill = {
  id: string;
  slug: string;
  ruleset: string;
  nameFr: string;
  nameEn: string;
  description: string;
  descriptionEn?: string | null;
  category: string;
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

export default function AdminSkillsPage() {
  const router = useRouter();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [rulesetFilter, setRulesetFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const categories = ["General", "Agility", "Strength", "Passing", "Mutation", "Trait", "Scélérates"];

  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
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
      const { skills: data } = await fetchJSON("/admin/data/skills");
      setSkills(data);
    } catch (e: any) {
      setError(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  // Filter skills based on search criteria
  const filteredSkills = useMemo(() => {
    return skills.filter((skill) => {
      // Category filter
      if (categoryFilter && skill.category !== categoryFilter) {
        return false;
      }

      // Ruleset filter
      if (rulesetFilter && skill.ruleset !== rulesetFilter) {
        return false;
      }
      
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        if (!skill.slug.toLowerCase().includes(searchLower) &&
            !skill.nameFr.toLowerCase().includes(searchLower) &&
            !skill.nameEn.toLowerCase().includes(searchLower)) {
          return false;
        }
      }
      
      return true;
    });
  }, [skills, categoryFilter, rulesetFilter, search]);

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette compétence ?")) return;
    try {
      await deleteJSON(`/admin/data/skills/${id}`);
      loadSkills();
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
            📚 Compétences
          </h1>
          <p className="text-sm text-gray-600">
            Gérez les compétences des joueurs
          </p>
        </div>
        <button
          onClick={() => router.push("/admin/data/skills/new")}
          className="px-5 py-2.5 bg-nuffle-gold text-white rounded-lg font-medium hover:bg-nuffle-gold/90 shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
        >
          <span>+</span>
          <span>Nouvelle compétence</span>
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
        <div className="flex gap-4 flex-wrap">
          <select
            value={rulesetFilter}
            onChange={(e) => setRulesetFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all bg-white"
          >
            <option value="">Tous les rulesets</option>
            {RULESET_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all bg-white"
          >
            <option value="">Toutes les catégories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2.5 flex-1 focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all"
          />
        </div>
        {(categoryFilter || rulesetFilter || search) && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                setCategoryFilter("");
                setRulesetFilter("");
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
                  Slug
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Ruleset
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Nom (FR)
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Nom (EN)
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Catégorie
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredSkills.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Aucune compétence trouvée
                  </td>
                </tr>
              ) : (
                filteredSkills.map((skill) => (
                <tr
                  key={skill.id}
                  className="hover:bg-gray-50 transition-colors duration-150"
                >
                  <td className="px-6 py-4 font-mono text-xs text-gray-600">
                    {skill.slug}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      skill.ruleset === "season_3" 
                        ? "bg-emerald-100 text-emerald-800" 
                        : "bg-amber-100 text-amber-800"
                    }`}>
                      {getRulesetLabel(skill.ruleset)}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {skill.nameFr}
                  </td>
                  <td className="px-6 py-4 text-gray-700">{skill.nameEn}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                      {skill.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => router.push(`/admin/data/skills/${skill.id}/edit`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-nuffle-gold/10 text-nuffle-bronze rounded-lg hover:bg-nuffle-gold/20 transition-colors text-sm font-medium"
                        title="Modifier"
                      >
                        <span>✏️</span>
                        <span>Modifier</span>
                      </button>
                      <button
                        onClick={() => handleDelete(skill.id)}
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


