"use client";
import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../../auth-client";

type Position = {
  key: string;
  name: string;
  cost: number;
  min: number;
  max: number;
  ma: number;
  st: number;
  ag: number;
  pa: number;
  av: number;
  skills: string;
};

export default function NewTeamBuilder() {
  const [rosterId, setRosterId] = useState("skaven");
  const [positions, setPositions] = useState<Position[]>([]);
  const [name, setName] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    fetch(`${API_BASE}/team/rosters/${rosterId}`, {
      headers: { Authorization: token ? `Bearer ${token}` : "" },
    })
      .then((r) => r.json())
      .then((d) => {
        setPositions(d.roster.positions || []);
        const init: Record<string, number> = {};
        (d.roster.positions || []).forEach((p: Position) => {
          init[p.key] = p.min || 0;
        });
        setCounts(init);
      })
      .catch(() => setError("Impossible de charger le roster"));
  }, [rosterId]);

  const total = useMemo(
    () =>
      Object.entries(counts).reduce(
        (acc, [k, c]) =>
          acc + (positions.find((p) => p.key === k)?.cost || 0) * (c || 0),
        0,
      ),
    [counts, positions],
  );
  const totalPlayers = useMemo(
    () => Object.values(counts).reduce((a, b) => a + (b || 0), 0),
    [counts],
  );

  function change(key: string, delta: number) {
    setCounts((prev) => {
      const pos = positions.find((p) => p.key === key);
      const next = Math.max(
        pos?.min ?? 0,
        Math.min(pos?.max ?? 16, (prev[key] || 0) + delta),
      );
      return { ...prev, [key]: next };
    });
  }

  async function submit() {
    try {
      setError(null);
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_BASE}/team/build`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          name,
          roster: rosterId,
          choices: Object.entries(counts).map(([key, count]) => ({
            key,
            count,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Erreur ${res.status}`);
      window.location.href = `/me/teams/${json.team.id}`;
    } catch (e: any) {
      setError(e.message || "Erreur");
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Créer une équipe</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="grid gap-3">
        <input
          className="border p-2"
          placeholder="Nom de l'équipe"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select
          className="border p-2 w-48"
          value={rosterId}
          onChange={(e) => setRosterId(e.target.value)}
        >
          <option value="skaven">Skavens</option>
          <option value="lizardmen">Hommes-Lézards</option>
        </select>
      </div>
      <div className="rounded border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Poste</th>
              <th className="text-left p-2">Coût</th>
              <th className="text-left p-2">Min</th>
              <th className="text-left p-2">Max</th>
              <th className="text-left p-2">Qté</th>
              <th className="text-left p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => (
              <tr key={p.key} className="odd:bg-white even:bg-gray-50">
                <td className="p-2">{p.name}</td>
                <td className="p-2">{p.cost}k</td>
                <td className="p-2">{p.min}</td>
                <td className="p-2">{p.max}</td>
                <td className="p-2">{counts[p.key] || 0}</td>
                <td className="p-2">
                  <button
                    className="px-2 py-1 border mr-2"
                    onClick={() => change(p.key, -1)}
                  >
                    -
                  </button>
                  <button
                    className="px-2 py-1 border"
                    onClick={() => change(p.key, 1)}
                  >
                    +
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-lg">
          Total: <span className="font-semibold">{total}k</span> • Joueurs:{" "}
          {totalPlayers}
        </div>
        <button
          className="px-4 py-2 bg-emerald-600 text-white rounded"
          onClick={submit}
        >
          Créer l’équipe
        </button>
      </div>
    </div>
  );
}
