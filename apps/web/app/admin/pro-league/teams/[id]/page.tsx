"use client";

/**
 * Admin Pro League — edition branding d'une team.
 *
 * Form controle avec preview live des couleurs. PATCH partiel : seuls
 * les champs modifies sont envoyes au server. Reset bouton restaure les
 * valeurs serveur. Audit log strict cote API.
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { API_BASE } from "../../../../auth-client";

interface ProTeamDetail {
  readonly id: string;
  readonly leagueId: string;
  readonly slug: string;
  readonly city: string;
  readonly name: string;
  readonly race: string;
  readonly nflFlavor: string | null;
  readonly primaryColor: string | null;
  readonly secondaryColor: string | null;
  readonly motto: string | null;
  readonly headline: string | null;
  readonly baseTv: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface FormState {
  city: string;
  name: string;
  nflFlavor: string;
  primaryColor: string;
  secondaryColor: string;
  motto: string;
  headline: string;
}

const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_PRIMARY = "#1f2937";
const DEFAULT_SECONDARY = "#9ca3af";

async function fetchJSON(path: string, options?: RequestInit) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error || `Erreur ${res.status}`);
  }
  return json;
}

function teamToForm(team: ProTeamDetail): FormState {
  return {
    city: team.city,
    name: team.name,
    nflFlavor: team.nflFlavor ?? "",
    primaryColor: team.primaryColor ?? "",
    secondaryColor: team.secondaryColor ?? "",
    motto: team.motto ?? "",
    headline: team.headline ?? "",
  };
}

/** Construit le diff form vs team. Renvoie les champs touches uniquement.
 *  Pour les optionnels (nflFlavor, primaryColor, ...), une chaine vide
 *  envoie `null` pour effacer. Pour city/name (required), chaine vide
 *  est ignoree (validation cote API). */
function buildPatch(
  form: FormState,
  team: ProTeamDetail,
): Record<string, string | null> {
  const patch: Record<string, string | null> = {};

  if (form.city.trim() && form.city !== team.city) {
    patch.city = form.city.trim();
  }
  if (form.name.trim() && form.name !== team.name) {
    patch.name = form.name.trim();
  }

  const nullableFields: Array<{
    key: keyof FormState;
    apiKey: string;
    serverValue: string | null;
  }> = [
    { key: "nflFlavor", apiKey: "nflFlavor", serverValue: team.nflFlavor },
    {
      key: "primaryColor",
      apiKey: "primaryColor",
      serverValue: team.primaryColor,
    },
    {
      key: "secondaryColor",
      apiKey: "secondaryColor",
      serverValue: team.secondaryColor,
    },
    { key: "motto", apiKey: "motto", serverValue: team.motto },
    { key: "headline", apiKey: "headline", serverValue: team.headline },
  ];

  for (const f of nullableFields) {
    const formVal = form[f.key].trim();
    const serverVal = f.serverValue ?? "";
    if (formVal === serverVal) continue;
    patch[f.apiKey] = formVal === "" ? null : formVal;
  }

  return patch;
}

export default function AdminProLeagueTeamEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const teamId = params?.id;

  const [team, setTeam] = useState<ProTeamDetail | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJSON(`/admin/pro-league/teams/${teamId}`);
      setTeam(data.team);
      setForm(teamToForm(data.team));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = useMemo(
    () => (team && form ? buildPatch(form, team) : {}),
    [form, team],
  );
  const dirtyCount = Object.keys(patch).length;

  const colorErrors = useMemo(() => {
    const errs: { primary?: string; secondary?: string } = {};
    if (form?.primaryColor && !HEX_REGEX.test(form.primaryColor)) {
      errs.primary = "Format attendu : #RRGGBB";
    }
    if (form?.secondaryColor && !HEX_REGEX.test(form.secondaryColor)) {
      errs.secondary = "Format attendu : #RRGGBB";
    }
    return errs;
  }, [form?.primaryColor, form?.secondaryColor]);

  const hasErrors = Boolean(colorErrors.primary || colorErrors.secondary);

  const handleChange = (key: keyof FormState, value: string) => {
    setSuccess(null);
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleReset = () => {
    if (!team) return;
    setForm(teamToForm(team));
    setSuccess(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!team || !form || dirtyCount === 0 || hasErrors) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await fetchJSON(`/admin/pro-league/teams/${team.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setTeam(data.team);
      setForm(teamToForm(data.team));
      setSuccess("Branding mis a jour.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-sm text-gray-500" data-testid="team-loading">
        Chargement…
      </div>
    );
  }

  if (error && !team) {
    return (
      <div className="space-y-4">
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
          {error}
        </div>
        <Link
          href={"/admin/pro-league/teams" as any}
          className="text-sm text-blue-700 hover:underline"
        >
          ← Retour
        </Link>
      </div>
    );
  }

  if (!team || !form) return null;

  const previewPrimary =
    form.primaryColor && HEX_REGEX.test(form.primaryColor)
      ? form.primaryColor
      : DEFAULT_PRIMARY;
  const previewSecondary =
    form.secondaryColor && HEX_REGEX.test(form.secondaryColor)
      ? form.secondaryColor
      : DEFAULT_SECONDARY;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite">
          🎨 {team.city} {team.name}
        </h1>
        <Link
          href={"/admin/pro-league/teams" as any}
          className="text-sm text-blue-700 hover:underline"
        >
          ← Liste teams
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={handleSubmit}
          className="space-y-4 p-5 rounded-xl border bg-white border-gray-200"
          data-testid="branding-form"
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-gray-700">
                Ville
              </span>
              <input
                type="text"
                value={form.city}
                onChange={(e) => handleChange("city", e.target.value)}
                maxLength={80}
                className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm"
                data-testid="input-city"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-700">
                Nom
              </span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                maxLength={120}
                className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm"
                data-testid="input-name"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-gray-700">
              Flavor NFL
            </span>
            <input
              type="text"
              value={form.nflFlavor}
              onChange={(e) => handleChange("nflFlavor", e.target.value)}
              maxLength={120}
              placeholder="Ex: Steelers, Cowboys…"
              className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm"
              data-testid="input-nflflavor"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-gray-700">
                Couleur primaire
              </span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={
                    HEX_REGEX.test(form.primaryColor)
                      ? form.primaryColor
                      : DEFAULT_PRIMARY
                  }
                  onChange={(e) =>
                    handleChange("primaryColor", e.target.value.toUpperCase())
                  }
                  className="h-9 w-12 border border-gray-300 rounded cursor-pointer"
                  data-testid="picker-primary"
                  aria-label="Color picker primaire"
                />
                <input
                  type="text"
                  value={form.primaryColor}
                  onChange={(e) =>
                    handleChange("primaryColor", e.target.value)
                  }
                  placeholder="#RRGGBB"
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm font-mono"
                  data-testid="input-primary"
                />
              </div>
              {colorErrors.primary && (
                <span className="text-xs text-red-600">
                  {colorErrors.primary}
                </span>
              )}
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-700">
                Couleur secondaire
              </span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={
                    HEX_REGEX.test(form.secondaryColor)
                      ? form.secondaryColor
                      : DEFAULT_SECONDARY
                  }
                  onChange={(e) =>
                    handleChange(
                      "secondaryColor",
                      e.target.value.toUpperCase(),
                    )
                  }
                  className="h-9 w-12 border border-gray-300 rounded cursor-pointer"
                  data-testid="picker-secondary"
                  aria-label="Color picker secondaire"
                />
                <input
                  type="text"
                  value={form.secondaryColor}
                  onChange={(e) =>
                    handleChange("secondaryColor", e.target.value)
                  }
                  placeholder="#RRGGBB"
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm font-mono"
                  data-testid="input-secondary"
                />
              </div>
              {colorErrors.secondary && (
                <span className="text-xs text-red-600">
                  {colorErrors.secondary}
                </span>
              )}
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-gray-700">Motto</span>
            <input
              type="text"
              value={form.motto}
              onChange={(e) => handleChange("motto", e.target.value)}
              maxLength={200}
              placeholder="Ex: Block first, ask later."
              className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm"
              data-testid="input-motto"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-700">
              Headline
            </span>
            <input
              type="text"
              value={form.headline}
              onChange={(e) => handleChange("headline", e.target.value)}
              maxLength={200}
              placeholder="Phrase d'accroche broadcast"
              className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm"
              data-testid="input-headline"
            />
          </label>

          {error && (
            <div
              className="p-2 rounded bg-red-50 border border-red-200 text-xs text-red-800"
              data-testid="form-error"
            >
              {error}
            </div>
          )}

          {success && (
            <div
              className="p-2 rounded bg-green-50 border border-green-200 text-xs text-green-800"
              data-testid="form-success"
            >
              {success}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2">
            <span
              className="text-xs text-gray-500"
              data-testid="dirty-count"
            >
              {dirtyCount === 0
                ? "Aucune modification"
                : `${dirtyCount} champ${dirtyCount > 1 ? "s" : ""} modifie${dirtyCount > 1 ? "s" : ""}`}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                disabled={dirtyCount === 0 || saving}
                className="px-3 py-1.5 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                data-testid="btn-reset"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={dirtyCount === 0 || saving || hasErrors}
                className="px-4 py-1.5 rounded bg-nuffle-gold text-white text-sm font-semibold hover:bg-yellow-600 disabled:opacity-50"
                data-testid="btn-save"
              >
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </form>

        <div className="space-y-4">
          <div
            className="p-5 rounded-xl border bg-white border-gray-200"
            data-testid="preview"
          >
            <div className="text-xs font-semibold text-gray-500 mb-2">
              APERCU
            </div>
            <div
              className="rounded-lg p-4 text-white"
              style={{
                background: `linear-gradient(135deg, ${previewPrimary} 0%, ${previewSecondary} 100%)`,
              }}
            >
              <div className="text-sm opacity-80">
                {form.nflFlavor || team.race}
              </div>
              <div className="text-xl font-bold leading-tight">
                {form.city || team.city}
              </div>
              <div className="text-2xl font-heading leading-tight">
                {form.name || team.name}
              </div>
              {form.motto && (
                <div className="mt-2 text-xs italic opacity-90">
                  « {form.motto} »
                </div>
              )}
            </div>
            {form.headline && (
              <div className="mt-3 text-sm text-gray-700 italic">
                {form.headline}
              </div>
            )}
          </div>

          <div className="p-4 rounded-xl border bg-gray-50 border-gray-200 text-xs text-gray-600">
            <div>
              <strong>Slug :</strong>{" "}
              <code className="text-gray-800">{team.slug}</code> (immutable)
            </div>
            <div>
              <strong>Race :</strong> {team.race} (immutable)
            </div>
            <div>
              <strong>Base TV :</strong> {team.baseTv}
            </div>
            <div className="mt-1 text-gray-500">
              Mis a jour : {new Date(team.updatedAt).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
