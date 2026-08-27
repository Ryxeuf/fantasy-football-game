"use client";

/**
 * Écran d'administration d'un catalogue de règles (lot 6.5).
 *
 * `TeamSpecialRule` et `RegionalLeague` ont exactement la même forme
 * (slug + édition + libellés FR/EN + descriptions) : un seul composant les
 * sert, monté par `/admin/data/special-rules` et `/admin/data/regional-leagues`.
 *
 * Le SLUG est un contrat de code : il est référencé par les fiches de roster,
 * par `Team.regionalLeague` et par le moteur. Il se fixe à la création et
 * n'est plus modifiable. Une ligne dont le slug est inconnu du moteur n'est
 * qu'un LIBELLÉ (aucun effet en match) : l'écran le signale explicitement.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../../auth-client";
import { RULESET_OPTIONS, type Ruleset } from "../ruleset-utils";

export interface TeamRuleRow {
  id: string;
  slug: string;
  ruleset: Ruleset;
  nameFr: string;
  nameEn: string;
  description: string;
  descriptionEn?: string | null;
  /** `false` = slug inconnu du moteur ⇒ pur libellé, sans effet en match. */
  knownToEngine?: boolean;
}

type Draft = Omit<TeamRuleRow, "id" | "knownToEngine">;

function emptyDraft(): Draft {
  return {
    slug: "",
    ruleset: RULESET_OPTIONS[RULESET_OPTIONS.length - 1].value as Ruleset,
    nameFr: "",
    nameEn: "",
    description: "",
    descriptionEn: "",
  };
}

async function request(path: string, init?: RequestInit) {
  const token =
    typeof window === "undefined" ? null : localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Erreur ${res.status}`);
  }
  return res.json();
}

export function TeamRuleCatalogueAdmin({
  title,
  subtitle,
  endpoint,
  testId,
}: {
  title: string;
  subtitle: string;
  /** Racine de l'API, ex. `/admin/data/special-rules`. */
  endpoint: string;
  testId: string;
}) {
  const [rows, setRows] = useState<TeamRuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rulesetFilter, setRulesetFilter] = useState<string>("");
  const [editing, setEditing] = useState<TeamRuleRow | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { rules } = await request(endpoint);
      setRows(Array.isArray(rules) ? rules : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => rows.filter((r) => !rulesetFilter || r.ruleset === rulesetFilter),
    [rows, rulesetFilter],
  );

  const startCreate = () => {
    setEditing(null);
    setDraft(emptyDraft());
  };

  const startEdit = (row: TeamRuleRow) => {
    setEditing(row);
    setDraft({
      slug: row.slug,
      ruleset: row.ruleset,
      nameFr: row.nameFr,
      nameEn: row.nameEn,
      description: row.description,
      descriptionEn: row.descriptionEn ?? "",
    });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = {
        nameFr: draft.nameFr,
        nameEn: draft.nameEn,
        description: draft.description,
        descriptionEn: draft.descriptionEn?.trim() ? draft.descriptionEn : null,
      };
      if (editing) {
        await request(`${endpoint}/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setNotice(`« ${draft.nameFr} » enregistrée.`);
      } else {
        await request(endpoint, {
          method: "POST",
          body: JSON.stringify({
            ...payload,
            slug: draft.slug.trim(),
            ruleset: draft.ruleset,
          }),
        });
        setNotice(`« ${draft.nameFr} » créée.`);
      }
      setEditing(null);
      setDraft(emptyDraft());
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: TeamRuleRow) => {
    if (!window.confirm(`Supprimer « ${row.nameFr} » (${row.slug}) ?`)) return;
    setError(null);
    setNotice(null);
    try {
      await request(`${endpoint}/${row.id}`, { method: "DELETE" });
      setNotice(`« ${row.nameFr} » supprimée.`);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  };

  const reset = async () => {
    if (
      !window.confirm(
        "Recréer les lignes manquantes et RÉÉCRIRE les existantes depuis le catalogue du moteur ?",
      )
    )
      return;
    setError(null);
    setNotice(null);
    try {
      await request(`${endpoint}/reset`, { method: "POST" });
      setNotice("Catalogue réinitialisé depuis le moteur.");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  };

  return (
    <div className="space-y-6" data-testid={testId}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite mb-1">
            {title}
          </h1>
          <p className="text-sm text-gray-600">{subtitle}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={startCreate}
            data-testid={`${testId}-new`}
            className="px-5 py-2.5 bg-nuffle-gold text-white rounded-lg font-medium hover:bg-nuffle-gold/90 shadow-md transition-all"
          >
            + Nouvelle entrée
          </button>
          <button
            onClick={reset}
            data-testid={`${testId}-reset`}
            className="px-5 py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-all"
          >
            Réinitialiser depuis le moteur
          </button>
        </div>
      </div>

      {error && (
        <div
          data-testid={`${testId}-error`}
          className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700"
        >
          ⚠️ {error}
        </div>
      )}
      {notice && (
        <div
          data-testid={`${testId}-notice`}
          className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800"
        >
          ✅ {notice}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 space-y-4">
        <h2 className="font-heading font-semibold text-lg">
          {editing ? `Modifier « ${editing.slug} »` : "Nouvelle entrée"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">Slug</span>
            <input
              value={draft.slug}
              data-testid={`${testId}-slug`}
              disabled={editing !== null}
              onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
              placeholder="chantage_et_corruption"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-100"
            />
            <span className="block text-xs text-gray-500 mt-1">
              Contrat de code : référencé par les fiches de roster et le
              moteur, il ne se renomme pas.
            </span>
          </label>
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">Édition</span>
            <select
              value={draft.ruleset}
              data-testid={`${testId}-ruleset`}
              disabled={editing !== null}
              onChange={(e) =>
                setDraft({ ...draft, ruleset: e.target.value as Ruleset })
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-100"
            >
              {RULESET_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">Nom (FR)</span>
            <input
              value={draft.nameFr}
              data-testid={`${testId}-nameFr`}
              onChange={(e) => setDraft({ ...draft, nameFr: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">Nom (EN)</span>
            <input
              value={draft.nameEn}
              data-testid={`${testId}-nameEn`}
              onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="block text-gray-600 mb-1">Description (FR)</span>
            <textarea
              value={draft.description}
              data-testid={`${testId}-description`}
              rows={4}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="block text-gray-600 mb-1">Description (EN)</span>
            <textarea
              value={draft.descriptionEn ?? ""}
              data-testid={`${testId}-descriptionEn`}
              rows={4}
              onChange={(e) =>
                setDraft({ ...draft, descriptionEn: e.target.value })
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </label>
        </div>
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving}
            data-testid={`${testId}-save`}
            className="px-5 py-2.5 bg-nuffle-gold text-white rounded-lg font-medium disabled:opacity-50"
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
          {editing && (
            <button
              onClick={startCreate}
              className="px-5 py-2.5 border border-gray-300 rounded-lg font-medium"
            >
              Annuler
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
        <div className="mb-4">
          <select
            value={rulesetFilter}
            data-testid={`${testId}-filter`}
            onChange={(e) => setRulesetFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2.5"
          >
            <option value="">Toutes les éditions</option>
            {RULESET_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Chargement…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-gray-500">
            Aucune entrée. « Réinitialiser depuis le moteur » amorce le
            catalogue.
          </p>
        ) : (
          <ul className="divide-y">
            {visible.map((row) => (
              <li
                key={row.id}
                data-testid={`${testId}-row-${row.slug}-${row.ruleset}`}
                className="py-3 flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="font-medium">
                    {row.nameFr}{" "}
                    <span className="text-gray-400 text-xs">
                      ({row.slug} · {row.ruleset})
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {row.description}
                  </p>
                  {row.knownToEngine === false && (
                    <p className="text-xs text-amber-700 mt-1">
                      ⚠️ Slug inconnu du moteur : ce libellé s'affiche mais
                      n'a aucun effet en match.
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => startEdit(row)}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => remove(row)}
                    className="px-3 py-1.5 text-sm border border-red-300 text-red-700 rounded-lg"
                  >
                    Supprimer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
