"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "../contexts/LanguageContext";

export type Season = "season_2" | "season_3";
type Tier = "all" | "I" | "II" | "III" | "IV";

export interface RosterSummary {
  slug: string;
  name: string;
  budget: number;
  tier: string;
  naf: boolean;
  positionCount: number;
}

interface TeamsListClientProps {
  initialRosters: RosterSummary[];
  initialSeason: Season;
}

const API_BASE_PUBLIC =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8201";

function getTierColor(tier: string): string {
  switch (tier) {
    case "I":
      return "bg-green-100 text-green-800 border-green-200";
    case "II":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "III":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "IV":
      return "bg-orange-100 text-orange-800 border-orange-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

export default function TeamsListClient({
  initialRosters,
  initialSeason,
}: TeamsListClientProps) {
  const { language, t } = useLanguage();
  const router = useRouter();
  const [teams, setTeams] = useState<RosterSummary[]>(initialRosters);
  const [selectedTier, setSelectedTier] = useState<Tier>("all");

  // Re-fetch only when the user switches to a non-default language. The
  // server-rendered payload already contains French names, so French users
  // never hit the network on first paint.
  useEffect(() => {
    if (language === "fr") {
      setTeams(initialRosters);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          `${API_BASE_PUBLIC}/api/rosters?lang=en&ruleset=${initialSeason}`,
        );
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled) return;
        setTeams(
          data.rosters.map((r: any) => ({
            slug: r.slug,
            name: r.name,
            budget: r.budget,
            tier: r.tier,
            naf: r.naf,
            positionCount: r._count?.positions ?? 0,
          })),
        );
      } catch {
        // Keep the initial server-rendered rosters on failure.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [language, initialRosters, initialSeason]);

  const handleSeasonChange = (season: Season) => {
    if (season === initialSeason) return;
    router.push(`/teams?ruleset=${season}`);
  };

  const tierCounts = useMemo(
    () => ({
      I: teams.filter((t) => t.tier === "I").length,
      II: teams.filter((t) => t.tier === "II").length,
      III: teams.filter((t) => t.tier === "III").length,
      IV: teams.filter((t) => t.tier === "IV").length,
    }),
    [teams],
  );

  const sortedTeams = useMemo(() => {
    const filtered =
      selectedTier === "all"
        ? teams
        : teams.filter((team) => team.tier === selectedTier);
    return [...filtered].sort((a, b) => {
      if (a.tier !== b.tier) {
        return a.tier.localeCompare(b.tier);
      }
      return a.name.localeCompare(b.name);
    });
  }, [teams, selectedTier]);

  return (
    <div className="w-full p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">
          {t.teams.allTeams}
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          {t.teams.allTeamsDescription}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t.teams.filterBySeason}
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => handleSeasonChange("season_2")}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                initialSeason === "season_2"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {t.teams.rulesetSeason2}
            </button>
            <button
              onClick={() => handleSeasonChange("season_3")}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                initialSeason === "season_3"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {t.teams.rulesetSeason3}
            </button>
          </div>
        </div>

        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t.teams.filterByTier}
          </label>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedTier("all")}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedTier === "all"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {t.teams.allTiers}
            </button>
            {(["I", "II", "III", "IV"] as const).map((tier) => (
              <button
                key={tier}
                onClick={() => setSelectedTier(tier)}
                disabled={tierCounts[tier] === 0}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedTier === tier
                    ? "bg-blue-600 text-white"
                    : tierCounts[tier] === 0
                      ? "bg-gray-50 text-gray-300 cursor-not-allowed"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Tier {tier} ({tierCounts[tier]})
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {sortedTeams.map((team) => (
          <Link
            key={team.slug}
            href={`/teams/${team.slug}?ruleset=${initialSeason}`}
            className="rounded-xl border-2 border-blue-200 bg-white p-6 hover:border-blue-400 hover:shadow-lg transition-all text-left"
          >
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-lg font-semibold text-blue-900">
                {team.name}
              </h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span
                className={`px-2 py-1 rounded border text-xs font-medium ${getTierColor(team.tier)}`}
              >
                Tier {team.tier}
              </span>
              {team.naf && (
                <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-800 text-xs font-medium">
                  NAF
                </span>
              )}
            </div>
            <div className="text-sm text-gray-600">
              <div>
                {t.teams.budgetLabel.replace(
                  /\{budget\}/g,
                  team.budget.toString(),
                )}
              </div>
              <div>
                {t.teams.positionsAvailable.replace(
                  /\{count\}/g,
                  team.positionCount.toString(),
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {sortedTeams.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          {language === "fr"
            ? "Aucune équipe trouvée avec ces filtres"
            : "No teams found with these filters"}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4 mt-6 sm:mt-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-600 font-medium">
            {t.teams.totalTeams}
          </div>
          <div className="text-2xl font-bold text-blue-900">{teams.length}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-sm text-green-600 font-medium">
            {t.teams.tierI}
          </div>
          <div className="text-2xl font-bold text-green-900">
            {tierCounts.I}
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-600 font-medium">
            {t.teams.tierII}
          </div>
          <div className="text-2xl font-bold text-blue-900">
            {tierCounts.II}
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-sm text-yellow-600 font-medium">
            {t.teams.tierIII}
          </div>
          <div className="text-2xl font-bold text-yellow-900">
            {tierCounts.III}
          </div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="text-sm text-orange-600 font-medium">
            {t.teams.tierIV}
          </div>
          <div className="text-2xl font-bold text-orange-900">
            {tierCounts.IV}
          </div>
        </div>
      </div>
    </div>
  );
}
