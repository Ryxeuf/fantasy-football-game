"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "../../auth-client";

type Summary = {
  id: string;
  status: string;
  teams: {
    local: { name: string; coach: string };
    visitor: { name: string; coach: string };
  };
  acceptances?: { local: boolean; visitor: boolean };
};

export default function WaitingPage({ params }: { params: { id: string } }) {
  const matchId = params.id;
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptedOnce, setAcceptedOnce] = useState(false);

  useEffect(() => {
    let timer: any;
    const fetchSummary = async () => {
      try {
        setError(null);
        const token = localStorage.getItem("auth_token");
        if (!token) {
          window.location.href = "/login";
          return;
        }
        const res = await fetch(`${API_BASE}/match/${matchId}/summary`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}) as any);
        if (!res.ok) {
          setError(data?.error || `Erreur ${res.status}`);
          return;
        }
        setSummary(data as Summary);
        if (
          data?.status === "active" ||
          data?.status === "prematch" ||
          data?.status === "prematch-setup"
        ) {
          // Dès que la partie devient active ou en pré-match, rediriger vers /play/[id]
          window.location.href = `/play/${matchId}`;
        }
      } catch (e: any) {
        setError(e?.message || "Erreur");
      } finally {
        timer = setTimeout(fetchSummary, 2000);
      }
    };
    fetchSummary();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [matchId]);

  const safeAcceptances = summary?.acceptances || {
    local: false,
    visitor: false,
  };
  const localAccepted = safeAcceptances.local;
  const visitorAccepted = safeAcceptances.visitor;

  async function acceptMatch() {
    try {
      setAccepting(true);
      setError(null);

      // Vérifier le statut avant d'essayer d'accepter
      if (
        summary?.status === "prematch" ||
        summary?.status === "active" ||
        summary?.status === "prematch-setup"
      ) {
        setError("Le match a déjà commencé");
        return;
      }

      const token = localStorage.getItem("auth_token");
      if (!token) {
        window.location.href = "/login";
        return;
      }
      const res = await fetch(`${API_BASE}/match/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ matchId }),
      });
      const data = await res.json().catch(() => ({}) as any);
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setAcceptedOnce(true);
      // Actualiser une fois immédiatement après acceptation
      const sumRes = await fetch(`${API_BASE}/match/${matchId}/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const sumData = await sumRes.json().catch(() => ({}) as any);
      if (sumRes.ok) {
        setSummary(sumData as Summary);
        // Vérifier et rediriger manuellement si statut changé
        if (
          sumData?.status === "prematch-setup" ||
          sumData?.status === "prematch" ||
          sumData?.status === "active"
        ) {
          window.location.href = `/play/${matchId}`;
        }
      }
    } catch (e: any) {
      setError(e?.message || "Erreur lors de l'acceptation");
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">En attente des acceptations</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="rounded border bg-white p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">
              {summary?.teams?.local?.name || "—"}
            </div>
            <div className="text-sm text-gray-600">
              Coach: {summary?.teams?.local?.coach || "—"}
            </div>
          </div>
          <div
            className={`px-2 py-1 text-sm rounded ${localAccepted ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}
          >
            {localAccepted ? "Accepté" : "En attente"}
          </div>
        </div>
        {summary?.teams?.visitor?.name && (
          <div className="flex items-center justify-between">
            <div className="text-right">
              <div className="font-medium">{summary?.teams?.visitor?.name}</div>
              <div className="text-sm text-gray-600">
                Coach: {summary?.teams?.visitor?.coach || "—"}
              </div>
            </div>
            <div
              className={`px-2 py-1 text-sm rounded ${visitorAccepted ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}
            >
              {visitorAccepted ? "Accepté" : "En attente"}
            </div>
          </div>
        )}
      </div>
      <p className="text-sm text-gray-600">
        La page se mettra à jour automatiquement.
      </p>
      <div className="flex gap-2">
        <a className="px-3 py-2 bg-neutral-200 rounded" href="/lobby">
          Retour au lobby
        </a>
        <a
          className="px-3 py-2 bg-neutral-200 rounded"
          href={`/team/select?matchId=${matchId}`}
        >
          Choisir/Changer d'équipe
        </a>
        {!acceptedOnce && summary?.status === "pending" && (
          <button
            onClick={acceptMatch}
            disabled={accepting}
            className="bg-green-500 text-white px-4 py-2 rounded"
          >
            Accepter
          </button>
        )}
      </div>
    </div>
  );
}
