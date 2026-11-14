/**
 * S27.1j — Bracket visuel pour `/cups/[id]`.
 *
 * Affiche la grille des matches d'une cup en lecture chronologique
 * (createdAt ASC) avec mise en evidence du vainqueur via
 * `data-winner='A'|'B'|'draw'`. Foundation pour un futur vrai
 * bracket d'elimination (necessite l'infra round/seed pas encore
 * en place dans la table Cup).
 *
 * Concu pour rester additif a la page detail existante (apps/web/
 * app/cups/[id]/page.tsx, ~932l) sans toucher au monolithe.
 */

import TeamLogo from "../../components/TeamLogo";
import TeamRosterLink from "../../leagues/[id]/TeamRosterLink";

interface CupBracketTeam {
  id: string;
  name: string;
  roster: string;
  ruleset: string;
  /** Logo uploadé par le coach (null => logo dérivé du roster). */
  logoUrl?: string | null;
}

interface CupBracketMatch {
  id: string;
  name: string | null;
  status: string;
  isPublic: boolean;
  teamA: CupBracketTeam;
  teamB: CupBracketTeam | null;
  scoreTeamA: number | null;
  scoreTeamB: number | null;
  createdAt: string;
}

interface CupBracketViewProps {
  matches?: CupBracketMatch[];
  /** Coupe de consultation : les noms mènent au roster. Absent => texte. */
  cupId?: string | null;
}

function pickWinner(
  match: CupBracketMatch,
): "A" | "B" | "draw" | null {
  if (match.status !== "completed") return null;
  if (match.scoreTeamA === null || match.scoreTeamB === null) return null;
  if (match.scoreTeamA > match.scoreTeamB) return "A";
  if (match.scoreTeamB > match.scoreTeamA) return "B";
  return "draw";
}

export default function CupBracketView({
  matches,
  cupId = null,
}: CupBracketViewProps): JSX.Element | null {
  if (!matches || matches.length === 0) return null;

  const sorted = [...matches].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  return (
    <section
      data-testid="cup-bracket-view"
      className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm"
    >
      <h2 className="text-lg font-bold text-nuffle-anthracite">
        Bracket visuel
      </h2>
      <p className="text-sm text-gray-500 mt-1">
        Vue chronologique des matches de la cup.
      </p>
      <ul className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {sorted.map((m) => {
          const winner = pickWinner(m);
          const aWins = winner === "A";
          const bWins = winner === "B";
          return (
            <li
              key={m.id}
              data-testid={`cup-bracket-match-${m.id}`}
              data-winner={winner ?? ""}
              className="border border-gray-200 rounded-lg p-3 flex flex-col gap-1"
            >
              {m.name ? (
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  {m.name}
                </p>
              ) : null}
              {/* Mobile : équipe A / score / équipe B empilés, chaque nom a
                  toute la largeur. À partir de `sm` : grille 1fr / auto /
                  1fr, score centré. En flex sur une seule ligne, les noms
                  s'écrasaient mot par mot. */}
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-2">
                <span
                  className={`flex min-w-0 items-center gap-1.5 break-words ${
                    aWins
                      ? "font-bold text-nuffle-anthracite"
                      : "text-nuffle-anthracite"
                  }`}
                >
                  <TeamLogo
                    slug={m.teamA.roster}
                    logoUrl={m.teamA.logoUrl ?? null}
                    size={20}
                    className="shrink-0"
                  />
                  <TeamRosterLink
                    competition="cup"
                    leagueId={cupId}
                    teamId={m.teamA.id}
                    canViewRoster
                    testIdSuffix={`bracket-${m.id}-a`}
                  >
                    {m.teamA.name}
                  </TeamRosterLink>
                </span>
                <span className="whitespace-nowrap pl-[26px] text-sm text-gray-600 sm:pl-0 sm:text-center">
                  {m.status === "completed" &&
                  m.scoreTeamA !== null &&
                  m.scoreTeamB !== null
                    ? `${m.scoreTeamA} – ${m.scoreTeamB}`
                    : m.teamB === null
                      ? "vs ?"
                      : "vs"}
                </span>
                <span
                  className={`flex min-w-0 items-center gap-1.5 break-words sm:flex-row-reverse sm:text-right ${
                    bWins
                      ? "font-bold text-nuffle-anthracite"
                      : "text-nuffle-anthracite"
                  }`}
                >
                  {m.teamB ? (
                    <TeamLogo
                      slug={m.teamB.roster}
                      logoUrl={m.teamB.logoUrl ?? null}
                      size={20}
                      className="shrink-0"
                    />
                  ) : null}
                  {m.teamB ? (
                    <TeamRosterLink
                      competition="cup"
                      leagueId={cupId}
                      teamId={m.teamB.id}
                      canViewRoster
                      testIdSuffix={`bracket-${m.id}-b`}
                    >
                      {m.teamB.name}
                    </TeamRosterLink>
                  ) : (
                    "—"
                  )}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
