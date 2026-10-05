"use client";
/**
 * Console admin — fiche complète d'une coupe.
 *
 *   - identité, barème (résultats + actions) et taille du bracket :
 *     `PATCH /cup/:id` (ouvert aux admins, même sur une coupe archivée)
 *   - visibilité : bascule immédiate (même route, `{ isPublic }`)
 *   - statut forcé (`POST /cup/:id/status`, sans règles de transition pour
 *     un admin), archivage, suppression définitive
 *   - équipes inscrites : retrait forcé
 *
 * Responsive : sections empilées, grilles 1 → 2 → 4 colonnes, barre
 * d'enregistrement collée en bas de l'écran sur mobile.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "../../../lib/api-client";
import {
  CUP_STATUS_META,
  NumberFieldsGrid,
  Section,
  StatusBadge,
  VisibilityToggle,
  errorMessage,
  useAdminGate,
} from "../../_components/competition-admin";
import {
  CUP_ACTION_FIELDS,
  CUP_RESULT_FIELDS,
  PLAYOFF_SIZES,
  buildCupPatch,
  toCupForm,
  type AdminCupDetail,
  type CupFormState,
  type CupScoringKey,
} from "./cup-form";

const STATUS_VALUES = ["ouverte", "en_cours", "terminee", "archivee"] as const;

const PLAYOFF_LABELS: Record<number, string> = {
  0: "Aucun (classement)",
  2: "Finale (2)",
  4: "Demi-finales (4)",
  8: "Quarts (8)",
};

export default function AdminCupManagePage() {
  const router = useRouter();
  const params = useParams();
  const cupId = params.id as string;
  const isAdmin = useAdminGate();

  const [cup, setCup] = useState<AdminCupDetail | null>(null);
  const [form, setForm] = useState<CupFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { cup: data } = await apiRequest<{ cup: AdminCupDetail }>(
        `/cup/${cupId}`,
      );
      setCup(data);
      setForm(toCupForm(data));
    } catch (e: unknown) {
      setError(errorMessage(e, "Erreur de chargement"));
    } finally {
      setLoading(false);
    }
  }, [cupId]);

  useEffect(() => {
    if (isAdmin && cupId) load();
  }, [isAdmin, cupId, load]);

  const draft = useMemo(
    () => (cup && form ? buildCupPatch(cup, form) : null),
    [cup, form],
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

  const patchCup = (body: Record<string, unknown>) =>
    apiRequest(`/cup/${cupId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });

  const handleSave = () => {
    if (!draft || draft.error || !dirty) return;
    run(() => patchCup(draft.patch), "Modifications enregistrées");
  };

  const handleToggleVisibility = () => {
    if (!cup) return;
    const next = !cup.isPublic;
    run(
      () => patchCup({ isPublic: next }),
      next ? "Coupe rendue publique" : "Coupe rendue privée",
    );
  };

  const handleStatus = (status: string) => {
    if (!cup || status === cup.status) return;
    run(
      () =>
        apiRequest(`/cup/${cupId}/status`, {
          method: "POST",
          body: JSON.stringify({ status }),
        }),
      "Statut mis à jour",
    );
  };

  const handleArchive = () => {
    if (!confirm("Archiver cette coupe ? Les coachs inscrits sont notifiés.")) {
      return;
    }
    run(
      () => apiRequest(`/cup/${cupId}/archive`, { method: "POST" }),
      "Coupe archivée",
    );
  };

  const handleRemoveTeam = (teamId: string, teamName: string) => {
    if (!confirm(`Retirer l'équipe « ${teamName} » de cette coupe ?`)) return;
    run(
      () =>
        apiRequest(`/cup/${cupId}/unregister`, {
          method: "POST",
          body: JSON.stringify({ teamId, force: true }),
        }),
      `Équipe « ${teamName} » retirée`,
    );
  };

  const handleDelete = async () => {
    if (!cup) return;
    const typed = prompt(
      `Suppression DÉFINITIVE : inscriptions, rondes et résultats seront perdus.\nTapez le nom de la coupe pour confirmer :\n${cup.name}`,
    );
    if (typed === null) return;
    if (typed.trim() !== cup.name) {
      setError("Nom saisi incorrect : suppression annulée");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/cup/${cupId}`, { method: "DELETE" });
      router.push("/admin/cups");
    } catch (e: unknown) {
      setError(errorMessage(e, "Échec de la suppression"));
      setBusy(false);
    }
  };

  const setScoring = (key: CupScoringKey, value: string) => {
    if (!form) return;
    setForm({ ...form, scoring: { ...form.scoring, [key]: value } });
  };

  if (!isAdmin || loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-nuffle-gold" />
      </div>
    );
  }

  if (!cup || !form) {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          ⚠️ {error ?? "Coupe introuvable"}
        </div>
        <Link
          href="/admin/cups"
          className="inline-block text-sm text-gray-600 hover:text-gray-800"
        >
          ← Retour à la liste
        </Link>
      </div>
    );
  }

  return (
    <div
      data-testid="admin-cup-manage-page"
      className="w-full max-w-4xl mx-auto space-y-4 sm:space-y-6 pb-24 sm:pb-0"
    >
      {/* En-tête */}
      <div className="space-y-2">
        <Link
          href="/admin/cups"
          className="text-sm text-gray-600 hover:text-gray-800"
        >
          ← Coupes
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-3xl font-heading font-bold text-nuffle-anthracite break-words">
              {cup.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <StatusBadge status={cup.status} meta={CUP_STATUS_META} />
              {cup.validated ? (
                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                  Inscriptions closes
                </span>
              ) : null}
              <span>{cup.format === "sevens" ? "Sevens" : "BB11"}</span>
              <span>·</span>
              <span>
                {cup.ruleset === "season_2" ? "Saison 2" : "Saison 3"}
              </span>
              <span>·</span>
              <span className="break-all">
                Créée par {cup.creator.coachName ?? "—"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <VisibilityToggle
              isPublic={cup.isPublic}
              onToggle={handleToggleVisibility}
              disabled={busy}
              testId="admin-cup-visibility"
            />
            <Link
              href={`/cups/${cup.id}`}
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
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_14rem] gap-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-700">Nom</span>
            <input
              data-testid="admin-cup-name"
              type="text"
              maxLength={100}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-700">Play-offs</span>
            <select
              data-testid="admin-cup-playoff-size"
              value={form.playoffSize}
              onChange={(e) =>
                setForm({ ...form, playoffSize: Number(e.target.value) })
              }
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              {PLAYOFF_SIZES.map((n) => (
                <option key={n} value={n}>
                  {PLAYOFF_LABELS[n]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-gray-700">Description</span>
          <textarea
            data-testid="admin-cup-description"
            rows={3}
            maxLength={1000}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
      </Section>

      <Section
        title="Barème"
        description="Le classement est dérivé des matchs : un barème modifié s'applique dès le prochain affichage, y compris en cours de coupe."
      >
        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Résultats
            </h3>
            <NumberFieldsGrid
              fields={CUP_RESULT_FIELDS}
              values={form.scoring}
              onChange={setScoring}
              testIdPrefix="admin-cup-scoring"
            />
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Actions
            </h3>
            <NumberFieldsGrid
              fields={CUP_ACTION_FIELDS}
              values={form.scoring}
              onChange={setScoring}
              testIdPrefix="admin-cup-scoring"
            />
          </div>
        </div>
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
          data-testid="admin-cup-save"
          onClick={handleSave}
          disabled={busy || !dirty || !!draft?.error}
          className="w-full sm:w-auto min-h-[44px] px-5 py-2 rounded-lg bg-nuffle-gold text-white font-medium hover:bg-nuffle-gold/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "Enregistrement…" : "Enregistrer les modifications"}
        </button>
        {dirty ? (
          <button
            type="button"
            onClick={() => setForm(toCupForm(cup))}
            disabled={busy}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-lg text-sm text-gray-600 hover:text-gray-800"
          >
            Annuler
          </button>
        ) : null}
      </div>

      <Section
        title="Statut"
        description="En tant qu'administrateur, le statut se force sans règles de transition."
      >
        <select
          data-testid="admin-cup-status"
          aria-label="Statut de la coupe"
          value={cup.status}
          disabled={busy}
          onChange={(e) => handleStatus(e.target.value)}
          className="block w-full sm:w-64 min-h-[40px] rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
        >
          {STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {CUP_STATUS_META[s]?.label ?? s}
            </option>
          ))}
        </select>
      </Section>

      <Section title={`Équipes inscrites (${cup.participants.length})`}>
        {cup.participants.length === 0 ? (
          <p className="text-sm text-gray-500">
            Aucune équipe inscrite pour le moment.
          </p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cup.participants.map((p) => (
              <li
                key={p.id}
                data-testid={`admin-cup-participant-${p.id}`}
                className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex flex-col gap-2"
              >
                <div className="min-w-0">
                  <Link
                    href={`/admin/teams/${p.id}`}
                    data-testid={`admin-cup-team-link-${p.id}`}
                    className="font-medium text-blue-700 hover:underline break-words"
                  >
                    {p.name}
                  </Link>
                  <div className="text-xs text-gray-500 break-words">
                    {p.roster} · {p.owner.coachName ?? "—"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveTeam(p.id, p.name)}
                  disabled={busy}
                  className="mt-auto min-h-[36px] w-full px-3 py-1.5 bg-red-100 text-red-700 rounded text-xs font-medium hover:bg-red-200 disabled:opacity-50"
                >
                  Retirer l&apos;équipe
                </button>
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
          {cup.status !== "archivee" ? (
            <button
              type="button"
              data-testid="admin-cup-archive"
              onClick={handleArchive}
              disabled={busy}
              className="min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              📦 Archiver
            </button>
          ) : null}
          <button
            type="button"
            data-testid="admin-cup-delete"
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
