"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { API_BASE } from "../../../../auth-client";
import Link from "next/link";

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
  skills: Array<{ skill: { slug: string; nameFr: string; nameEn: string } }>;
};

type Roster = {
  id: string;
  slug: string;
  name: string;
  nameEn: string;
  descriptionFr?: string | null;
  descriptionEn?: string | null;
  budget: number;
  tier: string;
  regionalRules?: string[] | null;
  specialRules?: string | null;
  naf: boolean;
  createdAt: string;
  updatedAt: string;
  positions: Position[];
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

export default function AdminRosterDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [roster, setRoster] = useState<Roster | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    loadRoster();
  }, [id]);

  const loadRoster = async () => {
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
      const { roster: data } = await fetchJSON(`/admin/data/rosters/${id}`);
      setRoster(data);
    } catch (e: any) {
      setError(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!roster) return;
    const formData = new FormData(e.currentTarget);
    try {
      const regionalRulesStr = formData.get("regionalRules") as string;
      const regionalRules = regionalRulesStr ? regionalRulesStr.split(",").map(r => r.trim()).filter(r => r) : null;
      
      const data = {
        name: formData.get("name"),
        nameEn: formData.get("nameEn"),
        descriptionFr: formData.get("descriptionFr") || null,
        descriptionEn: formData.get("descriptionEn") || null,
        budget: parseInt(formData.get("budget") as string),
        tier: formData.get("tier"),
        regionalRules: regionalRules,
        specialRules: formData.get("specialRules") || null,
        naf: formData.get("naf") === "on",
      };
      await putJSON(`/admin/data/rosters/${roster.id}`, data);
      setEditing(false);
      loadRoster();
    } catch (e: any) {
      setError(e.message || "Erreur lors de la mise à jour");
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

  if (error || !roster) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/data/rosters"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            <span>←</span>
            <span>Retour aux rosters</span>
          </Link>
        </div>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <span>⚠️</span>
          <span>{error || "Roster non trouvé"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/data/rosters"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium shadow-sm"
          >
            <span>←</span>
            <span>Retour</span>
          </Link>
          <div>
            <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite mb-1">
              ⚽ {roster.name}
            </h1>
            <p className="text-sm text-gray-600">
              Détails du roster
            </p>
          </div>
        </div>
        <button
          onClick={() => setEditing(!editing)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-nuffle-gold text-white rounded-lg font-medium hover:bg-nuffle-gold/90 shadow-md hover:shadow-lg transition-all duration-200"
        >
          <span>{editing ? "✖️" : "✏️"}</span>
          <span>{editing ? "Annuler" : "Modifier"}</span>
        </button>
      </div>

      {/* Edit Form */}
      {editing && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <h2 className="text-xl font-heading font-semibold text-nuffle-anthracite mb-4">
            ✏️ Modifier le roster
          </h2>
          <form onSubmit={handleUpdate}>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Slug
                </label>
                <input
                  type="text"
                  name="slug"
                  defaultValue={roster.slug}
                  disabled
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-gray-100 text-gray-500 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom (FR)
                </label>
                <input
                  type="text"
                  name="name"
                  defaultValue={roster.name}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom (EN)
                </label>
                <input
                  type="text"
                  name="nameEn"
                  defaultValue={roster.nameEn}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Budget (kpo)
                </label>
                <input
                  type="number"
                  name="budget"
                  defaultValue={roster.budget}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tier
                </label>
                <select
                  name="tier"
                  defaultValue={roster.tier}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all bg-white"
                >
                  <option value="I">I</option>
                  <option value="II">II</option>
                  <option value="III">III</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="naf"
                    defaultChecked={roster.naf}
                    className="w-5 h-5 rounded border-gray-300 text-nuffle-gold focus:ring-nuffle-gold cursor-pointer"
                  />
                  <span className="text-sm font-medium text-gray-700">NAF</span>
                </label>
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (FR)
              </label>
              <textarea
                name="descriptionFr"
                defaultValue={roster.descriptionFr || ""}
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all"
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (EN)
              </label>
              <textarea
                name="descriptionEn"
                defaultValue={roster.descriptionEn || ""}
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all"
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Règles régionales (séparées par des virgules)
              </label>
              <input
                type="text"
                name="regionalRules"
                defaultValue={roster.regionalRules?.join(", ") || ""}
                placeholder="ex: elven_kingdoms_league, old_world_classic"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all"
              />
              <p className="text-xs text-gray-500 mt-1">
                Exemples: elven_kingdoms_league, old_world_classic, badlands_brawl, lustrian_superleague, sylvanian_spotlight, underworld_challenge, worlds_edge_superleague, favoured_of, halfling_thimble_cup
              </p>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Règles spéciales
              </label>
              <input
                type="text"
                name="specialRules"
                defaultValue={roster.specialRules || ""}
                placeholder="ex: NONE"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all"
              />
            </div>
            
            <div className="flex gap-3">
              <button
                type="submit"
                className="px-5 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 shadow-md hover:shadow-lg transition-all duration-200"
              >
                Mettre à jour
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-5 py-2.5 bg-gray-400 text-white rounded-lg font-medium hover:bg-gray-500 transition-all duration-200"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Roster Info */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <h2 className="text-xl font-heading font-semibold text-nuffle-anthracite mb-4">
          Informations générales
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <div className="text-sm font-medium text-gray-600 mb-1">Slug</div>
            <div className="font-mono text-sm text-gray-900">{roster.slug}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-600 mb-1">Nom (FR)</div>
            <div className="text-lg font-bold text-gray-900">{roster.name}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-600 mb-1">Nom (EN)</div>
            <div className="text-lg font-bold text-gray-900">{roster.nameEn}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-600 mb-1">Budget</div>
            <div className="text-lg font-bold text-gray-900">{roster.budget}k</div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-600 mb-1">Tier</div>
            <div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {roster.tier}
              </span>
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-600 mb-1">NAF</div>
            <div>
              {roster.naf ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Oui
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  Non
                </span>
              )}
            </div>
          </div>
        </div>
        
        {roster.descriptionFr && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="text-sm font-medium text-gray-600 mb-2">Description (FR)</div>
            <div className="text-gray-900 whitespace-pre-wrap">{roster.descriptionFr}</div>
          </div>
        )}
        
        {roster.descriptionEn && (
          <div className="mt-4">
            <div className="text-sm font-medium text-gray-600 mb-2">Description (EN)</div>
            <div className="text-gray-900 whitespace-pre-wrap">{roster.descriptionEn}</div>
          </div>
        )}
        
        {roster.regionalRules && roster.regionalRules.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="text-sm font-medium text-gray-600 mb-2">Règles régionales</div>
            <div className="flex flex-wrap gap-2">
              {roster.regionalRules.map((rule, idx) => (
                <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                  {rule}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {roster.specialRules && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="text-sm font-medium text-gray-600 mb-2">Règles spéciales</div>
            <div className="text-gray-900">{roster.specialRules}</div>
          </div>
        )}
      </div>

      {/* Positions */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-heading font-semibold text-nuffle-anthracite">
            Positions ({roster.positions.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gradient-to-r from-nuffle-gold/10 to-nuffle-gold/5">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Nom
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Slug
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {roster.positions.map((position) => (
                <tr
                  key={position.id}
                  className="hover:bg-gray-50 transition-colors duration-150"
                >
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {position.displayName}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-gray-600">
                    {position.slug}
                  </td>
                  <td className="px-6 py-4 text-gray-700">{position.cost}k</td>
                  <td className="px-6 py-4 text-gray-700">
                    {position.min}/{position.max}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm text-gray-700">
                      {position.ma}/{position.st}/{position.ag}/{position.pa}/{position.av}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {position.skills.length > 0 ? (
                        position.skills.map((ps, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800"
                          >
                            {ps.skill.nameFr}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400">Aucune</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

