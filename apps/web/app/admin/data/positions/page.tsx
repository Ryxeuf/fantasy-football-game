"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../../../auth-client";

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
  roster: { id: string; slug: string; name: string };
  skills: Array<{ skill: { slug: string; nameFr: string } }>;
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

  useEffect(() => {
    loadData();
  }, [rosterFilter]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await fetchJSON("/auth/me");
      if (me?.user?.role !== "admin") {
        window.location.href = "/";
        return;
      }
      const params = new URLSearchParams();
      if (rosterFilter) params.append("rosterId", rosterFilter);
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


  if (loading) return <div>Chargement...</div>;

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Positions</h1>
        <button
          onClick={() => router.push("/admin/data/positions/new")}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Nouvelle position
        </button>
      </div>

      {error && <p className="text-red-600 text-sm mb-4 p-3 bg-red-50 border border-red-200 rounded">{error}</p>}

      <div className="mb-4">
        <select
          value={rosterFilter}
          onChange={(e) => setRosterFilter(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="">Tous les rosters</option>
          {rosters.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Roster</th>
              <th className="text-left p-2">Slug</th>
              <th className="text-left p-2">Nom</th>
              <th className="text-left p-2">Coût</th>
              <th className="text-left p-2">Min/Max</th>
              <th className="text-left p-2">Stats</th>
              <th className="text-left p-2">Compétences</th>
              <th className="text-left p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => (
              <tr key={position.id} className="odd:bg-white even:bg-gray-50">
                <td className="p-2">{position.roster.name}</td>
                <td className="p-2 font-mono text-xs">{position.slug}</td>
                <td className="p-2">{position.displayName}</td>
                <td className="p-2">{position.cost}k</td>
                <td className="p-2">{position.min}/{position.max}</td>
                <td className="p-2">
                  {position.ma}/{position.st}/{position.ag}/{position.pa}/{position.av}
                </td>
                <td className="p-2 text-xs">
                  {position.skills.map(s => s.skill.nameFr).join(", ") || "—"}
                </td>
                <td className="p-2">
                  <button
                    onClick={() => router.push(`/admin/data/positions/${position.id}/edit`)}
                    className="text-blue-600 hover:underline mr-2"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => handleDelete(position.id)}
                    className="text-red-600 hover:underline"
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}


