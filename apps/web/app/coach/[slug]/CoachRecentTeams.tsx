import type { CoachRecentTeam } from "./types";

interface CoachRecentTeamsProps {
  teams: CoachRecentTeam[];
}

function formatTeamValue(gp: number): string {
  return `${gp.toLocaleString("fr-FR")} po`;
}

export default function CoachRecentTeams({
  teams,
}: CoachRecentTeamsProps): JSX.Element | null {
  if (teams.length === 0) {
    return null;
  }
  return (
    <section
      data-testid="coach-recent-teams"
      className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm"
    >
      <h2 className="text-lg font-bold text-nuffle-anthracite">
        Equipes recentes
      </h2>
      <p className="text-sm text-gray-500 mt-1">
        Dernieres equipes creees par ce coach.
      </p>
      <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {teams.map((team) => (
          <li
            key={team.id}
            data-testid={`coach-recent-team-${team.id}`}
            className="border border-gray-200 rounded-lg p-3"
          >
            <p className="font-semibold text-nuffle-anthracite truncate">
              {team.name}
            </p>
            <p className="text-xs text-gray-500 capitalize">{team.roster}</p>
            <p className="text-xs text-gray-700 mt-1 font-medium">
              {formatTeamValue(team.currentValue)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
