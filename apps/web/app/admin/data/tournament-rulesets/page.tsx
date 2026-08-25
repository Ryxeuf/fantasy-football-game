"use client";

/**
 * Console admin — liste des règlements de tournoi.
 *
 * Chaque ligne dit d'où vient la définition servie : « base » (éditée ici) ou
 * « moteur » (encore servie par le registre du code, ligne pas encore créée).
 * Sans ce repère, un admin pourrait croire qu'il édite un règlement alors que
 * l'application sert encore la version du code.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  deleteRuleset,
  listRulesets,
  resetRuleset,
  RulesetApiError,
  type RulesetSummary,
} from "./_lib/client";

const EDITION_LABELS: Record<string, string> = {
  season_2: "Saison 2",
  season_3: "Saison 3",
};
const FORMAT_LABELS: Record<string, string> = {
  bb11: "BB à 11",
  sevens: "BB à Sept",
};

export default function TournamentRulesetsAdminPage() {
  const [rulesets, setRulesets] = useState<RulesetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { rulesets: rows } = await listRulesets();
      setRulesets(rows);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onReset = async (slug: string) => {
    if (
      !window.confirm(
        `Réinitialiser « ${slug} » depuis le registre du moteur ? Les modifications saisies seront perdues.`,
      )
    ) {
      return;
    }
    setBusy(slug);
    try {
      await resetRuleset(slug);
      setNotice(`« ${slug} » réinitialisé depuis le moteur.`);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Échec de la réinitialisation");
    } finally {
      setBusy(null);
    }
  };

  const onDelete = async (slug: string) => {
    if (!window.confirm(`Supprimer définitivement « ${slug} » ?`)) return;
    setBusy(slug);
    try {
      await deleteRuleset(slug);
      setNotice(`« ${slug} » supprimé.`);
      await load();
    } catch (e: unknown) {
      // 409 = règlement utilisé : le message porte le décompte, on l'affiche.
      setError(
        e instanceof RulesetApiError || e instanceof Error
          ? e.message
          : "Échec de la suppression",
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
            🏆 Règlements de tournoi
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Budgets par tier, barème de compétences, Star Players interdits,
            coups de pouce et classement. Un règlement s&apos;impose aux
            équipes et compétitions qui le choisissent.
          </p>
        </div>
        <Link
          href={"/admin/data/tournament-rulesets/new" as Route}
          data-testid="ruleset-new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + Nouveau règlement
        </Link>
      </div>

      {error && (
        <p
          role="alert"
          data-testid="rulesets-error"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          data-testid="rulesets-notice"
          className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-gray-500">Chargement…</p>
      ) : rulesets.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">Aucun règlement.</p>
      ) : (
        <ul className="mt-6 space-y-3" data-testid="rulesets-list">
          {rulesets.map((r) => (
            <li
              key={r.slug}
              data-testid={`ruleset-${r.slug}`}
              className="rounded-2xl border border-gray-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-gray-900">
                      {r.nameFr}
                    </h2>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                      {r.version}
                    </span>
                    {!r.enabled && (
                      <span
                        data-testid={`ruleset-disabled-${r.slug}`}
                        className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-700"
                      >
                        Désactivé
                      </span>
                    )}
                    {r.source === "engine" && (
                      <span
                        title="Servi par le registre du code : la ligne sera créée à la première édition."
                        data-testid={`ruleset-source-engine-${r.slug}`}
                        className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800"
                      >
                        Depuis le moteur
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    <code className="font-mono">{r.slug}</code> ·{" "}
                    {EDITION_LABELS[r.edition] ?? r.edition} ·{" "}
                    {FORMAT_LABELS[r.format] ?? r.format} · {r.rosterCount}{" "}
                    roster{r.rosterCount > 1 ? "s" : ""} autorisé
                    {r.rosterCount > 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={
                      `/admin/data/tournament-rulesets/${r.slug}` as Route
                    }
                    data-testid={`ruleset-edit-${r.slug}`}
                    className="rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                  >
                    Éditer
                  </Link>
                  <button
                    type="button"
                    onClick={() => onReset(r.slug)}
                    disabled={busy === r.slug}
                    data-testid={`ruleset-reset-${r.slug}`}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Réinitialiser
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(r.slug)}
                    disabled={busy === r.slug}
                    data-testid={`ruleset-delete-${r.slug}`}
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
