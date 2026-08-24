"use client";
/**
 * Admin — édition d'un règlement de tournoi. Recharge le serveur après
 * sauvegarde (l'admin voit ce qui a réellement été persisté). Le slug est
 * immuable ; archivage/désarchivage inline.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  getJSON,
  sendJSON,
  type TournamentRulesetDetail,
  type TournamentRulesetFormValues,
} from "../../api";
import { TournamentRulesetForm } from "../../_components/TournamentRulesetForm";

export default function EditTournamentRulesetPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [detail, setDetail] = useState<TournamentRulesetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getJSON<{ tournamentRuleset: TournamentRulesetDetail }>(
        `/admin/tournament-rulesets/${id}`,
      );
      setDetail(data.tournamentRuleset);
      setLoadError(null);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (values: TournamentRulesetFormValues) => {
    if (!id) return;
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      // Le slug est immuable : il ne fait pas partie du corps d'update.
      const { slug: _slug, ...body } = values;
      await sendJSON("PUT", `/admin/tournament-rulesets/${id}`, body);
      setSuccess(true);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors de la sauvegarde");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleArchive = async () => {
    if (!id || !detail) return;
    setArchiving(true);
    try {
      await sendJSON(
        "POST",
        `/admin/tournament-rulesets/${id}/${detail.archived ? "unarchive" : "archive"}`,
      );
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setArchiving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nuffle-gold" />
      </div>
    );
  }

  if (loadError || !detail) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {loadError ?? "Règlement introuvable"}
        </div>
        <Link
          href="/admin/data/tournament-rulesets"
          className="text-sm text-nuffle-bronze hover:underline"
        >
          ← Retour aux règlements
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/admin/data/tournament-rulesets"
            className="text-sm text-nuffle-bronze hover:underline"
          >
            ← Règlements de tournoi
          </Link>
          <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite mt-2 mb-1">
            🏆 {detail.nameFr}
          </h1>
          <p className="font-mono text-xs text-gray-600">{detail.slug}</p>
        </div>
        <div className="flex items-center gap-2">
          {detail.archived ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              Archivé
            </span>
          ) : null}
          <button
            onClick={toggleArchive}
            disabled={archiving}
            data-testid="pack-edit-archive-toggle"
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            {detail.archived ? "Désarchiver" : "Archiver"}
          </button>
        </div>
      </div>

      {detail.archived ? (
        <p className="text-xs text-purple-800 bg-purple-50 border border-purple-200 rounded p-3">
          Règlement archivé : il n&apos;est plus proposé pour de nouvelles
          équipes, ligues ou coupes. Les entités qui l&apos;utilisent déjà
          restent valides.
        </p>
      ) : null}

      {success ? (
        <div className="text-green-700 text-sm p-3 bg-green-50 border border-green-200 rounded">
          Règlement sauvegardé.
        </div>
      ) : null}

      <TournamentRulesetForm
        key={detail.id + String(detail.archived)}
        mode="edit"
        initial={detail}
        submitting={submitting}
        error={error}
        submitLabel={submitting ? "Sauvegarde…" : "Sauvegarder"}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
