"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "../../auth-client";

type Summary = {
  id: string;
  status: string;
  teams: { local: { name: string; coach: string }; visitor: { name: string; coach: string } };
  acceptances?: { local: boolean; visitor: boolean };
};

export default function WaitingPage({ params }: { params: { id: string } }) {
  const matchId = params.id;
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: any;
    const fetchSummary = async () => {
      try {
        setError(null);
        const token = localStorage.getItem("auth_token");
        if (!token) { window.location.href = "/login"; return; }
        const res = await fetch(`${API_BASE}/match/${matchId}/summary`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json().catch(() => ({} as any));
        if (!res.ok) { setError(data?.error || `Erreur ${res.status}`); return; }
        setSummary(data as Summary);
        if (data?.status === 'active') {
          // Dès que la partie devient active, rediriger vers /play/[id]
          window.location.href = `/play/${matchId}`;
        }
      } catch (e: any) {
        setError(e?.message || "Erreur");
      } finally {
        timer = setTimeout(fetchSummary, 2000);
      }
    };
    fetchSummary();
    return () => { if (timer) clearTimeout(timer); };
  }, [matchId]);

  const localAccepted = !!summary?.acceptances?.local;
  const visitorAccepted = !!summary?.acceptances?.visitor;

  return (
    <div className="max-w-lg mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">En attente des acceptations</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="rounded border bg-white p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">{summary?.teams?.local?.name || '—'}</div>
            <div className="text-sm text-gray-600">Coach: {summary?.teams?.local?.coach || '—'}</div>
          </div>
          <div className={`px-2 py-1 text-sm rounded ${localAccepted ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
            {localAccepted ? 'Accepté' : "En attente"}
          </div>
        </div>
        {summary?.teams?.visitor?.name && (
          <div className="flex items-center justify-between">
            <div className="text-right">
              <div className="font-medium">{summary?.teams?.visitor?.name}</div>
              <div className="text-sm text-gray-600">Coach: {summary?.teams?.visitor?.coach || '—'}</div>
            </div>
            <div className={`px-2 py-1 text-sm rounded ${visitorAccepted ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
              {visitorAccepted ? 'Accepté' : "En attente"}
            </div>
          </div>
        )}
      </div>
      <p className="text-sm text-gray-600">La page se mettra à jour automatiquement.</p>
      <div className="flex gap-2">
        <a className="px-3 py-2 bg-neutral-200 rounded" href="/lobby">Retour au lobby</a>
        <a className="px-3 py-2 bg-neutral-200 rounded" href={`/team/select?matchId=${matchId}`}>Choisir/Changer d'équipe</a>
      </div>
    </div>
  );
}


