"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiRequest } from "../../../../lib/api-client";
import TeamRosterPanel, {
  type RosterPlayer,
  type RosterTeam,
} from "../../../../components/TeamRosterPanel";

// Page roster d'un participant de la ligue (lecture seule). Accessible à
// tout coach inscrit à la ligue via la route serveur
// `/leagues/:leagueId/teams/:teamId/roster-view`. La mise en page est
// partagée avec la fiche de roster d'une coupe (`TeamRosterPanel`).

interface RosterResponse {
  team: RosterTeam;
  players: RosterPlayer[];
  /**
   * Vrai quand le viewer est le commissaire de la ligue : il peut alors
   * retirer un joueur MORT du roster (retrait doux, sans licenciement).
   * Optionnel : rétro-compat API.
   */
  viewerIsCommissioner?: boolean;
}

export default function LeagueTeamRosterPage() {
  const params = useParams();
  const leagueId = typeof params.id === "string" ? params.id : "";
  const teamId = typeof params.teamId === "string" ? params.teamId : "";

  const [data, setData] = useState<RosterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Incrémenté après un retrait de joueur mort pour recharger le roster.
  const [refreshKey, setRefreshKey] = useState(0);
  const [removingPlayerId, setRemovingPlayerId] = useState<string | null>(null);

  useEffect(() => {
    if (!leagueId || !teamId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiRequest<RosterResponse>(
      `/leagues/${leagueId}/teams/${teamId}/roster-view`,
    )
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erreur");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leagueId, teamId, refreshKey]);

  /**
   * Retire un joueur MORT du roster (commissaire uniquement). Retrait
   * doux côté serveur : la fiche, la provenance de la mort et
   * l'historique sont conservés — aucun licenciement n'est enregistré.
   */
  const handleRemoveDeadPlayer = async (player: RosterPlayer) => {
    if (
      !window.confirm(
        `Retirer ${player.name} (mort) du roster ? Sa fiche et son historique sont conservés.`,
      )
    ) {
      return;
    }
    setRemovingPlayerId(player.id);
    try {
      await apiRequest(
        `/leagues/${leagueId}/teams/${teamId}/players/${player.id}`,
        { method: "DELETE" },
      );
      setRefreshKey((k) => k + 1);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Impossible de retirer ce joueur");
    } finally {
      setRemovingPlayerId(null);
    }
  };

  return (
    // Le roster affiche 17 colonnes (stats + blessures + dispo) : sur une
    // largeur de 4xl la fin du tableau ("Blessures", "Dispo") sortait du
    // cadre et n'etait atteignable qu'en scrollant horizontalement. On
    // ouvre la page au 7xl pour tout afficher d'un coup sur desktop ; le
    // scroll horizontal reste le filet de securite en dessous.
    <main className="mx-auto max-w-7xl px-4 py-6">
      <Link
        href={`/leagues/${leagueId}`}
        className="text-sm text-nuffle-bronze hover:underline"
      >
        ← Retour à la ligue
      </Link>

      {loading ? (
        <p className="mt-6 text-sm text-gray-500">Chargement du roster…</p>
      ) : error ? (
        <p
          data-testid="league-roster-error"
          className="mt-6 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      ) : data ? (
        <TeamRosterPanel
          testId="league-roster-page"
          team={data.team}
          players={data.players}
          canRemoveDead={data.viewerIsCommissioner === true}
          removingPlayerId={removingPlayerId}
          onRemoveDeadPlayer={(p) => void handleRemoveDeadPlayer(p)}
        />
      ) : null}
    </main>
  );
}
