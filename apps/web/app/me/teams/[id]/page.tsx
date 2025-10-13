"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "../../../auth-client";
import SkillTooltip from "../components/SkillTooltip";

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

export default function TeamDetailPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const id =
    typeof window !== "undefined"
      ? window.location.pathname.split("/").pop()
      : "";

  useEffect(() => {
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const me = await fetchJSON("/auth/me");
        if (!me?.user) {
          window.location.href = "/login";
          return;
        }
        const d = await fetchJSON(`/team/${id}`);
        setData(d);
      } catch (e: any) {
        setError(e.message || "Erreur");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const team = data?.team;
  const match = data?.currentMatch;
  const canEdit = !match || (match.status !== "pending" && match.status !== "active");

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{team?.name || "Équipe"}</h1>
          <div className="text-sm text-gray-600 mt-1">
            Roster: <span className="capitalize font-medium">{team?.roster}</span>
          </div>
        </div>
        <div className="flex gap-3">
          {canEdit ? (
            <a
              href={`/me/teams/${id}/edit`}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Modifier l'équipe
            </a>
          ) : (
            <div className="px-4 py-2 bg-gray-300 text-gray-600 rounded cursor-not-allowed">
              Équipe en match
            </div>
          )}
          <a
            href="/me/teams"
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
          >
            Retour
          </a>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {!canEdit && match && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
          <div className="font-semibold">⚠️ Équipe engagée dans un match</div>
          <div className="text-sm mt-1">
            Cette équipe est actuellement utilisée dans un match ({match.status}). 
            La modification n'est pas autorisée tant que le match n'est pas terminé.
          </div>
          <a
            href="/play"
            className="mt-2 inline-block px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            Aller au match
          </a>
        </div>
      )}

      {team && (
        <>
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b">
              <h2 className="text-lg font-semibold">Composition de l'équipe</h2>
              <div className="text-sm text-gray-600 mt-1">
                {team.players?.length || 0} joueurs
              </div>
              <div className="text-xs text-gray-500 mt-2">
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 border border-gray-300 bg-blue-100 rounded"></span>
                  Compétences de base
                </span>
                <span className="ml-4 inline-flex items-center gap-1">
                  <span className="w-3 h-3 border-2 border-yellow-400 bg-blue-100 rounded"></span>
                  Compétences acquises
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-4 font-medium text-gray-900">#</th>
                    <th className="text-left p-4 font-medium text-gray-900">Nom</th>
                    <th className="text-left p-4 font-medium text-gray-900">Position</th>
                    <th className="text-left p-4 font-medium text-gray-900">MA</th>
                    <th className="text-left p-4 font-medium text-gray-900">ST</th>
                    <th className="text-left p-4 font-medium text-gray-900">AG</th>
                    <th className="text-left p-4 font-medium text-gray-900">PA</th>
                    <th className="text-left p-4 font-medium text-gray-900">AV</th>
                    <th className="text-left p-4 font-medium text-gray-900">Compétences</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {team.players?.map((p: any) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="p-4 font-mono text-lg font-semibold">{p.number}</td>
                      <td className="p-4 font-medium">{p.name}</td>
                      <td className="p-4 text-gray-600">{p.position}</td>
                      <td className="p-4 text-center font-mono">{p.ma}</td>
                      <td className="p-4 text-center font-mono">{p.st}</td>
                      <td className="p-4 text-center font-mono">{p.ag}</td>
                      <td className="p-4 text-center font-mono">{p.pa}</td>
                      <td className="p-4 text-center font-mono">{p.av}</td>
                      <td className="p-4">
                        <SkillTooltip 
                          skillsString={p.skills} 
                          teamName={team.roster}
                          position={p.position}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {match && (
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-lg">Partie en cours</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Match ID: {match.id} • Statut: {match.status} •{" "}
                    {new Date(match.createdAt).toLocaleString()}
                  </div>
                </div>
                <a
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  href="/play"
                >
                  Aller jouer
                </a>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
