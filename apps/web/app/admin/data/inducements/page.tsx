"use client";

/**
 * Console admin — catalogue des Coups de Pouce (lot 6.1).
 *
 * Prix, plafonds, remises et conditions d'achat vivaient dans le code : les
 * corriger demandait un déploiement. Ils sont maintenant éditables ici et
 * servis au match en ligne, au match local ET à la feuille de ligue.
 *
 * Le slug est un contrat de code : une ligne dont le slug n'est pas câblé
 * dans le moteur se paie et s'affiche, mais n'a AUCUN effet en match. La
 * liste le signale explicitement plutôt que de le laisser deviner.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../../auth-client";
import { RULESET_OPTIONS, type Ruleset } from "../ruleset-utils";

interface InducementRow {
  id: string;
  slug: string;
  ruleset: Ruleset;
  nameFr: string;
  nameEn: string;
  descriptionFr: string;
  descriptionEn?: string | null;
  baseCost: number;
  maxQuantity: number;
  discountRule?: string | null;
  discountRoster?: string | null;
  discountCost?: number | null;
  ruleMaxRule?: string | null;
  ruleMaxQuantity?: number | null;
  requiresAnyRule?: string | null;
  requiresRoster?: string | null;
  requiresApothecary?: boolean;
  variableCost?: boolean;
  enabled?: boolean;
  sortOrder?: number;
  /** `false` = slug inconnu du moteur ⇒ libellé payant, sans effet en match. */
  wired?: boolean;
}

type Draft = Omit<InducementRow, "id" | "wired">;

function emptyDraft(): Draft {
  return {
    slug: "",
    ruleset: "season_3",
    nameFr: "",
    nameEn: "",
    descriptionFr: "",
    descriptionEn: "",
    baseCost: 0,
    maxQuantity: 1,
    discountRule: "",
    discountRoster: "",
    discountCost: null,
    ruleMaxRule: "",
    ruleMaxQuantity: null,
    requiresAnyRule: "",
    requiresRoster: "",
    requiresApothecary: false,
    variableCost: false,
    enabled: true,
    sortOrder: 0,
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
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Erreur ${res.status}`);
  }
  return res.json();
}

/** Champ vide ⇒ `null` : la colonne est nullable, pas une chaîne vide. */
function orNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export default function AdminInducementsPage() {
  const [rows, setRows] = useState<InducementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rulesetFilter, setRulesetFilter] = useState<string>("");
  const [editing, setEditing] = useState<InducementRow | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { inducements } = await request("/admin/data/inducements");
      setRows(Array.isArray(inducements) ? inducements : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, []);

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

  const startEdit = (row: InducementRow) => {
    setEditing(row);
    setDraft({ ...emptyDraft(), ...row });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = {
        nameFr: draft.nameFr,
        nameEn: draft.nameEn,
        descriptionFr: draft.descriptionFr,
        descriptionEn: orNull(draft.descriptionEn),
        baseCost: Number(draft.baseCost),
        maxQuantity: Number(draft.maxQuantity),
        discountRule: orNull(draft.discountRule),
        discountRoster: orNull(draft.discountRoster),
        discountCost:
          draft.discountCost === null || draft.discountCost === undefined
            ? null
            : Number(draft.discountCost),
        ruleMaxRule: orNull(draft.ruleMaxRule),
        ruleMaxQuantity:
          draft.ruleMaxQuantity === null || draft.ruleMaxQuantity === undefined
            ? null
            : Number(draft.ruleMaxQuantity),
        requiresAnyRule: orNull(draft.requiresAnyRule),
        requiresRoster: orNull(draft.requiresRoster),
        requiresApothecary: Boolean(draft.requiresApothecary),
        variableCost: Boolean(draft.variableCost),
        enabled: draft.enabled !== false,
        sortOrder: Number(draft.sortOrder ?? 0),
      };
      if (editing) {
        await request(`/admin/data/inducements/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setNotice(`« ${draft.nameFr} » enregistré.`);
      } else {
        await request("/admin/data/inducements", {
          method: "POST",
          body: JSON.stringify({
            ...payload,
            slug: draft.slug.trim(),
            ruleset: draft.ruleset,
          }),
        });
        setNotice(`« ${draft.nameFr} » créé.`);
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

  const reset = async () => {
    if (
      !window.confirm(
        "Réécrire TOUT le catalogue depuis le moteur ? Les prix édités ici seront perdus.",
      )
    )
      return;
    setError(null);
    setNotice(null);
    try {
      await request("/admin/data/inducements/reset", { method: "POST" });
      setNotice("Catalogue réinitialisé depuis le moteur.");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  };

  const field = (
    label: string,
    key: keyof Draft,
    type: "text" | "number" = "text",
    hint?: string,
  ) => (
    <label className="text-sm">
      <span className="block text-gray-600 mb-1">{label}</span>
      <input
        type={type}
        data-testid={`admin-inducements-${String(key)}`}
        value={(draft[key] as string | number | null) ?? ""}
        onChange={(e) =>
          setDraft({
            ...draft,
            [key]:
              type === "number"
                ? e.target.value === ""
                  ? null
                  : Number(e.target.value)
                : e.target.value,
          })
        }
        className="w-full border border-gray-300 rounded-lg px-3 py-2"
      />
      {hint && <span className="block text-xs text-gray-500 mt-1">{hint}</span>}
    </label>
  );

  return (
    <div className="space-y-6" data-testid="admin-inducements">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite mb-1">
            💰 Coups de pouce
          </h1>
          <p className="text-sm text-gray-600">
            Prix, plafonds, remises et conditions d'achat — servis au match en
            ligne, au match local et à la feuille de ligue.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={startCreate}
            data-testid="admin-inducements-new"
            className="px-5 py-2.5 bg-nuffle-gold text-white rounded-lg font-medium"
          >
            + Nouveau coup de pouce
          </button>
          <button
            onClick={reset}
            data-testid="admin-inducements-reset"
            className="px-5 py-2.5 border border-gray-300 rounded-lg font-medium"
          >
            Réinitialiser depuis le moteur
          </button>
        </div>
      </div>

      {error && (
        <div
          data-testid="admin-inducements-error"
          className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700"
        >
          ⚠️ {error}
        </div>
      )}
      {notice && (
        <div
          data-testid="admin-inducements-notice"
          className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800"
        >
          ✅ {notice}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 space-y-4">
        <h2 className="font-heading font-semibold text-lg">
          {editing ? `Modifier « ${editing.slug} »` : "Nouveau coup de pouce"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">Slug</span>
            <input
              value={draft.slug}
              data-testid="admin-inducements-slug"
              disabled={editing !== null}
              onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
              placeholder="bribe"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-100"
            />
            <span className="block text-xs text-gray-500 mt-1">
              Contrat de code : seuls les slugs câblés dans le moteur ont un
              effet en match.
            </span>
          </label>
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">Édition</span>
            <select
              value={draft.ruleset}
              data-testid="admin-inducements-ruleset"
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
          {field("Nom (FR)", "nameFr")}
          {field("Nom (EN)", "nameEn")}
          {field("Coût de base (po)", "baseCost", "number")}
          {field("Quantité max", "maxQuantity", "number")}
          {field(
            "Remise — règle",
            "discountRule",
            "text",
            "Slug de règle spéciale ou de Ligue (ex. chantage_et_corruption).",
          )}
          {field("Remise — roster", "discountRoster", "text", "Ex. halfling.")}
          {field("Coût remisé (po)", "discountCost", "number")}
          {field("Plafond majoré — règle", "ruleMaxRule")}
          {field("Plafond majoré — quantité", "ruleMaxQuantity", "number")}
          {field(
            "Requiert une de ces règles",
            "requiresAnyRule",
            "text",
            "CSV de slugs : au moins une doit être portée par l'équipe.",
          )}
          {field("Requiert ce roster", "requiresRoster")}
          {field("Ordre d'affichage", "sortOrder", "number")}
          <label className="text-sm sm:col-span-2">
            <span className="block text-gray-600 mb-1">Description (FR)</span>
            <textarea
              value={draft.descriptionFr}
              data-testid="admin-inducements-descriptionFr"
              rows={3}
              onChange={(e) =>
                setDraft({ ...draft, descriptionFr: e.target.value })
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="block text-gray-600 mb-1">Description (EN)</span>
            <textarea
              value={draft.descriptionEn ?? ""}
              data-testid="admin-inducements-descriptionEn"
              rows={3}
              onChange={(e) =>
                setDraft({ ...draft, descriptionEn: e.target.value })
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              data-testid="admin-inducements-requiresApothecary"
              checked={Boolean(draft.requiresApothecary)}
              onChange={(e) =>
                setDraft({ ...draft, requiresApothecary: e.target.checked })
              }
            />
            Requiert l'accès à l'apothicaire
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              data-testid="admin-inducements-variableCost"
              checked={Boolean(draft.variableCost)}
              onChange={(e) =>
                setDraft({ ...draft, variableCost: e.target.checked })
              }
            />
            Coût saisi par le coach (prix variable)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              data-testid="admin-inducements-enabled"
              checked={draft.enabled !== false}
              onChange={(e) =>
                setDraft({ ...draft, enabled: e.target.checked })
              }
            />
            Proposé aux coachs
          </label>
        </div>
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving}
            data-testid="admin-inducements-save"
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
            data-testid="admin-inducements-filter"
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
            catalogue officiel.
          </p>
        ) : (
          <ul className="divide-y">
            {visible.map((row) => (
              <li
                key={row.id}
                data-testid={`admin-inducements-row-${row.slug}-${row.ruleset}`}
                className="py-3 flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="font-medium">
                    {row.nameFr}{" "}
                    <span className="text-gray-400 text-xs">
                      ({row.slug} · {row.ruleset})
                    </span>
                    {row.enabled === false && (
                      <span className="ml-2 text-xs text-gray-500">
                        — désactivé
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    {(row.baseCost / 1000).toLocaleString()} k po · 0-
                    {row.maxQuantity}
                    {row.discountCost != null &&
                      ` · remise ${(row.discountCost / 1000).toLocaleString()} k po`}
                  </p>
                  {row.wired === false && (
                    <p className="text-xs text-amber-700 mt-1">
                      ⚠️ Slug inconnu du moteur : ce coup de pouce se paie et
                      s'affiche, mais n'a aucun effet en match.
                    </p>
                  )}
                </div>
                <button
                  onClick={() => startEdit(row)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg shrink-0"
                >
                  Modifier
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
