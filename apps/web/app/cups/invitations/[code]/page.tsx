"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../../../auth-client";
import { apiRequest } from "../../../lib/api-client";
import { getRosterName } from "@bb/game-engine";

type InvitationInfo = {
  code: string;
  status: string;
  message: string | null;
  inviteeUserId: string | null;
  cup: {
    id: string;
    name: string;
    ruleset: string;
    format: string | null;
    status: string;
    validated: boolean;
  };
  inviter: { id: string; coachName: string | null };
};

type MyTeam = { id: string; name: string; roster: string; ruleset: string; format?: string };

async function publicFetch(path: string) {
  const res = await fetch(`${API_BASE}${path}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Erreur ${res.status}`);
  return json;
}

export default function CupInvitationPage() {
  const router = useRouter();
  const code =
    typeof window !== "undefined"
      ? window.location.pathname.split("/").pop() ?? ""
      : "";

  const [info, setInfo] = useState<InvitationInfo | null>(null);
  const [teams, setTeams] = useState<MyTeam[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Envelope { success, data } → l'info est dans data.
        const res = await publicFetch(`/cup/invitations/${code}`);
        const inv: InvitationInfo = res.data ?? res;
        setInfo(inv);
        const token =
          typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
        if (token) {
          setLoggedIn(true);
          try {
            const mine = await apiRequest<{ teams: MyTeam[] }>("/team/mine");
            setTeams(mine.teams ?? []);
          } catch {
            setTeams([]);
          }
        }
      } catch (e: any) {
        setError(e?.message || "Invitation introuvable");
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);

  const eligibleTeams = useMemo(() => {
    if (!info) return [];
    return teams.filter(
      (t) =>
        t.ruleset === info.cup.ruleset &&
        (t.format ?? "bb11") === (info.cup.format ?? "bb11"),
    );
  }, [teams, info]);

  const accept = async () => {
    if (!info || !selectedTeamId) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(`/cup/invitations/${code}/accept`, {
        method: "POST",
        body: JSON.stringify({ teamId: selectedTeamId }),
      });
      router.push(`/cups/${info.cup.id}`);
    } catch (e: any) {
      setError(e?.message || "Échec de l'acceptation");
      setSubmitting(false);
    }
  };

  const decline = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(`/cup/invitations/${code}/decline`, { method: "POST" });
      router.push("/cups");
    } catch (e: any) {
      setError(e?.message || "Échec du refus");
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-500">Chargement de l'invitation…</div>;
  }
  if (error && !info) {
    return (
      <div className="p-6">
        <p className="text-red-600">{error}</p>
        <a href="/cups" className="text-blue-600 hover:underline text-sm">
          ← Retour aux coupes
        </a>
      </div>
    );
  }
  if (!info) return null;

  const cupClosed = info.cup.status !== "ouverte" || info.cup.validated;
  const consumed = info.status !== "pending";

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Invitation à une coupe</h1>
      <div className="bg-white border rounded-xl p-4 shadow-sm space-y-1">
        <p className="text-lg font-semibold">{info.cup.name}</p>
        <p className="text-sm text-gray-600">
          Invité par{" "}
          <span className="font-medium">{info.inviter.coachName ?? "un commissaire"}</span>
        </p>
        {info.message && (
          <p className="text-sm text-gray-700 italic mt-2">« {info.message} »</p>
        )}
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {consumed && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
          Cette invitation n'est plus disponible ({info.status}).
        </p>
      )}
      {!consumed && cupClosed && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
          Cette coupe est fermée aux inscriptions.
        </p>
      )}

      {!consumed && !cupClosed && !loggedIn && (
        <div className="bg-blue-50 border border-blue-200 rounded p-4 text-sm">
          <p className="mb-2">Connecte-toi pour accepter cette invitation.</p>
          <a
            href={`/login?redirect=${encodeURIComponent(`/cups/invitations/${code}`)}`}
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Se connecter
          </a>
        </div>
      )}

      {!consumed && !cupClosed && loggedIn && (
        <div className="space-y-3">
          {eligibleTeams.length > 0 ? (
            <>
              <label className="block text-sm font-medium text-gray-700">
                Choisir une équipe à inscrire
              </label>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
                data-testid="invitation-team-select"
              >
                <option value="">-- Sélectionner une équipe --</option>
                {eligibleTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({getRosterName(t.roster)})
                  </option>
                ))}
              </select>
              <button
                onClick={accept}
                disabled={!selectedTeamId || submitting}
                className="w-full px-5 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
                data-testid="invitation-accept"
              >
                Rejoindre la coupe
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-600 bg-gray-50 border rounded p-3">
              Aucune équipe compatible ({info.cup.ruleset} ·{" "}
              {(info.cup.format ?? "bb11") === "sevens" ? "à Sept" : "à 11"}).
              Construis-en une pour cette coupe :
            </p>
          )}

          <a
            href={`/me/teams/new?cupId=${info.cup.id}&ruleset=${info.cup.ruleset}&format=${info.cup.format ?? "bb11"}`}
            className="block text-center px-5 py-2.5 bg-nuffle-gold text-white rounded-lg font-medium hover:bg-nuffle-gold/90"
          >
            🛠️ Construire une équipe pour cette coupe
          </a>

          <button
            onClick={decline}
            disabled={submitting}
            className="w-full px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            Refuser l'invitation
          </button>
        </div>
      )}
    </div>
  );
}
