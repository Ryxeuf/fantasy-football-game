"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiRequest } from "../../../../lib/api-client";
import TeamLogo from "../../../../components/TeamLogo";
import SkillTooltip from "../../../../me/teams/components/SkillTooltip";

// Page roster d'un participant de la ligue (lecture seule). Accessible à
// tout coach inscrit à la ligue via la route serveur
// `/leagues/:leagueId/teams/:teamId/roster-view`.

interface RosterPlayer {
  id: string;
  name: string;
  position: string;
  positionName?: string;
  number: number;
  ma: number;
  st: number;
  ag: number;
  pa: number | null;
  av: number;
  skills: string;
  spp: number;
  dead: boolean;
}

interface RosterTeam {
  id: string;
  name: string;
  roster: string;
  raceName: string;
  coachName: string | null;
  treasury: number;
  teamValue: number;
  currentValue: number;
  rerolls: number;
  cheerleaders: number;
  assistants: number;
  apothecary: boolean;
  dedicatedFans: number;
}

interface RosterResponse {
  team: RosterTeam;
  players: RosterPlayer[];
}

function formatGold(n: number): string {
  return `${n.toLocaleString("fr-FR")} po`;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="text-sm font-semibold text-nuffle-anthracite tabular-nums">
        {value}
      </div>
    </div>
  );
}

export default function LeagueTeamRosterPage() {
  const params = useParams();
  const leagueId = typeof params.id === "string" ? params.id : "";
  const teamId = typeof params.teamId === "string" ? params.teamId : "";

  const [data, setData] = useState<RosterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!leagueId || !teamId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiRequest<RosterResponse>(
      `/leagues/${leagueId}/teams/${teamId}/roster-view`,
    )
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erreur");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leagueId, teamId]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <Link
        href={`/leagues/${leagueId}`}
        className="text-sm text-nuffle-bronze hover:underline"
      >
        ← Retour à la ligue
      </Link>

      {loading ? (
        <p className="mt-6 text-sm text-gray-500">Chargement du roster…</p>
      ) : error ? (
        <p
          data-testid="league-roster-error"
          className="mt-6 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      ) : data ? (
        <div data-testid="league-roster-page" className="mt-4 space-y-5">
          {/* En-tête équipe */}
          <header className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
            <TeamLogo slug={data.team.roster} size={56} title={data.team.name} />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-nuffle-anthracite">
                {data.team.name}
              </h1>
              <p className="text-sm text-gray-600">
                {data.team.raceName}
                {data.team.coachName ? ` • Coach ${data.team.coachName}` : ""}
              </p>
            </div>
          </header>

          {/* Stats clés */}
          <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCard
              label="Valeur d'équipe"
              value={formatGold(data.team.teamValue)}
            />
            <StatCard
              label="VEA (actuelle)"
              value={formatGold(data.team.currentValue)}
            />
            <StatCard label="Trésorerie" value={formatGold(data.team.treasury)} />
            <StatCard
              label="Joueurs"
              value={String(data.players.length)}
            />
          </section>

          {/* Staff & relances */}
          <section className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              Relances : <strong>{data.team.rerolls}</strong>
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              Pom-pom girls : <strong>{data.team.cheerleaders}</strong>
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              Assistants : <strong>{data.team.assistants}</strong>
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              Apothicaire : <strong>{data.team.apothecary ? "oui" : "non"}</strong>
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              Fans dévoués : <strong>{data.team.dedicatedFans}</strong>
            </span>
          </section>

          {/* Roster */}
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">N°</th>
                    <th className="px-3 py-2 text-left">Nom</th>
                    <th className="px-3 py-2 text-left">Poste</th>
                    <th className="px-2 py-2 text-right">MA</th>
                    <th className="px-2 py-2 text-right">ST</th>
                    <th className="px-2 py-2 text-right">AG</th>
                    <th className="px-2 py-2 text-right">PA</th>
                    <th className="px-2 py-2 text-right">AV</th>
                    <th className="px-3 py-2 text-left">Compétences</th>
                    <th className="px-2 py-2 text-right">SPP</th>
                  </tr>
                </thead>
                <tbody>
                  {data.players.map((p) => {
                    return (
                      <tr
                        key={p.id}
                        className={`border-t border-gray-100 ${
                          p.dead
                            ? "text-gray-400 line-through"
                            : "hover:bg-slate-50/60"
                        }`}
                      >
                        <td className="px-3 py-2 tabular-nums text-gray-500">
                          {p.number}
                        </td>
                        <td className="px-3 py-2 font-medium text-nuffle-anthracite">
                          {p.name}
                          {p.dead ? " ☠" : ""}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {p.positionName ?? p.position}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {p.ma}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {p.st}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {p.ag}+
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {p.pa === null ? "–" : `${p.pa}+`}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {p.av}+
                        </td>
                        <td className="px-3 py-2">
                          <SkillTooltip
                            skillsString={p.skills}
                            position={p.position}
                            useDirectParsing
                          />
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {p.spp}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
