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
}: CupBracketViewProps): JSX.Element | null {
  if (!matches || matches.length === 0) return null;

  const sorted = [...matches].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  return (
    <section
      data-testid="cup-bracket-view"
      className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm"
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
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 ${
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
                  {m.teamA.name}
                </span>
                <span className="text-sm text-gray-600">
                  {m.status === "completed" &&
                  m.scoreTeamA !== null &&
                  m.scoreTeamB !== null
                    ? `${m.scoreTeamA} – ${m.scoreTeamB}`
                    : m.teamB === null
                      ? "vs ?"
                      : "vs"}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 ${
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
                  {m.teamB?.name ?? "—"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
