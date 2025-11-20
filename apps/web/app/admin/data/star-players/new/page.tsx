"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../../../../auth-client";

type Skill = {
  slug: string;
  nameFr: string;
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

export default function NewStarPlayerPage() {
  const router = useRouter();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const [{ skills: skillsData }, { rosters: rostersData }] = await Promise.all([
        fetchJSON("/admin/data/skills"),
        fetchJSON("/admin/data/rosters"),
      ]);
      setSkills(skillsData);
      setRosters(rostersData);
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
      const hirableByRaw = formData.get("hirableBy")?.toString() || "";
      const hirableBy = hirableByRaw.split(",").map(s => s.trim()).filter(s => s);
      
      const data = {
        slug: formData.get("slug"),
        displayName: formData.get("displayName"),
        cost: parseInt(formData.get("cost") as string),
        ma: parseInt(formData.get("ma") as string),
        st: parseInt(formData.get("st") as string),
        ag: parseInt(formData.get("ag") as string),
        pa: formData.get("pa") ? parseInt(formData.get("pa") as string) : null,
        av: parseInt(formData.get("av") as string),
        specialRule: formData.get("specialRule") || null,
        imageUrl: formData.get("imageUrl") || null,
        skillSlugs: formData.get("skillSlugs")?.toString().split(",").map(s => s.trim()).filter(s => s) || [],
        hirableBy,
      };
      await postJSON("/admin/data/star-players", data);
      router.push("/admin/data/star-players");
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
        <h1 className="text-2xl font-bold">Créer un Star Player</h1>
        <button
          onClick={() => router.push("/admin/data/star-players")}
          className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
        >
          Annuler
        </button>
      </div>

      {error && <p className="text-red-600 text-sm mb-4 p-3 bg-red-50 border border-red-200 rounded">{error}</p>}

      <form onSubmit={handleSubmit} className="bg-white p-6 border rounded shadow-sm">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">Slug *</label>
            <input
              type="text"
              name="slug"
              required
              className="w-full border rounded px-3 py-2"
              placeholder="ex: griff_oberwald"
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
            <label className="block text-sm font-medium mb-1">Coût (po) *</label>
            <input
              type="number"
              name="cost"
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
            <label className="block text-sm font-medium mb-1">PA</label>
            <input
              type="number"
              name="pa"
              className="w-full border rounded px-3 py-2"
              placeholder="Laissez vide pour -"
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
          <div>
            <label className="block text-sm font-medium mb-1">URL Image</label>
            <input
              type="text"
              name="imageUrl"
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div className="col-span-3">
            <label className="block text-sm font-medium mb-1">Règle spéciale</label>
            <textarea
              name="specialRule"
              rows={2}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div className="col-span-3">
            <label className="block text-sm font-medium mb-1">
              Compétences (slugs séparés par des virgules)
            </label>
            <input
              type="text"
              name="skillSlugs"
              className="w-full border rounded px-3 py-2"
              placeholder="block,dodge,loner-4"
            />
            <p className="mt-1 text-xs text-gray-500">
              Compétences disponibles: {skills.slice(0, 10).map(s => s.slug).join(", ")}...
            </p>
          </div>
          <div className="col-span-3">
            <label className="block text-sm font-medium mb-1">
              Recrutable par (règles/rosters séparés par des virgules)
            </label>
            <input
              type="text"
              name="hirableBy"
              className="w-full border rounded px-3 py-2"
              placeholder="all,old_world_classic,skaven"
            />
            <p className="mt-1 text-xs text-gray-500">
              Exemples: "all" pour tous, "old_world_classic" pour une règle, ou slug de roster
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Création..." : "Créer le Star Player"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/data/star-players")}
            className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}

