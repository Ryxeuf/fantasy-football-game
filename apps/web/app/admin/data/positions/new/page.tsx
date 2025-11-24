"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../../../../auth-client";
import SkillSelector from "../SkillSelector";
import {
  RULESET_OPTIONS,
  DEFAULT_RULESET,
  type Ruleset,
  getRulesetLabel,
} from "../../ruleset-utils";

type Roster = {
  id: string;
  slug: string;
  name: string;
  ruleset: string;
};

type Skill = {
  slug: string;
  nameFr: string;
  nameEn: string;
  category: string;
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

export default function NewPositionPage() {
  const router = useRouter();
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSkillSlugs, setSelectedSkillSlugs] = useState<string[]>([]);
  const [rulesetFilter, setRulesetFilter] = useState<Ruleset>(DEFAULT_RULESET);
  const filteredRosters = rosters.filter((r) => !rulesetFilter || r.ruleset === rulesetFilter);

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
        router.push("/");
        return;
      }
      const [{ rosters: rostData }, skillsData] = await Promise.all([
        fetchJSON("/admin/data/rosters"),
        fetchJSON("/admin/data/skills"),
      ]);
      setRosters(rostData);
      const skillsArray = skillsData?.skills || skillsData || [];
      if (Array.isArray(skillsArray)) {
        const validSkills = skillsArray.filter(s => s && s.slug);
        setSkills(validSkills);
      } else {
        setSkills([]);
      }
    } catch (e: any) {
      setError(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      const data = {
        rosterId: formData.get("rosterId"),
        slug: formData.get("slug"),
        displayName: formData.get("displayName"),
        cost: parseInt(formData.get("cost") as string),
        min: parseInt(formData.get("min") as string),
        max: parseInt(formData.get("max") as string),
        ma: parseInt(formData.get("ma") as string),
        st: parseInt(formData.get("st") as string),
        ag: parseInt(formData.get("ag") as string),
        pa: parseInt(formData.get("pa") as string),
        av: parseInt(formData.get("av") as string),
        keywords: formData.get("keywords") as string || null,
        skillSlugs: selectedSkillSlugs,
      };
      await postJSON("/admin/data/positions", data);
      router.push("/admin/data/positions");
    } catch (e: any) {
      setError(e.message || "Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Chargement...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Créer une position</h1>
        <button
          onClick={() => router.push("/admin/data/positions")}
          className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
        >
          Annuler
        </button>
      </div>

      {error && <p className="text-red-600 text-sm mb-4 p-3 bg-red-50 border border-red-200 rounded">{error}</p>}

      <form onSubmit={handleSubmit} className="bg-white p-6 border rounded shadow-sm">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">Ruleset *</label>
            <select
              value={rulesetFilter}
              onChange={(e) => {
                setRulesetFilter(e.target.value as Ruleset);
              }}
              className="w-full border rounded px-3 py-2"
            >
              {RULESET_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Roster *</label>
            <select
              name="rosterId"
              required
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Sélectionner un roster</option>
              {filteredRosters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} • {getRulesetLabel(r.ruleset)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Slug *</label>
            <input
              type="text"
              name="slug"
              required
              className="w-full border rounded px-3 py-2"
              placeholder="ex: skaven_lineman"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nom d'affichage *</label>
            <input
              type="text"
              name="displayName"
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Coût (kpo) *</label>
            <input
              type="number"
              name="cost"
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Min *</label>
            <input
              type="number"
              name="min"
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Max *</label>
            <input
              type="number"
              name="max"
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">MA *</label>
            <input
              type="number"
              name="ma"
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ST *</label>
            <input
              type="number"
              name="st"
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">AG *</label>
            <input
              type="number"
              name="ag"
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">PA *</label>
            <input
              type="number"
              name="pa"
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">AV *</label>
            <input
              type="number"
              name="av"
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div className="col-span-3">
            <label className="block text-sm font-medium mb-1">Mots-clés (séparés par des virgules)</label>
            <input
              type="text"
              name="keywords"
              placeholder="ex: elite,passive"
              className="w-full border rounded px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              Mots-clés pour cette position (ex: elite, passive, etc.)
            </p>
          </div>
          <div className="col-span-3">
            {skills.length > 0 ? (
              <SkillSelector
                skills={skills}
                selectedSlugs={selectedSkillSlugs}
                onChange={setSelectedSkillSlugs}
              />
            ) : (
              <div className="text-sm text-yellow-600 p-3 border border-yellow-300 rounded bg-yellow-50">
                Chargement des compétences...
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Création..." : "Créer la position"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/data/positions")}
            className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}

