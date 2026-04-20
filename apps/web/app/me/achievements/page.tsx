"use client";
import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../auth-client";

type Category = "matches" | "scoring" | "casualties" | "social" | "rosters";

interface AchievementView {
  slug: string;
  nameFr: string;
  nameEn: string;
  descriptionFr: string;
  descriptionEn: string;
  category: Category;
  icon: string;
  unlocked: boolean;
  unlockedAt: string | null;
}

interface StatsSummary {
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  touchdowns: number;
  casualties: number;
  friendsCount: number;
  rostersPlayed: string[];
}

interface AchievementsResponse {
  success: boolean;
  data?: {
    stats: StatsSummary;
    achievements: AchievementView[];
  };
  error?: string;
}

const CATEGORY_LABELS: Record<Category, string> = {
  matches: "Matchs",
  scoring: "Touchdowns",
  casualties: "Sorties",
  social: "Social",
  rosters: "Équipes prioritaires",
};

async function fetchAchievements(): Promise<AchievementsResponse> {
  const token = localStorage.getItem("auth_token");
  if (!token) {
    window.location.href = "/login";
    throw new Error("Non authentifié");
  }
  const res = await fetch(`${API_BASE}/achievements`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Non authentifié");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `Erreur ${res.status}`);
  }
  return res.json();
}

function formatDate(raw: string | null): string {
  if (!raw) return "";
  return new Date(raw).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AchievementsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AchievementsResponse["data"] | null>(null);
  const [filter, setFilter] = useState<"all" | "unlocked" | "locked">("all");

  useEffect(() => {
    fetchAchievements()
      .then((r) => {
        if (!r.success || !r.data) {
          throw new Error(r.error || "Erreur inconnue");
        }
        setData(r.data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    if (!data) return {} as Record<Category, AchievementView[]>;
    const map: Record<Category, AchievementView[]> = {
      matches: [],
      scoring: [],
      casualties: [],
      social: [],
      rosters: [],
    };
    for (const ach of data.achievements) {
      if (filter === "unlocked" && !ach.unlocked) continue;
      if (filter === "locked" && ach.unlocked) continue;
      map[ach.category].push(ach);
    }
    return map;
  }, [data, filter]);

  const unlockedCount = data?.achievements.filter((a) => a.unlocked).length ?? 0;
  const totalCount = data?.achievements.length ?? 0;
  const progress =
    totalCount === 0 ? 0 : Math.round((unlockedCount / totalCount) * 100);

  if (loading) {
    return (
      <div className="w-full max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-white">Mes succès</h1>
        <p className="text-gray-400 mt-4">Chargement...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-white">Mes succès</h1>
        <p className="text-red-400 mt-4">Erreur : {error}</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Mes succès</h1>
        <p className="text-gray-400 text-sm mt-1">
          {unlockedCount} / {totalCount} débloqués ({progress}%)
        </p>
        <div className="w-full bg-gray-700 rounded-full h-2 mt-2 overflow-hidden">
          <div
            className="bg-nuffle-gold h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {data?.stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-white">
          <StatCard label="Matchs joués" value={data.stats.matchesPlayed} />
          <StatCard label="Victoires" value={data.stats.wins} />
          <StatCard label="Touchdowns" value={data.stats.touchdowns} />
          <StatCard label="Sorties" value={data.stats.casualties} />
        </div>
      )}

      <div className="flex gap-2">
        {(["all", "unlocked", "locked"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              filter === f
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-200 hover:bg-gray-600"
            }`}
          >
            {f === "all" ? "Tous" : f === "unlocked" ? "Débloqués" : "Verrouillés"}
          </button>
        ))}
      </div>

      {(Object.keys(CATEGORY_LABELS) as Category[]).map((cat) => {
        const items = grouped[cat];
        if (!items || items.length === 0) return null;
        return (
          <section key={cat} className="space-y-3">
            <h2 className="text-lg font-semibold text-white">
              {CATEGORY_LABELS[cat]}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((ach) => (
                <AchievementCard key={ach.slug} ach={ach} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

function AchievementCard({ ach }: { ach: AchievementView }) {
  const unlocked = ach.unlocked;
  return (
    <div
      data-testid="achievement-card"
      data-unlocked={unlocked ? "true" : "false"}
      className={`rounded-lg p-4 border transition-colors ${
        unlocked
          ? "bg-gray-800 border-nuffle-gold/60"
          : "bg-gray-900 border-gray-700 opacity-60"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="text-3xl leading-none" aria-hidden>
          {unlocked ? ach.icon : "🔒"}
        </div>
        <div className="min-w-0">
          <div
            className={`font-semibold truncate ${
              unlocked ? "text-white" : "text-gray-400"
            }`}
          >
            {ach.nameFr}
          </div>
          <div className="text-sm text-gray-400">{ach.descriptionFr}</div>
          {unlocked && ach.unlockedAt && (
            <div className="text-xs text-nuffle-gold mt-1">
              Débloqué le {formatDate(ach.unlockedAt)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
