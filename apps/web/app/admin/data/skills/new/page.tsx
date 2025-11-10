"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../../../../auth-client";

const categories = ["General", "Agility", "Strength", "Passing", "Mutation", "Trait"];

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

export default function NewSkillPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const me = await fetchJSON("/auth/me");
      if (me?.user?.role !== "admin") {
        router.push("/");
      }
    } catch (e: any) {
      router.push("/");
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      const data = {
        slug: formData.get("slug"),
        nameFr: formData.get("nameFr"),
        nameEn: formData.get("nameEn"),
        description: formData.get("description"),
        descriptionEn: formData.get("descriptionEn") || null,
        category: formData.get("category"),
      };
      await postJSON("/admin/data/skills", data);
      router.push("/admin/data/skills");
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
        <h1 className="text-2xl font-bold">Créer une compétence</h1>
        <button
          onClick={() => router.push("/admin/data/skills")}
          className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
        >
          Annuler
        </button>
      </div>

      {error && <p className="text-red-600 text-sm mb-4 p-3 bg-red-50 border border-red-200 rounded">{error}</p>}

      <form onSubmit={handleSubmit} className="bg-white p-6 border rounded shadow-sm">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">Slug *</label>
            <input
              type="text"
              name="slug"
              required
              className="w-full border rounded px-3 py-2"
              placeholder="ex: block"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Catégorie *</label>
            <select
              name="category"
              required
              className="w-full border rounded px-3 py-2"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nom (FR) *</label>
            <input
              type="text"
              name="nameFr"
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nom (EN) *</label>
            <input
              type="text"
              name="nameEn"
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1">Description (FR) *</label>
            <textarea
              name="description"
              required
              rows={4}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1">Description (EN)</label>
            <textarea
              name="descriptionEn"
              rows={4}
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Création..." : "Créer la compétence"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/data/skills")}
            className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}

