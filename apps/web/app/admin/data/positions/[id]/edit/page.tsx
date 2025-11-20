"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { API_BASE } from "../../../../../auth-client";
import SkillSelector from "../../SkillSelector";

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
  keywords?: string | null;
  roster: { id: string; slug: string; name: string };
  skills: Array<{ skill: { slug: string; nameFr: string } }>;
};

type Roster = {
  id: string;
  slug: string;
  name: string;
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

export default function EditPositionPage() {
  const router = useRouter();
  const params = useParams();
  const positionId = params.id as string;
  
  const [position, setPosition] = useState<Position | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSkillSlugs, setSelectedSkillSlugs] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, [positionId]);

  // Initialiser les compétences sélectionnées quand la position est chargée
  useEffect(() => {
    if (position?.id && position?.skills) {
      if (Array.isArray(position.skills) && position.skills.length > 0) {
        const slugs = position.skills
          .map(s => {
            if (typeof s === 'string') return s;
            if (s.skill?.slug) return s.skill.slug;
            return null;
          })
          .filter(Boolean) as string[];
        setSelectedSkillSlugs(slugs);
      } else {
        setSelectedSkillSlugs([]);
      }
    }
  }, [position?.id, position?.skills]);

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
      const [{ position: posData }, skillsData] = await Promise.all([
        fetchJSON(`/admin/data/positions/${positionId}`),
        fetchJSON("/admin/data/skills"),
      ]);
      setPosition(posData);
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
    if (!position) return;
    setSaving(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      const data = {
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
      await putJSON(`/admin/data/positions/${position.id}`, data);
      router.push("/admin/data/positions");
    } catch (e: any) {
      setError(e.message || "Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Chargement...</div>;
  if (!position) return <div>Position non trouvée</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Modifier une position</h1>
        <button
          onClick={() => router.push("/admin/data/positions")}
          className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
        >
          Annuler
        </button>
      </div>

      {error && <p className="text-red-600 text-sm mb-4 p-3 bg-red-50 border border-red-200 rounded">{error}</p>}

      <form onSubmit={handleSubmit} className="bg-white p-6 border rounded shadow-sm">
        <div className="mb-4 p-3 bg-gray-50 rounded">
          <div className="text-sm text-gray-600">
            <strong>Roster:</strong> {position.roster.name}
          </div>
          <div className="text-sm text-gray-600">
            <strong>Slug:</strong> {position.slug}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">Nom d'affichage *</label>
            <input
              type="text"
              name="displayName"
              defaultValue={position.displayName}
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Coût (kpo) *</label>
            <input
              type="number"
              name="cost"
              defaultValue={position.cost}
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Min *</label>
            <input
              type="number"
              name="min"
              defaultValue={position.min}
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Max *</label>
            <input
              type="number"
              name="max"
              defaultValue={position.max}
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">MA *</label>
            <input
              type="number"
              name="ma"
              defaultValue={position.ma}
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ST *</label>
            <input
              type="number"
              name="st"
              defaultValue={position.st}
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">AG *</label>
            <input
              type="number"
              name="ag"
              defaultValue={position.ag}
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">PA *</label>
            <input
              type="number"
              name="pa"
              defaultValue={position.pa}
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">AV *</label>
            <input
              type="number"
              name="av"
              defaultValue={position.av}
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div className="col-span-3">
            <label className="block text-sm font-medium mb-1">Mots-clés (séparés par des virgules)</label>
            <input
              type="text"
              name="keywords"
              defaultValue={position.keywords || ""}
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
            {saving ? "Mise à jour..." : "Mettre à jour"}
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

