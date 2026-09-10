"use client";
import TeamLogo from "../../components/TeamLogo";

/**
 * Tableau de classement d'une coupe.
 *
 * Extrait de la page de détail (où il vivait inline) pour pouvoir être rendu
 * PLUSIEURS fois : une fois par poule quand la coupe en a, une fois pour tout
 * le monde sinon. Purement présentationnel — le tri est déjà fait par le
 * serveur (`services/cup-standings-order`), l'écran ne fait qu'afficher.
 */

export interface CupStandingRow {
  teamId: string;
  teamName: string;
  roster: string;
  logoUrl?: string | null;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  /** Exempts (ronde suisse). Optionnel : API antérieure. */
  byes?: number;
  touchdownsFor: number;
  touchdownsAgainst: number;
  touchdownDiff: number;
  passes: number;
  blockCasualties: number;
  foulCasualties: number;
  totalPoints: number;
}

interface CupStandingsProps {
  readonly standings: readonly CupStandingRow[];
  /** `data-testid` du tableau (distinct par poule). */
  readonly testId?: string;
  /**
   * Nombre d'équipes qualifiées depuis ce classement. Les `n` premières
   * lignes sont alors marquées — sans ça, une poule qualificative ne dit
   * pas où passe la barre.
   */
  readonly qualifies?: number;
}

export default function CupStandings({
  standings,
  testId = "cup-standings",
  qualifies = 0,
}: CupStandingsProps) {
  if (standings.length === 0) return null;
  // Colonne « Ex. » masquée tant qu'aucune équipe n'a été exemptée : elle ne
  // veut rien dire hors ronde suisse à effectif impair.
  const showByes = standings.some((t) => (t.byes ?? 0) > 0);

  return (
    <div className="overflow-x-auto -mx-2 sm:mx-0">
      <table className="min-w-full text-sm" data-testid={testId}>
        <thead>
          <tr className="bg-gray-100 text-gray-700">
            <th className="px-2 py-2 text-left font-semibold">#</th>
            <th className="px-2 py-2 text-left font-semibold">Équipe</th>
            <th className="px-2 py-2 text-center font-semibold">MJ</th>
            <th className="px-2 py-2 text-center font-semibold">V</th>
            <th className="px-2 py-2 text-center font-semibold">N</th>
            <th className="px-2 py-2 text-center font-semibold">D</th>
            {showByes && (
              <th
                className="px-2 py-2 text-center font-semibold"
                title="Exempts (ronde suisse) : les points d'une victoire"
              >
                Ex.
              </th>
            )}
            <th className="px-2 py-2 text-center font-semibold">TD+</th>
            <th className="px-2 py-2 text-center font-semibold">TD-</th>
            <th className="px-2 py-2 text-center font-semibold">Diff TD</th>
            <th className="px-2 py-2 text-center font-semibold">Passe</th>
            <th className="px-2 py-2 text-center font-semibold">Sorties</th>
            <th className="px-2 py-2 text-center font-semibold">Agr</th>
            <th className="px-2 py-2 text-center font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((team, index) => {
            const qualified = qualifies > 0 && index < qualifies;
            return (
              <tr
                key={team.teamId}
                data-testid={qualified ? `${testId}-qualified` : undefined}
                className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50"} ${
                  qualified ? "border-l-4 border-l-emerald-500" : ""
                }`}
              >
                <td className="px-2 py-1 text-center text-gray-700">
                  {index + 1}
                </td>
                <td className="px-2 py-1 text-gray-900 font-medium">
                  <span className="inline-flex items-center gap-2">
                    <TeamLogo
                      slug={team.roster}
                      logoUrl={team.logoUrl ?? null}
                      size={22}
                      className="shrink-0"
                    />
                    {team.teamName}
                  </span>
                </td>
                <td className="px-2 py-1 text-center">{team.matchesPlayed}</td>
                <td className="px-2 py-1 text-center">{team.wins}</td>
                <td className="px-2 py-1 text-center">{team.draws}</td>
                <td className="px-2 py-1 text-center">{team.losses}</td>
                {showByes && (
                  <td className="px-2 py-1 text-center">{team.byes ?? 0}</td>
                )}
                <td className="px-2 py-1 text-center">{team.touchdownsFor}</td>
                <td className="px-2 py-1 text-center">
                  {team.touchdownsAgainst}
                </td>
                <td className="px-2 py-1 text-center">{team.touchdownDiff}</td>
                <td className="px-2 py-1 text-center">{team.passes}</td>
                <td className="px-2 py-1 text-center">
                  {team.blockCasualties}
                </td>
                <td className="px-2 py-1 text-center">{team.foulCasualties}</td>
                <td className="px-2 py-1 text-center font-semibold text-nuffle-anthracite">
                  {team.totalPoints}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
