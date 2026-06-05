"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest, ApiClientError } from "../../../lib/api-client";

// Lot A — Page publique d'acceptation d'invitation.
// URL : /leagues/invitations/[code]
//
// Charge l'invitation via le code public, affiche les meta (ligue,
// saison, inviter), permet a l'user authentifie de choisir une
// equipe et d'accepter ou decliner.
//
// Si l'user n'est pas connecte, on l'oriente vers /auth/login avec
// un retour vers cette page apres login.

interface InvitationPayload {
  id: string;
  code: string;
  status: string;
  message: string | null;
  expiresAt: string;
  seasonId: string | null;
  league: {
    id: string;
    name: string;
    description: string | null;
    ruleset: string;
    allowedRosters: string | null;
    status: string;
  };
  season: {
    id: string;
    name: string;
    seasonNumber: number;
    status: string;
    startDate: string | null;
  } | null;
  inviter: { id: string; coachName: string } | null;
  inviteeTeam: { id: string; name: string; roster: string } | null;
  inviteeUserId: string | null;
}

interface MyTeam {
  id: string;
  name: string;
  roster: string;
  ruleset?: string;
}

export default function InvitationAcceptPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = params?.code ?? "";

  const [invitation, setInvitation] = useState<InvitationPayload | null>(null);
  const [teams, setTeams] = useState<MyTeam[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    void (async () => {
      try {
        // Endpoint public : pas d'auth requise.
        const inv = await apiRequest<InvitationPayload>(
          `/leagues/invitations/${code}`,
        );
        if (!cancelled) {
          setInvitation(inv);
          if (inv.inviteeTeam) {
            setSelectedTeamId(inv.inviteeTeam.id);
          }
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Invitation introuvable",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  // Charge "mes equipes" si on est connecte (token present).
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiRequest<{ teams: MyTeam[] }>("/team/mine");
        if (!cancelled) setTeams(data.teams ?? []);
      } catch {
        if (!cancelled) setTeams([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isExpired = useMemo(() => {
    if (!invitation) return false;
    return new Date(invitation.expiresAt).getTime() < Date.now();
  }, [invitation]);

  const allowedRosters = useMemo<string[] | null>(() => {
    if (!invitation?.league.allowedRosters) return null;
    try {
      const parsed: unknown = JSON.parse(invitation.league.allowedRosters);
      return Array.isArray(parsed) ? (parsed as string[]) : null;
    } catch {
      return null;
    }
  }, [invitation]);

  const eligibleTeams = useMemo(() => {
    if (!allowedRosters) return teams;
    return teams.filter((t) => allowedRosters.includes(t.roster));
  }, [teams, allowedRosters]);

  const handleAccept = useCallback(async () => {
    if (!selectedTeamId) {
      setError("Selectionnez une equipe.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(`/leagues/invitations/${code}/accept`, {
        method: "POST",
        body: JSON.stringify({ teamId: selectedTeamId }),
      });
      setDone("accepted");
      if (invitation?.league.id) {
        // Redirige vers la ligue apres 2s.
        setTimeout(() => {
          router.push(`/leagues/${invitation.league.id}`);
        }, 2000);
      }
    } catch (e: unknown) {
      if (e instanceof ApiClientError) {
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    } finally {
      setSubmitting(false);
    }
  }, [code, selectedTeamId, invitation, router]);

  const handleDecline = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(`/leagues/invitations/${code}/decline`, {
        method: "POST",
      });
      setDone("declined");
    } catch (e: unknown) {
      if (e instanceof ApiClientError) {
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    } finally {
      setSubmitting(false);
    }
  }, [code]);

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p>Chargement de l&apos;invitation...</p>
      </main>
    );
  }

  if (!invitation) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="mb-3 text-2xl font-bold">Invitation introuvable</h1>
        <p className="text-red-700">{error ?? "Lien invalide"}</p>
      </main>
    );
  }

  if (done === "accepted") {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="mb-3 text-2xl font-bold text-green-700">
          Invitation acceptee !
        </h1>
        <p>Vous etes maintenant inscrit a la saison. Redirection...</p>
      </main>
    );
  }

  if (done === "declined") {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="mb-3 text-2xl font-bold">Invitation declinee</h1>
        <p>L&apos;invitation a ete refusee.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-6" data-testid="invitation-page">
      <h1 className="mb-3 text-2xl font-bold">
        Invitation a rejoindre {invitation.league.name}
      </h1>

      {invitation.inviter && (
        <p className="mb-2 text-sm text-slate-600">
          Invitee par @{invitation.inviter.coachName}
        </p>
      )}
      {invitation.season && (
        <p className="mb-2 text-sm">
          Saison : <strong>{invitation.season.name}</strong> (#
          {invitation.season.seasonNumber})
        </p>
      )}
      {invitation.message && (
        <blockquote className="mb-4 border-l-4 border-blue-400 bg-blue-50 p-3 italic">
          {invitation.message}
        </blockquote>
      )}

      {invitation.status !== "pending" && (
        <p className="mb-3 rounded bg-yellow-50 p-2 text-sm">
          Cette invitation est <strong>{invitation.status}</strong>.
        </p>
      )}

      {isExpired && invitation.status === "pending" && (
        <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">
          Cette invitation a expire le{" "}
          {new Date(invitation.expiresAt).toLocaleString("fr-FR")}.
        </p>
      )}

      {invitation.status === "pending" && !isExpired && (
        <>
          <label className="mb-2 mt-4 block text-sm font-medium">
            Choisir une equipe a inscrire
          </label>
          {eligibleTeams.length === 0 ? (
            <p className="text-sm text-red-700">
              Aucune equipe eligible. Verifiez les rosters autorises (
              {allowedRosters?.join(", ") ?? "tous"}).
            </p>
          ) : (
            <select
              className="mb-3 w-full rounded border px-3 py-2"
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              data-testid="invitation-team-select"
            >
              <option value="">-- Selectionner --</option>
              {eligibleTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.roster})
                </option>
              ))}
            </select>
          )}

          {error && (
            <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50"
              disabled={!selectedTeamId || submitting}
              onClick={handleAccept}
              data-testid="invitation-accept"
            >
              {submitting ? "..." : "Accepter"}
            </button>
            <button
              type="button"
              className="rounded bg-slate-300 px-4 py-2 disabled:opacity-50"
              disabled={submitting}
              onClick={handleDecline}
              data-testid="invitation-decline"
            >
              Decliner
            </button>
          </div>
        </>
      )}
    </main>
  );
}
