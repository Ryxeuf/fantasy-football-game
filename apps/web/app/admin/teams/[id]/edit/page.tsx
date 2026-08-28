"use client";

/**
 * Édition admin d'une équipe — `/admin/teams/[id]/edit`.
 *
 * La console admin n'offrait qu'une fiche en lecture seule : impossible de
 * corriger une composition, un recrutement de Star Player ou un staff mal
 * saisi sans passer par le compte du coach. Cette page ouvre les trois blocs
 * demandés, sur les MÊMES endpoints que la page d'édition du coach — le
 * serveur y reconnaît désormais l'admin (`services/team-edit-access`) :
 *
 *  1. **Positions** — `PUT /team/:id/roster` (état cible complet, une
 *     transaction) ;
 *  2. **Star Players** — le composant du coach, qui appelle déjà
 *     `POST`/`DELETE /team/:id/star-players` ;
 *  3. **Coups de pouce** — `PUT /team/:id/info` via `TeamInfoEditor`.
 *
 * Un admin travaille sur l'équipe d'autrui : la page le rappelle en tête, et
 * chaque mutation est journalisée côté serveur (`TeamAuditEvent`, acteur
 * `admin`) — le lien vers le journal est donc à portée de clic.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { apiRequest } from "../../../../lib/api-client";
import TeamInfoEditor from "../../../../me/teams/components/TeamInfoEditor";
import TeamStarPlayersEditor from "../../../../me/teams/[id]/edit/TeamStarPlayersEditor";
import PositionsEditor from "./PositionsEditor";
import {
  buildSavePayload,
  draftSignature,
  toDraft,
  validateDraft,
  type AvailablePosition,
  type DraftPlayer,
  type LoadedPlayer,
} from "./roster-positions";

interface EditableTeam {
  readonly id: string;
  readonly name: string;
  readonly roster: string;
  readonly ruleset?: string;
  readonly format?: string | null;
  readonly regionalLeague?: string | null;
  readonly initialBudget: number;
  readonly rerolls: number;
  readonly cheerleaders: number;
  readonly assistants: number;
  readonly apothecary: boolean;
  readonly dedicatedFans: number;
  readonly deletedAt?: string | null;
  readonly players: LoadedPlayer[];
  readonly starPlayers?: ReadonlyArray<{ cost: number }>;
}

interface AvailablePositionsResponse {
  readonly availablePositions: AvailablePosition[];
  readonly maxPlayers: number;
}

export default function AdminTeamEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const teamId = typeof params?.id === "string" ? params.id : "";

  const [team, setTeam] = useState<EditableTeam | null>(null);
  const [positions, setPositions] = useState<AvailablePosition[]>([]);
  const [maxPlayers, setMaxPlayers] = useState(16);
  const [players, setPlayers] = useState<DraftPlayer[]>([]);
  const [savedSignature, setSavedSignature] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    setError(null);
    try {
      const [detail, positionsData] = await Promise.all([
        apiRequest<{ team: EditableTeam }>(`/team/${teamId}`),
        apiRequest<AvailablePositionsResponse>(
          `/team/${teamId}/available-positions`,
        ),
      ]);
      const loaded = detail.team;
      const draft = toDraft(loaded.players ?? []);
      setTeam(loaded);
      setPlayers(draft);
      setSavedSignature(draftSignature(draft, loaded.name));
      setPositions(positionsData.availablePositions ?? []);
      setMaxPlayers(positionsData.maxPlayers ?? 16);
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Chargement de l'équipe impossible",
      );
      setTeam(null);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(
    () =>
      team !== null && draftSignature(players, team.name) !== savedSignature,
    [players, team, savedSignature],
  );
  const draftErrors = useMemo(() => validateDraft(players), [players]);

  // Coût des joueurs du BROUILLON (les postes sont servis en kpo). Le résumé
  // budgétaire des coups de pouce doit suivre les ajouts/retraits en cours,
  // sinon il affiche un reliquat qui contredit le panneau du dessus.
  const playersCost = useMemo(() => {
    const costByKey = new Map(positions.map((p) => [p.key, p.cost * 1000]));
    return players.reduce((sum, p) => sum + (costByKey.get(p.position) ?? 0), 0);
  }, [players, positions]);

  const handleSaveRoster = useCallback(async () => {
    if (!team) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await apiRequest(`/team/${team.id}/roster`, {
        method: "PUT",
        body: JSON.stringify(buildSavePayload(players)),
      });
      setNotice("Composition enregistrée.");
      // Rechargement complet : le serveur recalcule VE/VEA et trésorerie, et
      // attribue de vrais identifiants aux joueurs créés — garder le
      // brouillon local rendrait le prochain enregistrement incohérent.
      await load();
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Enregistrement impossible",
      );
    } finally {
      setSaving(false);
    }
  }, [team, players, load]);

  if (loading) {
    return (
      <div className="p-8 text-center" data-testid="admin-team-edit-loading">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-nuffle-gold mb-4" />
        <p className="text-gray-500">Chargement…</p>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50"
        >
          ← Retour
        </button>
        <div
          data-testid="admin-team-edit-error"
          className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700"
        >
          ⚠️ {error ?? "Équipe introuvable"}
        </div>
      </div>
    );
  }

  const starPlayersCost = (team.starPlayers ?? []).reduce(
    (sum, sp) => sum + (sp.cost ?? 0),
    0,
  );

  return (
    <div className="space-y-6" data-testid="admin-team-edit">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/admin/teams/${team.id}`}
          data-testid="admin-team-edit-back"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          ← Fiche de l&apos;équipe
        </Link>
        <Link
          href="/admin/teams"
          className="text-sm text-gray-500 hover:text-nuffle-anthracite underline underline-offset-2"
        >
          Gestion des équipes
        </Link>
      </div>

      <div>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-nuffle-anthracite mb-1">
          ✏️ {team.name}
        </h1>
        <p className="text-sm text-gray-600">
          Édition administrateur — chaque modification est journalisée.{" "}
          <Link
            href={`/me/teams/${team.id}/journal`}
            className="underline underline-offset-2"
          >
            Voir le journal
          </Link>
        </p>
      </div>

      {/* Un admin édite l'équipe de QUELQU'UN D'AUTRE, y compris pendant une
          compétition en cours : le dire évite l'édition faite par erreur. */}
      <div
        data-testid="admin-team-edit-warning"
        className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm"
      >
        ⚠️ Vous modifiez l&apos;équipe d&apos;un autre coach. Les
        verrouillages « équipe engagée » ne s&apos;appliquent pas à un
        administrateur — une équipe déjà engagée en ligue ou en coupe sera
        modifiée telle quelle.
        {team.deletedAt && (
          <div className="mt-2 font-medium">
            Cette équipe est actuellement supprimée.
          </div>
        )}
      </div>

      {error && (
        <div
          data-testid="admin-team-edit-alert"
          className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700"
        >
          ⚠️ {error}
        </div>
      )}
      {notice && (
        <div
          data-testid="admin-team-edit-notice"
          className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800"
        >
          ✅ {notice}
        </div>
      )}

      {/* 1. Positions */}
      <section className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base sm:text-lg font-semibold">
            Liste des positions
          </h2>
          <div className="flex items-center gap-3">
            {dirty && (
              <span
                data-testid="admin-roster-dirty"
                className="text-xs font-medium text-amber-700"
              >
                Modifications non enregistrées
              </span>
            )}
            <button
              type="button"
              data-testid="admin-roster-save"
              onClick={() => void handleSaveRoster()}
              disabled={saving || !dirty || draftErrors.length > 0}
              className="px-4 py-2 rounded-lg bg-nuffle-anthracite text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Enregistrement…" : "Enregistrer la composition"}
            </button>
          </div>
        </div>
        <div className="p-4 sm:p-6">
          <PositionsEditor
            positions={positions}
            players={players}
            onChange={setPlayers}
            maxPlayers={maxPlayers}
            disabled={saving}
          />
        </div>
      </section>

      {/* 2. Star Players */}
      <section className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b">
          <h2 className="text-base sm:text-lg font-semibold">Star Players</h2>
        </div>
        <div className="p-4 sm:p-6">
          <TeamStarPlayersEditor
            teamId={team.id}
            roster={team.roster}
            ruleset={team.ruleset}
            regionalLeague={team.regionalLeague ?? null}
            onChanged={() => void load()}
          />
        </div>
      </section>

      {/* 3. Coups de pouce (staff) */}
      <section className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b">
          <h2 className="text-base sm:text-lg font-semibold">
            Coups de pouce
          </h2>
        </div>
        <div className="p-4 sm:p-6">
          <TeamInfoEditor
            teamId={team.id}
            initialInfo={{
              rerolls: team.rerolls,
              cheerleaders: team.cheerleaders,
              assistants: team.assistants,
              apothecary: team.apothecary,
              dedicatedFans: team.dedicatedFans,
              roster: team.roster,
            }}
            roster={team.roster}
            format={team.format ?? null}
            initialBudgetK={team.initialBudget}
            playersCost={playersCost}
            starPlayersCost={starPlayersCost}
            onUpdate={() => void load()}
          />
        </div>
      </section>
    </div>
  );
}
