"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../lib/api-client";
import { useLanguage } from "../../contexts/LanguageContext";

// Sprint Ligues v2 PR2 — modale "Inscrire une equipe a la saison".
// Charge les equipes de l'utilisateur via `/team/mine`, filtre par
// `allowedRosters` (passe par le parent depuis le detail de la ligue)
// et `ruleset`, puis appelle `POST /league/seasons/:id/join`.

interface MyTeam {
  id: string;
  name: string;
  roster: string;
  ruleset?: string;
}

interface JoinSeasonModalProps {
  open: boolean;
  onClose: () => void;
  onJoined: () => void;
  seasonId: string;
  ruleset: string;
  allowedRosters: string[] | null;
  /**
   * teamIds deja inscrits sur la saison (active OU withdrawn). Permet
   * de masquer les equipes en double dans le selecteur.
   */
  alreadyRegisteredTeamIds: string[];
}

export function JoinSeasonModal({
  open,
  onClose,
  onJoined,
  seasonId,
  ruleset,
  allowedRosters,
  alreadyRegisteredTeamIds,
}: JoinSeasonModalProps) {
  const { t } = useLanguage();
  const [teams, setTeams] = useState<MyTeam[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function loadTeams() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiRequest<{ teams: MyTeam[] }>("/team/mine");
        if (!cancelled) setTeams(data.teams ?? []);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : t.leagues.formSubmitError,
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadTeams();
    return () => {
      cancelled = true;
    };
  }, [open, t.leagues.formSubmitError]);

  const eligibleTeams = useMemo(() => {
    return teams.filter((team) => {
      if (alreadyRegisteredTeamIds.includes(team.id)) return false;
      if (team.ruleset && team.ruleset !== ruleset) return false;
      if (
        allowedRosters &&
        allowedRosters.length > 0 &&
        !allowedRosters.includes(team.roster)
      ) {
        return false;
      }
      return true;
    });
  }, [teams, alreadyRegisteredTeamIds, ruleset, allowedRosters]);

  // Selection automatique : si une seule equipe eligible, on la
  // pre-coche pour reduire les clics.
  useEffect(() => {
    if (!open) return;
    if (eligibleTeams.length === 1) {
      setSelectedTeamId(eligibleTeams[0].id);
    } else if (
      eligibleTeams.length > 0 &&
      !eligibleTeams.some((team) => team.id === selectedTeamId)
    ) {
      setSelectedTeamId("");
    }
  }, [open, eligibleTeams, selectedTeamId]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting || !selectedTeamId) return;
      setSubmitting(true);
      setError(null);
      try {
        await apiRequest(`/league/seasons/${seasonId}/join`, {
          method: "POST",
          body: JSON.stringify({ teamId: selectedTeamId }),
        });
        onJoined();
        onClose();
      } catch (e: unknown) {
        setError(
          e instanceof Error ? e.message : t.leagues.formSubmitError,
        );
      } finally {
        setSubmitting(false);
      }
    },
    [
      seasonId,
      selectedTeamId,
      submitting,
      onJoined,
      onClose,
      t.leagues.formSubmitError,
    ],
  );

  if (!open) return null;

  return (
    <div
      data-testid="join-season-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg max-w-md w-full p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-nuffle-anthracite">
          {t.leagues.joinSeasonTitle}
        </h2>

        {error ? (
          <div
            data-testid="join-season-error"
            className="rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm"
          >
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="text-sm text-gray-500">{t.common.loading}</div>
        ) : eligibleTeams.length === 0 ? (
          <div
            data-testid="join-season-empty"
            className="text-sm text-gray-700"
          >
            {t.leagues.joinSeasonNoEligibleTeam}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                {t.leagues.joinSeasonSelectLabel}
              </span>
              <select
                data-testid="join-season-team-select"
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
              >
                <option value="">—</option>
                {eligibleTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.roster})
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                data-testid="join-season-submit"
                disabled={submitting || !selectedTeamId}
                className="px-4 py-2 rounded-md bg-nuffle-gold text-white text-sm font-medium disabled:opacity-50"
              >
                {submitting
                  ? t.leagues.formSubmitting
                  : t.leagues.joinSeasonSubmit}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                {t.leagues.formCancel}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
