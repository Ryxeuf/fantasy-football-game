/**
 * Lot 4 « évolution persistée » — section « Le coach » de la fiche équipe.
 *
 * Le coach IA d'une ProTeam a un nom, une philosophie, une expérience et
 * un profil qui évolue entre deux matchs. On montre ses traits les plus
 * marqués et les trois dernières évolutions (texte de la Gazette).
 * Sans coach (équipe qui n'a pas encore joué), la section ne s'affiche pas.
 */

export interface TeamCoachEvolution {
  readonly matchId: string | null;
  readonly summary: string;
  readonly createdAt: string;
}

export interface TeamCoach {
  readonly name: string;
  readonly philosophy: string;
  readonly experience: number;
  readonly profile: Readonly<Record<string, number>>;
  readonly recentEvolutions: readonly TeamCoachEvolution[];
}

interface TraitLabel {
  readonly key: string;
  readonly label: string;
}

const TRAITS: readonly TraitLabel[] = [
  { key: "bashIndex", label: "Bagarre" },
  { key: "passingFrequency", label: "Passes" },
  { key: "riskAppetite", label: "Risque" },
  { key: "cageAffinity", label: "Cage" },
  { key: "pace", label: "Allure" },
  { key: "foulFrequency", label: "Agressions" },
  { key: "stallTendency", label: "Temporisation" },
  { key: "pressingDefense", label: "Pression" },
  { key: "patience", label: "Patience" },
  { key: "gfiTolerance", label: "GFI" },
];

/** Les quatre traits les plus éloignés de 50, les plus marqués d'abord. */
export function topTraits(profile: Readonly<Record<string, number>>, count = 4): readonly { label: string; value: number }[] {
  return TRAITS.map((t) => ({ label: t.label, value: profile[t.key] ?? 50 }))
    .sort((a, b) => Math.abs(b.value - 50) - Math.abs(a.value - 50))
    .slice(0, count);
}

interface TeamCoachSectionProps {
  readonly coach: TeamCoach | null | undefined;
}

export default function TeamCoachSection({ coach }: TeamCoachSectionProps) {
  if (!coach) return null;
  const traits = topTraits(coach.profile);
  return (
    <section
      data-testid="team-coach"
      className="mb-6 rounded border border-slate-800 bg-slate-900 px-4 py-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-100">Le coach</h2>
        <span className="text-xs text-slate-500">
          {coach.experience} match{coach.experience > 1 ? "s" : ""} au compteur
        </span>
      </div>
      <p className="mt-1 text-slate-200">
        <span className="font-bold" data-testid="team-coach-name">
          {coach.name}
        </span>
        <span className="text-slate-400"> · </span>
        <span className="italic text-slate-300" data-testid="team-coach-philosophy">
          {coach.philosophy}
        </span>
      </p>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="team-coach-traits">
        {traits.map((t) => (
          <li key={t.label} className="rounded bg-slate-800 px-2 py-1">
            <div className="flex justify-between text-xs text-slate-400">
              <span>{t.label}</span>
              <span className="font-mono text-slate-200">{t.value}</span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded bg-slate-700">
              <div
                className="h-1.5 rounded bg-amber-500"
                style={{ width: `${Math.max(0, Math.min(100, t.value))}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      {coach.recentEvolutions.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-slate-300" data-testid="team-coach-evolutions">
          {coach.recentEvolutions.map((e, idx) => (
            <li key={`${e.matchId ?? "admin"}-${idx}`} className="flex gap-2">
              <span className="shrink-0 font-mono text-xs text-slate-500">
                {new Date(e.createdAt).toLocaleDateString("fr-FR")}
              </span>
              <span>{e.summary}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
