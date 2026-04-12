"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8201";

const PAGE_SIZE = 20;

interface LeaderboardEntry {
  rank: number;
  userId: string;
  coachName: string;
  eloRating: number;
}

interface LeaderboardMeta {
  total: number;
  limit: number;
  offset: number;
}

export default function LeaderboardPage() {
  const { t } = useLanguage();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [meta, setMeta] = useState<LeaderboardMeta>({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          `${API_BASE}/leaderboard?limit=${PAGE_SIZE}&offset=${offset}`,
        );
        if (!response.ok) {
          throw new Error("Erreur lors du chargement du classement");
        }
        const json = await response.json();
        setEntries(json.data);
        setMeta(json.meta);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Erreur inconnue",
        );
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  }, [offset]);

  const totalPages = Math.max(1, Math.ceil(meta.total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const isFirstPage = offset === 0;
  const isLastPage = offset + PAGE_SIZE >= meta.total;

  const topRating =
    entries.length > 0
      ? Math.max(...entries.map((e) => e.eloRating))
      : 0;
  const averageRating =
    entries.length > 0
      ? Math.round(
          entries.reduce((sum, e) => sum + e.eloRating, 0) / entries.length,
        )
      : 0;

  if (loading) {
    return (
      <div className="w-full p-6">
        <p>{t.common.loading}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full p-6">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div data-testid="leaderboard-page" className="w-full p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">
          {t.leaderboard.title}
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          {t.leaderboard.description}
        </p>
      </div>

      {/* Statistics cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div data-testid="leaderboard-total-players" className="bg-nuffle-gold/10 border border-nuffle-gold/30 rounded-lg p-4">
          <div className="text-sm text-nuffle-bronze font-medium">
            {t.leaderboard.totalPlayers}
          </div>
          <div className="text-2xl font-bold text-nuffle-anthracite">
            {meta.total}
          </div>
        </div>
        <div data-testid="leaderboard-top-rating" className="bg-nuffle-gold/10 border border-nuffle-gold/30 rounded-lg p-4">
          <div className="text-sm text-nuffle-bronze font-medium">
            {t.leaderboard.topRating}
          </div>
          <div className="text-2xl font-bold text-nuffle-anthracite">
            {topRating}
          </div>
        </div>
        <div data-testid="leaderboard-avg-rating" className="bg-nuffle-gold/10 border border-nuffle-gold/30 rounded-lg p-4">
          <div className="text-sm text-nuffle-bronze font-medium">
            {t.leaderboard.averageRating}
          </div>
          <div className="text-2xl font-bold text-nuffle-anthracite">
            {averageRating}
          </div>
        </div>
      </div>

      {/* Leaderboard table */}
      {entries.length === 0 ? (
        <div data-testid="leaderboard-empty" className="text-center py-8 text-gray-500">
          {t.leaderboard.noPlayers}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table data-testid="leaderboard-table" className="w-full border-collapse">
            <thead>
              <tr className="bg-nuffle-anthracite text-nuffle-ivory">
                <th className="px-4 py-3 text-left text-sm font-semibold w-20">
                  {t.leaderboard.rank}
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  {t.leaderboard.coach}
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold w-28">
                  {t.leaderboard.elo}
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.userId}
                  className={`border-b border-gray-200 transition-colors hover:bg-nuffle-gold/5 ${
                    entry.rank <= 3
                      ? "bg-nuffle-gold/10 font-semibold"
                      : "bg-white"
                  }`}
                >
                  <td className="px-4 py-3 text-sm">
                    {entry.rank <= 3 ? (
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-nuffle-gold text-white font-bold text-sm">
                        {entry.rank}
                      </span>
                    ) : (
                      entry.rank
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">{entry.coachName}</td>
                  <td className="px-4 py-3 text-sm text-right font-score text-lg">
                    {entry.eloRating}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {meta.total > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-4">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={isFirstPage}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isFirstPage
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-nuffle-anthracite text-nuffle-ivory hover:bg-nuffle-bronze"
            }`}
          >
            {t.leaderboard.previous}
          </button>
          <span className="text-sm text-gray-600">
            {t.leaderboard.page
              .replace("{current}", String(currentPage))
              .replace("{total}", String(totalPages))}
          </span>
          <button
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={isLastPage}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isLastPage
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-nuffle-anthracite text-nuffle-ivory hover:bg-nuffle-bronze"
            }`}
          >
            {t.leaderboard.next}
          </button>
        </div>
      )}
    </div>
  );
}
