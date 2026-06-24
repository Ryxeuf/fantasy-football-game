"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../../auth-client";
import { apiRequest } from "../../lib/api-client";
import { useLanguage } from "../../contexts/LanguageContext";
import OnboardingModal from "./_components/OnboardingModal";

type Team = {
  id: string;
  name: string;
  roster: string;
  ruleset?: string;
  format?: string;
  createdAt: string;
};

type FormatFilter = "all" | "bb11" | "sevens";

async function fetchJSON(path: string) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: token ? `Bearer ${token}` : "" },
  });
  if (!res.ok)
    throw new Error(
      (await res.json().catch(() => ({})))?.error || `Erreur ${res.status}`,
    );
  return res.json();
}

function TeamsSkeleton() {
  return (
    <div className="grid gap-3" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded border p-4 bg-white animate-pulse">
          <div className="h-5 w-2/5 bg-gray-200 rounded" />
          <div className="h-3 w-1/4 bg-gray-200 rounded mt-3" />
          <div className="h-5 w-20 bg-gray-200 rounded-full mt-3" />
        </div>
      ))}
    </div>
  );
}

export default function MyTeamsPage() {
  const { t, language } = useLanguage();
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [rosterNames, setRosterNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("all");
  /** Lot O.B.3 — `createdAt` du user pour decider d'afficher le modal welcome. */
  const [userCreatedAt, setUserCreatedAt] = useState<string | null>(null);
  // Suppression d'équipe : équipe en attente de confirmation + état/erreur.
  const [pendingDelete, setPendingDelete] = useState<Team | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isEn = language === "en";

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiRequest(`/team/${pendingDelete.id}`, { method: "DELETE" });
      setTeams((prev) => prev.filter((team) => team.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch (e: unknown) {
      // Le message serveur nomme la compétition en cours le cas échéant.
      setDeleteError(
        e instanceof Error
          ? e.message
          : isEn
            ? "Deletion failed"
            : "Échec de la suppression",
      );
    } finally {
      setDeleting(false);
    }
  }

  const formatLabel = (format?: string): string =>
    format === "sevens"
      ? (t.teams.formatSevens ?? "Blood Bowl à Sept")
      : (t.teams.formatBB11 ?? "Blood Bowl à 11");

  const visibleTeams =
    formatFilter === "all"
      ? teams
      : teams.filter((team) => (team.format ?? "bb11") === formatFilter);

  useEffect(() => {
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const lang = language === "en" ? "en" : "fr";
        const API_BASE_PUBLIC =
          process.env.NEXT_PUBLIC_API_BASE ||
          process.env.NEXT_PUBLIC_API_URL ||
          "http://localhost:8201";

        // Fire all three requests in parallel. The rosters endpoint is
        // public, so no auth guard is needed before kicking it off.
        const [me, mine, rostersResponse] = await Promise.all([
          fetchJSON("/auth/me"),
          apiRequest<{ teams: Team[] }>("/team/mine").catch((err) => {
            // Surface auth errors through the me check below, swallow here.
            return { teams: [] as Team[], _err: err };
          }),
          fetch(`${API_BASE_PUBLIC}/api/rosters?lang=${lang}`).catch(
            () => null,
          ),
        ]);

        if (!me?.user) {
          router.push("/login");
          return;
        }

        // Lot O.B.3 — `createdAt` est expose par /auth/me (cf. auth.ts).
        if (typeof me.user.createdAt === "string") {
          setUserCreatedAt(me.user.createdAt);
        }
        setTeams(mine?.teams ?? []);

        if (rostersResponse && rostersResponse.ok) {
          const rostersData = await rostersResponse.json();
          const namesMap: Record<string, string> = {};
          rostersData.rosters.forEach(
            (r: { slug: string; name: string }) => {
              namesMap[r.slug] = r.name;
            },
          );
          setRosterNames(namesMap);
        }
      } catch (e: any) {
        setError(e?.message || t.teams.error);
      } finally {
        setLoading(false);
      }
    })();
  }, [t, language, router]);

  return (
    <div className="w-full p-4 sm:p-6 space-y-4 sm:space-y-6">
      {!loading && (
        <OnboardingModal
          userCreatedAt={userCreatedAt}
          teamsCount={teams.length}
        />
      )}
      <h1 className="text-xl sm:text-2xl font-bold">{t.teams.title}</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {loading && <TeamsSkeleton />}
      {!loading && teams.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gray-500">{t.teams.rulesetInfoList}</p>
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <span>{t.teams.formatLabel ?? "Format"}</span>
            <select
              data-testid="teams-format-filter"
              className="min-h-[36px] border border-gray-300 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value as FormatFilter)}
            >
              <option value="all">{t.common?.all ?? "Tous"}</option>
              <option value="bb11">{t.teams.formatBB11 ?? "Blood Bowl à 11"}</option>
              <option value="sevens">{t.teams.formatSevens ?? "Blood Bowl à Sept"}</option>
            </select>
          </label>
        </div>
      )}

      {/* Liste des équipes existantes */}
      {!loading && teams.length > 0 && (
        <div className="grid gap-3">
          {visibleTeams.map((team) => (
            <div key={team.id} className="relative">
              <a
                className="block rounded border p-4 pr-12 bg-white hover:shadow transition-shadow active:scale-[0.98]"
                href={`/me/teams/${team.id}`}
              >
                <div className="font-semibold text-base sm:text-lg">{team.name}</div>
                <div className="text-xs sm:text-sm text-gray-600 mt-1">
                  {t.teams.roster}: {rosterNames[team.roster] || team.roster}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5">
                    {t.teams.rulesetBadge.replace(
                      "{label}",
                      team.ruleset === "season_3" ? t.teams.rulesetSeason3 : t.teams.rulesetSeason2,
                    )}
                  </span>
                  <span
                    data-testid="team-format-badge"
                    className={`inline-flex items-center gap-1 rounded-full text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 ${
                      (team.format ?? "bb11") === "sevens"
                        ? "bg-purple-50 text-purple-700"
                        : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    {formatLabel(team.format)}
                  </span>
                </div>
              </a>
              <button
                type="button"
                data-testid={`delete-team-${team.id}`}
                aria-label={isEn ? "Delete team" : "Supprimer l'équipe"}
                title={isEn ? "Delete team" : "Supprimer l'équipe"}
                onClick={() => {
                  setDeleteError(null);
                  setPendingDelete(team);
                }}
                className="absolute top-3 right-3 inline-flex items-center justify-center min-h-[36px] min-w-[36px] rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* Modal de confirmation de suppression */}
      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => !deleting && setPendingDelete(null)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">
              {isEn ? "Delete this team?" : "Supprimer cette équipe ?"}
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {isEn
                ? "This removes "
                : "Cette action retire "}
              <span className="font-medium">{pendingDelete.name}</span>
              {isEn
                ? " from your list. Its history in finished competitions is kept."
                : " de ta liste. Son historique dans les compétitions terminées est conservé."}
            </p>
            {deleteError && (
              <p
                data-testid="delete-team-error"
                className="mt-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700"
              >
                {deleteError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setPendingDelete(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                {isEn ? "Cancel" : "Annuler"}
              </button>
              <button
                type="button"
                data-testid="delete-team-confirm"
                disabled={deleting}
                onClick={confirmDelete}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deleting
                  ? isEn
                    ? "Deleting…"
                    : "Suppression…"
                  : isEn
                    ? "Delete"
                    : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bloc de création d'équipe */}
      <div className="rounded border p-4 sm:p-6 bg-white">
        <p className="mb-4 text-sm sm:text-base">{t.teams.createNewTeamMessage}</p>
        <a
          className="inline-block w-full sm:w-auto px-4 py-2.5 bg-emerald-600 text-white rounded text-center hover:bg-emerald-700 transition-colors font-medium"
          href="/me/teams/new"
        >
          {t.teams.openBuilder}
        </a>
      </div>
    </div>
  );
}
