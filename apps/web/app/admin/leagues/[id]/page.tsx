"use client";
/**
 * Console admin — fiche complète d'une ligue.
 *
 * Un administrateur y gère une ligue sans en être le commissaire :
 *   - identité (nom, description) et capacité : `PATCH /admin/leagues/:id`
 *   - visibilité : bascule immédiate, hors verrou d'édition (règle de
 *     lecture, rien de persisté n'en dépend)
 *   - barème : même route, mais figé (409) dès qu'un match a été scoré —
 *     le champ est alors grisé et le verrou expliqué
 *   - statut forcé, archivage, suppression définitive
 *   - saisons : lecture seule (nombre d'inscrits, dates)
 *
 * Responsive : sections empilées, grilles qui passent d'une à deux/quatre
 * colonnes, barre d'enregistrement pleine largeur sur mobile.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "../../../lib/api-client";
import {
  LEAGUE_STATUS_META,
  NumberFieldsGrid,
  Section,
  StatusBadge,
  VisibilityToggle,
  errorMessage,
  useAdminGate,
} from "../../_components/competition-admin";
import {
  SCORING_FIELDS,
  buildLeaguePatch,
  toForm,
  type AdminLeagueDetail,
  type FormState,
} from "./league-form";

const STATUS_VALUES = [
  "draft",
  "open",
  "in_progress",
  "completed",
  "archived",
] as const;

const SEASON_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  scheduled: "Programmée",
  in_progress: "En cours",
  completed: "Terminée",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdminLeagueManagePage() {
  const router = useRouter();
  const params = useParams();
  const leagueId = params.id as string;
  const isAdmin = useAdminGate();

  const [league, setLeague] = useState<AdminLeagueDetail | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<AdminLeagueDetail>(
        `/admin/leagues/${leagueId}`,
      );
      setLeague(data);
      setForm(toForm(data));
    } catch (e: unknown) {
      setError(errorMessage(e, "Erreur de chargement"));
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    if (isAdmin && leagueId) load();
  }, [isAdmin, leagueId, load]);

  const draft = useMemo(
    () => (league && form ? buildLeaguePatch(league, form) : null),
    [league, form],
  );
  const dirty = !!draft && Object.keys(draft.patch).length > 0;

  const run = useCallback(
    async (action: () => Promise<unknown>, success: string) => {
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        await action();
        setNotice(success);
        await load();
      } catch (e: unknown) {
        setError(errorMessage(e, "Action impossible"));
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const handleSave = () => {
    if (!draft || draft.error || !dirty) return;
    run(
      () =>
        apiRequest(`/admin/leagues/${leagueId}`, {
          method: "PATCH",
          body: JSON.stringify(draft.patch),
        }),
      "Modifications enregistrées",
    );
  };

  const handleToggleVisibility = () => {
    if (!league) return;
    const next = !league.isPublic;
    run(
      () =>
        apiRequest(`/admin/leagues/${leagueId}`, {
          method: "PATCH",
          body: JSON.stringify({ isPublic: next }),
        }),
      next ? "Ligue rendue publique" : "Ligue rendue privée",
    );
  };

  const handleStatus = (status: string) => {
    if (!league || status === league.status) return;
    run(
      () =>
        apiRequest(`/admin/leagues/${leagueId}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }),
      "Statut mis à jour",
    );
  };

  const handleArchive = () => {
    if (!confirm("Archiver cette ligue ? Les coachs inscrits sont notifiés.")) {
      return;
    }
    run(
      () =>
        apiRequest(`/admin/leagues/${leagueId}/archive`, { method: "POST" }),
      "Ligue archivée",
    );
  };

  const handleDelete = async () => {
    if (!league) return;
    const typed = prompt(
      `Suppression DÉFINITIVE : saisons, calendrier et résultats seront perdus.\nTapez le nom de la ligue pour confirmer :\n${league.name}`,
    );
    if (typed === null) return;
    if (typed.trim() !== league.name) {
      setError("Nom saisi incorrect : suppression annulée");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/leagues/${leagueId}`, { method: "DELETE" });
      router.push("/admin/leagues");
    } catch (e: unknown) {
      setError(errorMessage(e, "Échec de la suppression"));
      setBusy(false);
    }
  };

  if (!isAdmin || loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-nuffle-gold" />
      </div>
    );
  }

  if (!league || !form) {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          ⚠️ {error ?? "Ligue introuvable"}
        </div>
        <Link
          href="/admin/leagues"
          className="inline-block text-sm text-gray-600 hover:text-gray-800"
        >
          ← Retour à la liste
        </Link>
      </div>
    );
  }

  return (
    <div
      data-testid="admin-league-manage-page"
      className="w-full max-w-4xl mx-auto space-y-4 sm:space-y-6 pb-24 sm:pb-0"
    >
      {/* En-tête */}
      <div className="space-y-2">
        <Link
          href="/admin/leagues"
          className="text-sm text-gray-600 hover:text-gray-800"
        >
          ← Console ligues
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-3xl font-heading font-bold text-nuffle-anthracite break-words">
              {league.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <StatusBadge status={league.status} meta={LEAGUE_STATUS_META} />
              <span>{league.ruleset === "season_2" ? "Saison 2" : "Saison 3"}</span>
              <span>·</span>
              <span className="break-all">
                {league.creator.coachName ?? "—"} ({league.creator.email})
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <VisibilityToggle
              isPublic={league.isPublic}
              onToggle={handleToggleVisibility}
              disabled={busy}
              testId="admin-league-visibility"
            />
            <Link
              href={`/leagues/${league.id}`}
              className="inline-flex items-center min-h-[36px] px-3 py-1.5 rounded-full border border-gray-300 bg-white text-xs font-medium hover:bg-gray-50"
            >
              👁️ Page publique
            </Link>
          </div>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
        >
          ⚠️ {error}
        </div>
      ) : null}
      {notice ? (
        <div
          role="status"
          className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm"
        >
          ✓ {notice}
        </div>
      ) : null}

      <Section title="Informations">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_10rem] gap-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-700">Nom</span>
            <input
              data-testid="admin-league-name"
              type="text"
              maxLength={100}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-700">
              Équipes max
            </span>
            <input
              data-testid="admin-league-max"
              type="number"
              inputMode="numeric"
              min={2}
              max={128}
              value={form.maxParticipants}
              onChange={(e) =>
                setForm({ ...form, maxParticipants: e.target.value })
              }
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-gray-700">Description</span>
          <textarea
            data-testid="admin-league-description"
            rows={3}
            maxLength={500}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
      </Section>

      <Section
        title="Barème"
        description={
          league.scoringLocked
            ? "🔒 Verrouillé : un match a déjà été scoré, changer les points réécrirait des résultats acquis."
            : "Points attribués par résultat. Modifiable tant qu'aucun match n'a été scoré."
        }
      >
        <NumberFieldsGrid
          fields={SCORING_FIELDS}
          values={form.scoring}
          disabled={league.scoringLocked}
          testIdPrefix="admin-league-scoring"
          onChange={(key, value) =>
            setForm({ ...form, scoring: { ...form.scoring, [key]: value } })
          }
        />
      </Section>

      {/* Barre d'enregistrement : sur mobile, collée en bas de l'écran dès
          qu'il y a une modification en attente (masquée sinon). */}
      <div
        className={`${
          dirty ? "fixed flex" : "hidden"
        } sm:static sm:flex bottom-0 inset-x-0 z-20 bg-white/95 sm:bg-transparent border-t sm:border-0 border-gray-200 p-3 sm:p-0 flex-col sm:flex-row sm:items-center gap-2 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] sm:shadow-none`}
      >
        {draft?.error ? (
          <span className="text-xs text-red-600 sm:order-2">{draft.error}</span>
        ) : null}
        <button
          type="button"
          data-testid="admin-league-save"
          onClick={handleSave}
          disabled={busy || !dirty || !!draft?.error}
          className="w-full sm:w-auto min-h-[44px] px-5 py-2 rounded-lg bg-nuffle-gold text-white font-medium hover:bg-nuffle-gold/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "Enregistrement…" : "Enregistrer les modifications"}
        </button>
        {dirty ? (
          <button
            type="button"
            onClick={() => setForm(toForm(league))}
            disabled={busy}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-lg text-sm text-gray-600 hover:text-gray-800"
          >
            Annuler
          </button>
        ) : null}
      </div>

      <Section
        title="Statut"
        description="Forçage administrateur, sans les règles de transition du commissaire."
      >
        <select
          data-testid="admin-league-status"
          aria-label="Statut de la ligue"
          value={league.status}
          disabled={busy}
          onChange={(e) => handleStatus(e.target.value)}
          className="block w-full sm:w-64 min-h-[40px] rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
        >
          {STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {LEAGUE_STATUS_META[s]?.label ?? s}
            </option>
          ))}
        </select>
      </Section>

      <Section title={`Saisons (${league.seasons.length})`}>
        {league.seasons.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune saison créée.</p>
        ) : (
          <ul className="divide-y divide-gray-100 -my-3">
            {league.seasons.map((s) => (
              <li
                key={s.id}
                data-testid={`admin-league-season-${s.id}`}
                className="py-3 space-y-2"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-gray-900 break-words">
                      #{s.seasonNumber} · {s.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDate(s.startDate)} → {formatDate(s.endDate)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="px-2 py-0.5 rounded-full bg-gray-100">
                      {SEASON_STATUS_LABELS[s.status] ?? s.status}
                    </span>
                    <span>
                      {s.participantsCount} équipe
                      {s.participantsCount > 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                {s.participants && s.participants.length > 0 ? (
                  <ul className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 gap-2">
                    {s.participants.map((p) => (
                      <li key={p.teamId}>
                        <Link
                          href={`/admin/teams/${p.teamId}`}
                          data-testid={`admin-league-team-${s.id}-${p.teamId}`}
                          className={`block h-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 hover:bg-gray-100 hover:border-gray-300 transition-colors ${
                            p.deleted || p.status !== "active" ? "opacity-60" : ""
                          }`}
                        >
                          <span
                            className={`block text-sm font-medium text-blue-700 break-words ${
                              p.deleted ? "line-through" : ""
                            }`}
                          >
                            {p.teamName}
                          </span>
                          <span className="block text-xs text-gray-500 break-words">
                            {p.roster} · {p.coachName ?? "—"}
                            {p.status !== "active" ? ` · ${p.status}` : ""}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Zone sensible"
        tone="danger"
        description="L'archivage garde l'historique ; la suppression efface tout et ne peut pas être annulée."
      >
        <div className="grid grid-cols-1 sm:flex gap-2">
          {league.status !== "archived" ? (
            <button
              type="button"
              data-testid="admin-league-archive"
              onClick={handleArchive}
              disabled={busy}
              className="min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              📦 Archiver
            </button>
          ) : null}
          <button
            type="button"
            data-testid="admin-league-delete"
            onClick={handleDelete}
            disabled={busy}
            className="min-h-[44px] px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            🗑️ Supprimer définitivement
          </button>
        </div>
      </Section>
    </div>
  );
}
