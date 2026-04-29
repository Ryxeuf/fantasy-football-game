import type { CoachShowcaseAchievement } from "./types";

interface CoachAchievementsShowcaseProps {
  achievements: CoachShowcaseAchievement[];
}

function formatUnlockedYear(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return String(d.getUTCFullYear());
}

export default function CoachAchievementsShowcase({
  achievements,
}: CoachAchievementsShowcaseProps): JSX.Element | null {
  if (achievements.length === 0) {
    return null;
  }

  return (
    <section
      data-testid="coach-achievements-showcase"
      className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm"
    >
      <h2 className="text-lg font-bold text-nuffle-anthracite">
        Succes recents
      </h2>
      <p className="text-sm text-gray-500 mt-1">
        Derniers succes deverrouilles par ce coach.
      </p>
      <ul className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {achievements.map((ach) => (
          <li
            key={ach.slug}
            data-testid={`coach-achievement-${ach.slug}`}
            className="border border-gray-200 rounded-lg p-3 flex items-start gap-2"
          >
            <span className="text-2xl leading-none" aria-hidden>
              {ach.icon}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-nuffle-anthracite truncate">
                {ach.nameFr}
              </p>
              <p className="text-xs text-gray-500">
                Debloque en {formatUnlockedYear(ach.unlockedAt)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
