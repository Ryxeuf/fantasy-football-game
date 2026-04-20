"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "../../../../auth-client";

interface TeamCareerRecord {
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  touchdownsFor: number;
  touchdownsAgainst: number;
  casualtiesInflicted: number;
  casualtiesSuffered: number;
  completions: number;
  interceptions: number;
  winRate: number;
}

interface MatchHistoryEntry {
  matchId: string;
  createdAt: string;
  endedAt: string | null;
  teamSide: "A" | "B";
  myScore: number;
  opponentScore: number;
  outcome: "win" | "draw" | "loss";
  opponentCoachName: string | null;
  opponentTeamName: string | null;
  opponentRoster: string | null;
}

interface PlayerCareerStats {
  id: string;
  name: string;
  number: number;
  position: string;
  spp: number;
  matchesPlayed: number;
  totalTouchdowns: number;
  totalCasualties: number;
  totalCompletions: number;
  totalInterceptions: number;
  totalMvpAwards: number;
  nigglingInjuries: number;
  advancementsCount: number;
  dead: boolean;
}

interface CareerResponse {
  team: { id: string; name: string; roster: string; ruleset: string };
  record: TeamCareerRecord;
  history: MatchHistoryEntry[];
  players: PlayerCareerStats[];
}

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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function outcomeBadge(outcome: "win" | "draw" | "loss"): string {
  if (outcome === "win") return "bg-green-600 text-white";
  if (outcome === "draw") return "bg-yellow-600 text-white";
  return "bg-red-600 text-white";
}

function outcomeLabel(outcome: "win" | "draw" | "loss"): string {
  if (outcome === "win") return "Victoire";
  if (outcome === "draw") return "Nul";
  return "Defaite";
}

export default function TeamCareerPage() {
  const [data, setData] = useState<CareerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const teamId =
    typeof window !== "undefined"
      ? window.location.pathname.split("/").slice(-2, -1)[0]
      : "";

  useEffect(() => {
    if (!teamId) return;
    fetchJSON(`/career-stats/team/${teamId}`)
      .then((d: CareerResponse) => setData(d))
      .catch((e) => setError(e.message || "Erreur lors du chargement"))
      .finally(() => setLoading(false));
  }, [teamId]);

  if (loading) {
    return (
      <div className="w-full max-w-5xl mx-auto p-6 text-gray-300">
        Chargement des stats de carriere...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-full max-w-5xl mx-auto p-6">
        <p className="text-red-400">Erreur : {error ?? "Donnees indisponibles"}</p>
        <a
          href={`/me/teams/${teamId}`}
          className="text-blue-400 hover:underline text-sm"
        >
          Retour a la fiche d&apos;equipe
        </a>
      </div>
    );
  }

  const { team, record, history, players } = data;
  const sortedPlayers = [...players].sort((a, b) => b.spp - a.spp);
  const winRatePct = (record.winRate * 100).toFixed(1);

  return (
    <div className="w-full max-w-5xl mx-auto p-6 space-y-6 text-white">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">
            {team.name} — Stats de carriere
          </h1>
          <p className="text-sm text-gray-400">
            Roster {team.roster} ({team.ruleset === "season_3" ? "S3" : "S2"})
          </p>
        </div>
        <a
          href={`/me/teams/${team.id}`}
          className="text-blue-400 hover:underline text-sm"
        >
          &larr; Retour a la fiche d&apos;equipe
        </a>
      </div>

      {/* Team record */}
      <section className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3">
        <h2 className="text-lg font-semibold">Palmares en matchs online</h2>
        {record.matchesPlayed === 0 ? (
          <p className="text-gray-400 text-sm">
            Aucun match termine pour cette equipe.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Matchs joues" value={record.matchesPlayed} />
            <Stat
              label="V - N - D"
              value={`${record.wins} - ${record.draws} - ${record.losses}`}
            />
            <Stat label="Taux de victoire" value={`${winRatePct}%`} />
            <Stat
              label="TD (pour / contre)"
              value={`${record.touchdownsFor} / ${record.touchdownsAgainst}`}
            />
            <Stat
              label="Sorties infligees / subies"
              value={`${record.casualtiesInflicted} / ${record.casualtiesSuffered}`}
            />
            <Stat label="Passes reussies" value={record.completions} />
            <Stat label="Interceptions" value={record.interceptions} />
          </div>
        )}
      </section>

      {/* Match history */}
      <section className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3">
        <h2 className="text-lg font-semibold">Historique des matchs</h2>
        {history.length === 0 ? (
          <p className="text-gray-400 text-sm">Aucun match termine.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((entry) => (
              <li
                key={entry.matchId}
                className="flex flex-wrap items-center justify-between gap-3 p-3 border border-gray-700 rounded"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${outcomeBadge(entry.outcome)}`}
                  >
                    {outcomeLabel(entry.outcome)}
                  </span>
                  <span className="font-mono text-sm">
                    {entry.myScore} - {entry.opponentScore}
                  </span>
                  <span className="text-sm text-gray-300">
                    vs {entry.opponentTeamName ?? "?"}
                    {entry.opponentCoachName
                      ? ` (Coach ${entry.opponentCoachName})`
                      : ""}
                  </span>
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-3">
                  <span>{formatDate(entry.createdAt)}</span>
                  <a
                    href={`/replay/${entry.matchId}`}
                    className="text-blue-400 hover:underline"
                  >
                    Replay
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Per-player career */}
      <section className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3">
        <h2 className="text-lg font-semibold">Stats de carriere par joueur</h2>
        {sortedPlayers.length === 0 ? (
          <p className="text-gray-400 text-sm">Aucun joueur dans cette equipe.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Joueur</th>
                  <th className="py-2 pr-3">Poste</th>
                  <th className="py-2 pr-3">Matchs</th>
                  <th className="py-2 pr-3">SPP</th>
                  <th className="py-2 pr-3">TD</th>
                  <th className="py-2 pr-3">Sorties</th>
                  <th className="py-2 pr-3">Passes</th>
                  <th className="py-2 pr-3">Int.</th>
                  <th className="py-2 pr-3">MVP</th>
                  <th className="py-2 pr-3">Lvl-ups</th>
                  <th className="py-2 pr-3">Bles. graves</th>
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.map((p) => (
                  <tr
                    key={p.id}
                    className={`border-b border-gray-800 ${p.dead ? "text-red-400" : ""}`}
                  >
                    <td className="py-2 pr-3 text-gray-400">{p.number}</td>
                    <td className="py-2 pr-3 font-semibold">
                      {p.name}
                      {p.dead ? (
                        <span className="ml-2 text-xs bg-red-900 text-red-200 px-2 py-0.5 rounded-full">
                          RIP
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-gray-300">{p.position}</td>
                    <td className="py-2 pr-3">{p.matchesPlayed}</td>
                    <td className="py-2 pr-3 font-semibold">{p.spp}</td>
                    <td className="py-2 pr-3">{p.totalTouchdowns}</td>
                    <td className="py-2 pr-3">{p.totalCasualties}</td>
                    <td className="py-2 pr-3">{p.totalCompletions}</td>
                    <td className="py-2 pr-3">{p.totalInterceptions}</td>
                    <td className="py-2 pr-3">{p.totalMvpAwards}</td>
                    <td className="py-2 pr-3">{p.advancementsCount}</td>
                    <td className="py-2 pr-3">{p.nigglingInjuries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-900/50 rounded p-3 border border-gray-700">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
