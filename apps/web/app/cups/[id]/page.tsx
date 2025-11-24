"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { API_BASE } from "../../auth-client";

type CupScoringConfig = {
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  forfeitPoints: number;
  touchdownPoints: number;
  blockCasualtyPoints: number;
  foulCasualtyPoints: number;
  passPoints: number;
};

type CupTeamStats = {
  teamId: string;
  teamName: string;
  roster: string;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  forfeits: number;
  touchdownsFor: number;
  touchdownsAgainst: number;
  touchdownDiff: number;
  passes: number;
  blockCasualties: number;
  foulCasualties: number;
  resultPoints: number;
  actionPoints: number;
  totalPoints: number;
};

type CupAwardEntry = {
  teamId: string;
  teamName: string;
  roster: string;
  value: number;
};

type CupActionAwards = {
  topScorers?: CupAwardEntry[];
  bestDefense?: CupAwardEntry[];
  bashers?: CupAwardEntry[];
  shamePassers?: CupAwardEntry[];
  foulExperts?: CupAwardEntry[];
  indestructible?: CupAwardEntry[];
  martyrs?: CupAwardEntry[];
  permeable?: CupAwardEntry[];
};

type Cup = {
  id: string;
  name: string;
  ruleset: string;
  creator: {
    id: string;
    coachName: string;
    email: string;
  };
  creatorId: string;
  validated: boolean;
  isPublic: boolean;
  status: string; // "ouverte", "en_cours", "terminee", "archivee"
  participantCount: number;
  participants: Array<{
    id: string;
    name: string;
    roster: string;
    ruleset: string;
    owner: {
      id: string;
      coachName: string;
      email: string;
    };
  }>;
  createdAt: string;
  updatedAt: string;
  isCreator?: boolean;
  hasTeamParticipating?: boolean;
  userParticipatingTeamIds?: string[]; // Liste des IDs des équipes de l'utilisateur qui participent
  scoringConfig?: CupScoringConfig;
  standings?: CupTeamStats[];
  actionAwards?: CupActionAwards;
  matches?: Array<{
    id: string;
    name: string | null;
    status: string;
    isPublic: boolean;
    teamA: { id: string; name: string; roster: string; ruleset: string };
    teamB: { id: string; name: string; roster: string; ruleset: string } | null;
    scoreTeamA: number | null;
    scoreTeamB: number | null;
    createdAt: string;
  }>;
};

type Team = {
  id: string;
  name: string;
  roster: string;
  ruleset: string;
  createdAt: string;
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

export default function CupDetailPage() {
  const router = useRouter();
  const params = useParams();
  const cupId = params.id as string;
  const [cup, setCup] = useState<Cup | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const rulesetLabels: Record<string, string> = {
    season_2: "Saison 2",
    season_3: "Saison 3",
  };

  useEffect(() => {
    if (cupId) {
      loadCup();
      loadTeams();
    }
  }, [cupId]);

  const loadTeams = async () => {
    try {
      const { teams: data } = await fetchJSON("/team/mine");
      setTeams(data);
    } catch (e: any) {
      console.error("Erreur lors du chargement des équipes:", e);
    }
  };

  const loadCup = async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await fetchJSON("/auth/me");
      if (!me?.user) {
        window.location.href = "/login";
        return;
      }
      const { cup: data } = await fetchJSON(`/cup/${cupId}`);
      setCup(data);
    } catch (e: any) {
      setError(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!cup || !selectedTeamId) {
      setError("Veuillez sélectionner une équipe");
      return;
    }
    setError(null);
    try {
      await postJSON(`/cup/${cupId}/register`, { teamId: selectedTeamId });
      setSelectedTeamId("");
      loadCup();
    } catch (e: any) {
      setError(e.message || "Erreur lors de l'inscription");
    }
  };

  const handleUnregister = async (teamId: string) => {
    if (!cup) return;
    if (!confirm("Êtes-vous sûr de vouloir retirer cette équipe de la coupe ?")) {
      return;
    }
    setError(null);
    try {
      await postJSON(`/cup/${cupId}/unregister`, { teamId });
      loadCup();
    } catch (e: any) {
      setError(e.message || "Erreur lors du retrait de l'équipe");
    }
  };

  const handleValidate = async () => {
    if (!cup) return;
    if (!confirm("Êtes-vous sûr de vouloir valider cette coupe ? Cela fermera les inscriptions.")) {
      return;
    }
    setError(null);
    try {
      await postJSON(`/cup/${cupId}/validate`, {});
      loadCup();
    } catch (e: any) {
      setError(e.message || "Erreur lors de la validation");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-nuffle-gold mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (error && !cup) {
    return (
      <div className="w-full p-6">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <span>⚠️</span>
          <span className="ml-2">{error}</span>
        </div>
        <button
          onClick={() => router.push("/cups")}
          className="mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all"
        >
          Retour aux coupes
        </button>
      </div>
    );
  }

  if (!cup) {
    return null;
  }

  return (
    <div className="w-full p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.push("/cups")}
            className="text-sm text-gray-600 hover:text-gray-800 mb-2 inline-flex items-center gap-1"
          >
            ← Retour aux coupes
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite">
              {cup.name}
            </h1>
            {cup.status === "ouverte" && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Ouverte
              </span>
            )}
            {cup.status === "en_cours" && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                En cours
              </span>
            )}
            {cup.status === "terminee" && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                Terminée
              </span>
            )}
            {cup.status === "archivee" && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Archivée
              </span>
            )}
            {cup.isCreator && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-nuffle-gold/20 text-nuffle-bronze">
                Créateur
              </span>
            )}
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
              {rulesetLabels[cup.ruleset] || cup.ruleset}
            </span>
            {!cup.isPublic && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                🔒 Privée
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Créée par <span className="font-medium">{cup.creator.coachName}</span>
            {" • "}
            {cup.participantCount} équipe{cup.participantCount > 1 ? "s" : ""}
          </p>
          {!cup.isPublic && cup.isCreator && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-blue-900 mb-2">
                🔗 Lien de partage pour cette coupe privée :
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/cups/${cup.id}`}
                  className="flex-1 px-3 py-2 bg-white border border-blue-300 rounded text-sm font-mono"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/cups/${cup.id}`;
                    navigator.clipboard.writeText(url);
                    alert("Lien copié dans le presse-papiers !");
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Copier
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Cup Details */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Informations
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Créée le :</span>
                <span className="font-medium">
                  {new Date(cup.createdAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Statut :</span>
                <span className="font-medium">
                  {cup.status === "ouverte" && "Ouverte aux inscriptions"}
                  {cup.status === "en_cours" && "En cours"}
                  {cup.status === "terminee" && "Terminée"}
                  {cup.status === "archivee" && "Archivée"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Visibilité :</span>
                <span className="font-medium">
                  {cup.isPublic ? (
                    <span className="text-green-700">Publique</span>
                  ) : (
                    <span className="text-gray-700">Privée</span>
                  )}
                </span>
              </div>
              {cup.scoringConfig && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                    Système de points
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Victoire :</span>
                        <span className="font-medium">
                          {cup.scoringConfig.winPoints} pts
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Nul :</span>
                        <span className="font-medium">
                          {cup.scoringConfig.drawPoints} pts
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Défaite :</span>
                        <span className="font-medium">
                          {cup.scoringConfig.lossPoints} pts
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Forfait :</span>
                        <span className="font-medium">
                          {cup.scoringConfig.forfeitPoints} pts
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Touchdown :</span>
                        <span className="font-medium">
                          {cup.scoringConfig.touchdownPoints} pts
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">
                          Sortie sur bloc :
                        </span>
                        <span className="font-medium">
                          {cup.scoringConfig.blockCasualtyPoints} pts
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Agression :</span>
                        <span className="font-medium">
                          {cup.scoringConfig.foulCasualtyPoints} pts
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Passe :</span>
                        <span className="font-medium">
                          {cup.scoringConfig.passPoints} pts
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {cup.isCreator && cup.status !== "archivee" && cup.status !== "ouverte" && (
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  {cup.status === "terminee" ? (
                    <>
                      <span className="text-gray-600">Archiver la coupe :</span>
                      <button
                        onClick={async () => {
                          if (!confirm("Êtes-vous sûr de vouloir archiver cette coupe ? Cette action est irréversible.")) {
                            return;
                          }
                          try {
                            await postJSON(`/cup/${cupId}/status`, { status: "archivee" });
                            loadCup();
                          } catch (err: any) {
                            setError(err.message || "Erreur lors de l'archivage");
                          }
                        }}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-all"
                      >
                        Archiver
                      </button>
                    </>
                  ) : cup.status === "en_cours" ? (
                    <>
                      <span className="text-gray-600">Terminer la coupe :</span>
                      <button
                        onClick={async () => {
                          if (!confirm("Êtes-vous sûr de vouloir terminer cette coupe ?")) {
                            return;
                          }
                          try {
                            await postJSON(`/cup/${cupId}/status`, { status: "terminee" });
                            loadCup();
                          } catch (err: any) {
                            setError(err.message || "Erreur lors de la mise à jour du statut");
                          }
                        }}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-all"
                      >
                        Terminer la coupe
                      </button>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Équipes inscrites ({cup.participants.length})
            </h2>
            {cup.participants.length === 0 ? (
              <p className="text-sm text-gray-500">
                Aucune équipe inscrite pour le moment
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {cup.participants.map((participant) => {
                  const isMyTeam = cup.userParticipatingTeamIds?.includes(participant.id) || false;
                  return (
                    <div
                      key={participant.id}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-200 relative"
                    >
                      <div className="font-medium text-gray-900">
                        {participant.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {participant.roster} • {participant.owner.coachName}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {participant.owner.email}
                      </div>
                      {isMyTeam && cup.status === "ouverte" && !cup.validated && (
                        <button
                          onClick={() => handleUnregister(participant.id)}
                          className="mt-2 w-full px-3 py-1.5 bg-red-100 text-red-700 rounded text-xs font-medium hover:bg-red-200 transition-all"
                        >
                          Retirer mon équipe
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {cup.standings && cup.standings.length > 0 && (
            <div className="pt-6 border-t border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Classement
              </h2>
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700">
                      <th className="px-2 py-2 text-left font-semibold">#</th>
                      <th className="px-2 py-2 text-left font-semibold">
                        Équipe
                      </th>
                      <th className="px-2 py-2 text-center font-semibold">
                        MJ
                      </th>
                      <th className="px-2 py-2 text-center font-semibold">
                        V
                      </th>
                      <th className="px-2 py-2 text-center font-semibold">
                        N
                      </th>
                      <th className="px-2 py-2 text-center font-semibold">
                        D
                      </th>
                      <th className="px-2 py-2 text-center font-semibold">
                        TD+
                      </th>
                      <th className="px-2 py-2 text-center font-semibold">
                        TD-
                      </th>
                      <th className="px-2 py-2 text-center font-semibold">
                        Diff TD
                      </th>
                      <th className="px-2 py-2 text-center font-semibold">
                        Passe
                      </th>
                      <th className="px-2 py-2 text-center font-semibold">
                        Sorties
                      </th>
                      <th className="px-2 py-2 text-center font-semibold">
                        Agr
                      </th>
                      <th className="px-2 py-2 text-center font-semibold">
                        Pts
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {cup.standings.map((team, index) => (
                      <tr
                        key={team.teamId}
                        className={
                          index % 2 === 0 ? "bg-white" : "bg-gray-50"
                        }
                      >
                        <td className="px-2 py-1 text-center text-gray-700">
                          {index + 1}
                        </td>
                        <td className="px-2 py-1 text-gray-900 font-medium">
                          {team.teamName}
                        </td>
                        <td className="px-2 py-1 text-center">
                          {team.matchesPlayed}
                        </td>
                        <td className="px-2 py-1 text-center">{team.wins}</td>
                        <td className="px-2 py-1 text-center">{team.draws}</td>
                        <td className="px-2 py-1 text-center">{team.losses}</td>
                        <td className="px-2 py-1 text-center">
                          {team.touchdownsFor}
                        </td>
                        <td className="px-2 py-1 text-center">
                          {team.touchdownsAgainst}
                        </td>
                        <td className="px-2 py-1 text-center">
                          {team.touchdownDiff}
                        </td>
                        <td className="px-2 py-1 text-center">
                          {team.passes}
                        </td>
                        <td className="px-2 py-1 text-center">
                          {team.blockCasualties}
                        </td>
                        <td className="px-2 py-1 text-center">
                          {team.foulCasualties}
                        </td>
                        <td className="px-2 py-1 text-center font-semibold text-nuffle-anthracite">
                          {team.totalPoints}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {cup.matches && cup.matches.length > 0 && (
            <div className="pt-6 border-t border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Matchs de la coupe
              </h2>
              <div className="space-y-3">
                {cup.matches.map((match) => (
                  <button
                    key={match.id}
                    onClick={() => router.push(`/local-matches/${match.id}`)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors text-left"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {match.teamA.name}
                        </span>
                        <span className="text-xs text-gray-500">vs</span>
                        <span className="font-medium text-gray-900">
                          {match.teamB?.name || "??"}
                        </span>
                        {match.status === "completed" &&
                          match.scoreTeamA !== null &&
                          match.scoreTeamB !== null && (
                            <span className="ml-2 text-sm font-semibold text-gray-800">
                              {match.scoreTeamA} - {match.scoreTeamB}
                            </span>
                          )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(match.createdAt).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 text-right">
                      <div>
                        {match.status === "completed"
                          ? "Terminée"
                          : match.status === "in_progress"
                            ? "En cours"
                            : "En préparation"}
                      </div>
                      <div className="mt-1">
                        {match.isPublic ? "🌍 Public" : "🔒 Privé"}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {cup.actionAwards && (
            <div className="pt-6 border-t border-gray-200 space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Podiums par type d'action
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Le Pichichi du TD */}
                {cup.actionAwards.topScorers && cup.actionAwards.topScorers.length > 0 && (
                  <div className="bg-yellow-100 border border-yellow-300 rounded-xl p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-yellow-900 mb-2">
                      Le Pichichi du TD
                    </h3>
                    {cup.actionAwards.topScorers.map((entry) => (
                      <div key={entry.teamId} className="flex justify-between text-sm">
                        <span className="font-medium text-gray-900">
                          {entry.teamName}
                        </span>
                        <span className="font-semibold text-gray-800">
                          {entry.value} TD
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* The Wall */}
                {cup.actionAwards.bestDefense && cup.actionAwards.bestDefense.length > 0 && (
                  <div className="bg-blue-100 border border-blue-300 rounded-xl p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-blue-900 mb-2">
                      The Wall
                    </h3>
                    {cup.actionAwards.bestDefense.map((entry) => (
                      <div key={entry.teamId} className="flex justify-between text-sm">
                        <span className="font-medium text-gray-900">
                          {entry.teamName}
                        </span>
                        <span className="font-semibold text-gray-800">
                          {entry.value} TD encaissé{entry.value > 1 ? "s" : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* La BASH ! */}
                {cup.actionAwards.bashers && cup.actionAwards.bashers.length > 0 && (
                  <div className="bg-red-100 border border-red-300 rounded-xl p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-red-900 mb-2">
                      La BASH !
                    </h3>
                    {cup.actionAwards.bashers.map((entry) => (
                      <div key={entry.teamId} className="flex justify-between text-sm">
                        <span className="font-medium text-gray-900">
                          {entry.teamName}
                        </span>
                        <span className="font-semibold text-gray-800">
                          {entry.value} élimination{entry.value > 1 ? "s" : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* La Honte */}
                {cup.actionAwards.shamePassers && cup.actionAwards.shamePassers.length > 0 && (
                  <div className="bg-purple-100 border border-purple-300 rounded-xl p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-purple-900 mb-2">
                      La Honte
                    </h3>
                    {cup.actionAwards.shamePassers.map((entry) => (
                      <div key={entry.teamId} className="flex justify-between text-sm">
                        <span className="font-medium text-gray-900">
                          {entry.teamName}
                        </span>
                        <span className="font-semibold text-gray-800">
                          {entry.value} passe{entry.value > 1 ? "s" : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Crampons affûtés */}
                {cup.actionAwards.foulExperts && cup.actionAwards.foulExperts.length > 0 && (
                  <div className="bg-orange-100 border border-orange-300 rounded-xl p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-orange-900 mb-2">
                      Crampons affûtés
                    </h3>
                    {cup.actionAwards.foulExperts.map((entry) => (
                      <div key={entry.teamId} className="flex justify-between text-sm">
                        <span className="font-medium text-gray-900">
                          {entry.teamName}
                        </span>
                        <span className="font-semibold text-gray-800">
                          {entry.value} agression{entry.value > 1 ? "s" : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Les Indestructibles */}
                {cup.actionAwards.indestructible && cup.actionAwards.indestructible.length > 0 && (
                  <div className="bg-emerald-100 border border-emerald-300 rounded-xl p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-emerald-900 mb-2">
                      Les Indestructibles
                    </h3>
                    {cup.actionAwards.indestructible.map((entry) => (
                      <div key={entry.teamId} className="flex justify-between text-sm">
                        <span className="font-medium text-gray-900">
                          {entry.teamName}
                        </span>
                        <span className="font-semibold text-gray-800">
                          {entry.value} sortie{entry.value > 1 ? "s" : ""} subie{entry.value > 1 ? "s" : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Les Martyrs */}
                {cup.actionAwards.martyrs && cup.actionAwards.martyrs.length > 0 && (
                  <div className="bg-rose-100 border border-rose-300 rounded-xl p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-rose-900 mb-2">
                      Les Martyrs
                    </h3>
                    {cup.actionAwards.martyrs.map((entry) => (
                      <div key={entry.teamId} className="flex justify-between text-sm">
                        <span className="font-medium text-gray-900">
                          {entry.teamName}
                        </span>
                        <span className="font-semibold text-gray-800">
                          {entry.value} victime{entry.value > 1 ? "s" : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Les Perméables */}
                {cup.actionAwards.permeable && cup.actionAwards.permeable.length > 0 && (
                  <div className="bg-sky-100 border border-sky-300 rounded-xl p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-sky-900 mb-2">
                      Les Perméables
                    </h3>
                    {cup.actionAwards.permeable.map((entry) => (
                      <div key={entry.teamId} className="flex justify-between text-sm">
                        <span className="font-medium text-gray-900">
                          {entry.teamName}
                        </span>
                        <span className="font-semibold text-gray-800">
                          {entry.value} TD encaissé{entry.value > 1 ? "s" : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        {cup.isCreator && cup.status === "ouverte" && !cup.validated && (
          <button
            onClick={handleValidate}
            className="px-5 py-2.5 bg-nuffle-gold text-white rounded-lg font-medium hover:bg-nuffle-gold/90 transition-all"
          >
            Fermer les inscriptions
          </button>
        )}
        {!cup.hasTeamParticipating && cup.status === "ouverte" && eligibleTeams.length > 0 && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Choisir une équipe à inscrire
            </label>
            <div className="flex gap-2">
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all"
              >
                <option value="">-- Sélectionner une équipe --</option>
                {eligibleTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.roster})
                  </option>
                ))}
              </select>
              <button
                onClick={handleRegister}
                disabled={!selectedTeamId}
                className="px-5 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Inscrire l'équipe
              </button>
            </div>
          </div>
        )}
        {!cup.hasTeamParticipating && cup.status === "ouverte" && eligibleTeams.length === 0 && (
          <div className="text-sm text-gray-600 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            Aucune équipe disponible avec le ruleset {rulesetLabels[cup.ruleset] || cup.ruleset}. Créez-en une ou modifiez une équipe existante.
          </div>
        )}
        {cup.hasTeamParticipating && (
          <div className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium">
            ✓ Une de vos équipes est inscrite à cette coupe
          </div>
        )}
        {teams.length === 0 && !cup.hasTeamParticipating && cup.status === "ouverte" && (
          <div className="text-sm text-gray-600 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="mb-2">Vous devez créer une équipe pour participer à une coupe.</p>
            <a
              href="/me/teams/new"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              Créer une équipe →
            </a>
          </div>
        )}
        {cup.status === "en_cours" && cup.participants.length >= 2 && (
          <button
            onClick={() => router.push(`/local-matches/new?cupId=${cup.id}`)}
            className="w-full px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all"
          >
            Créer un match local pour cette coupe
          </button>
        )}
      </div>
    </div>
  );
}

