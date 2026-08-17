"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { API_BASE } from "../../../../../auth-client";
import {
  RULESET_OPTIONS,
  type Ruleset,
} from "../../../ruleset-utils";
import { TEAM_SPECIAL_RULES, REGIONAL_LEAGUES } from "@bb/game-engine";

type GameFormat = "bb11" | "sevens";

type StaffConfig = {
  rerollCost: number;
  maxRerolls: number;
  apothecaryAllowed: boolean;
  apothecaryCost: number;
  maxCheerleaders: number;
  cheerleaderCost: number;
  maxAssistants: number;
  assistantCost: number;
  maxDedicatedFans: number;
  dedicatedFanCost: number;
};

type StaffConfigRow = StaffConfig & { format: GameFormat };

type Roster = {
  id: string;
  slug: string;
  ruleset: Ruleset;
  name: string;
  nameEn: string;
  descriptionFr?: string | null;
  descriptionEn?: string | null;
  budget: number;
  tier: string;
  regionalRules?: string[] | null;
  specialRules?: string | null;
  naf: boolean;
  staffConfigs?: StaffConfigRow[];
};

const FORMAT_LABELS: Record<GameFormat, string> = {
  bb11: "Blood Bowl à 11",
  sevens: "Blood Bowl à 7",
};

// Champs staff éditables. `bool` pour l'apothicaire autorisé, sinon montant po
// (ou plafond). L'ordre dicte l'affichage dans chaque colonne de format.
const STAFF_FIELDS: Array<{
  key: keyof StaffConfig;
  label: string;
  kind: "number" | "bool";
}> = [
  { key: "rerollCost", label: "Coût relance (po)", kind: "number" },
  { key: "maxRerolls", label: "Relances max", kind: "number" },
  { key: "apothecaryAllowed", label: "Apothicaire autorisé", kind: "bool" },
  { key: "apothecaryCost", label: "Coût apothicaire (po)", kind: "number" },
  { key: "maxCheerleaders", label: "Cheerleaders max", kind: "number" },
  { key: "cheerleaderCost", label: "Coût cheerleader (po)", kind: "number" },
  { key: "maxAssistants", label: "Coachs assistants max", kind: "number" },
  { key: "assistantCost", label: "Coût coach assistant (po)", kind: "number" },
  { key: "maxDedicatedFans", label: "Fans dévoués max", kind: "number" },
  { key: "dedicatedFanCost", label: "Coût fan dévoué (po)", kind: "number" },
];

const EMPTY_STAFF: StaffConfig = {
  rerollCost: 0,
  maxRerolls: 0,
  apothecaryAllowed: false,
  apothecaryCost: 0,
  maxCheerleaders: 0,
  cheerleaderCost: 0,
  maxAssistants: 0,
  assistantCost: 0,
  maxDedicatedFans: 0,
  dedicatedFanCost: 0,
};

function staffFromRows(rows: StaffConfigRow[] | undefined): Record<GameFormat, StaffConfig> {
  const pick = (fmt: GameFormat): StaffConfig => {
    const row = rows?.find((r) => r.format === fmt);
    if (!row) return { ...EMPTY_STAFF };
    const { format: _f, ...cfg } = row;
    return cfg;
  };
  return { bb11: pick("bb11"), sevens: pick("sevens") };
}

/** Option d'une grille de cases à cocher (catalogue de slugs). */
interface SlugOption {
  slug: string;
  label: string;
}

/** Catalogue des règles spéciales d'équipe (source game-engine). */
const SPECIAL_RULE_OPTIONS: SlugOption[] = TEAM_SPECIAL_RULES.map((r) => ({
  slug: r.slug,
  label: r.nameFr,
}));

/** Catalogue des ligues régionales (source game-engine). */
const REGIONAL_LEAGUE_OPTIONS: SlugOption[] = REGIONAL_LEAGUES.map((l) => ({
  slug: l.slug,
  label: l.nameFr,
}));

/**
 * Grille de cases à cocher sur un catalogue de slugs.
 *
 * Les slugs déjà en base mais absents du catalogue (données héritées,
 * ex. `favoured_of`) sont conservés et affichés « hors catalogue » : on
 * ne perd jamais une valeur existante à l'enregistrement.
 */
function SlugCheckboxGrid({
  catalog,
  selected,
  onToggle,
  testId,
}: {
  catalog: SlugOption[];
  selected: string[];
  onToggle: (slug: string) => void;
  testId: string;
}) {
  const knownSlugs = catalog.map((o) => o.slug);
  const options: SlugOption[] = [
    ...catalog,
    ...selected
      .filter((s) => !knownSlugs.includes(s))
      .map((s) => ({ slug: s, label: `${s} (hors catalogue)` })),
  ];
  return (
    <div
      data-testid={testId}
      className="grid grid-cols-1 sm:grid-cols-2 gap-2 border rounded px-3 py-3"
    >
      {options.map((opt) => (
        <label
          key={opt.slug}
          className="flex items-center gap-2 text-sm cursor-pointer"
        >
          <input
            type="checkbox"
            data-testid={`${testId}-${opt.slug}`}
            checked={selected.includes(opt.slug)}
            onChange={() => onToggle(opt.slug)}
          />
          <span>
            {opt.label}{" "}
            <span className="text-gray-400 text-xs">({opt.slug})</span>
          </span>
        </label>
      ))}
    </div>
  );
}

function toggleSlug(prev: string[], slug: string): string[] {
  return prev.includes(slug)
    ? prev.filter((s) => s !== slug)
    : [...prev, slug];
}

async function fetchJSON(path: string) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: token ? `Bearer ${token}` : "" },
  });
  if (!res.ok)
    throw new Error(
      (await res.json().catch(() => ({})))?.error || `Erreur ${res.status}`,
    );
  return res.json();
}

async function putJSON(path: string, data: any) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok)
    throw new Error(
      (await res.json().catch(() => ({})))?.error || `Erreur ${res.status}`,
    );
  return res.json();
}

export default function EditRosterPage() {
  const router = useRouter();
  const params = useParams();
  const rosterId = params.id as string;
  
  const [roster, setRoster] = useState<Roster | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staff, setStaff] = useState<Record<GameFormat, StaffConfig> | null>(null);
  const [savingStaff, setSavingStaff] = useState(false);
  const [staffSuccess, setStaffSuccess] = useState<string | null>(null);
  // Règles spéciales sélectionnées (slugs). Source de vérité du champ :
  // liste canonique TEAM_SPECIAL_RULES, sérialisée en CSV pour l'API.
  const [specialRules, setSpecialRules] = useState<string[]>([]);
  // Ligues régionales du roster (slugs). Même modèle de saisie que les
  // règles spéciales (cases à cocher) ; l'API attend un tableau.
  const [regionalRules, setRegionalRules] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, [rosterId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await fetchJSON("/auth/me");
      const user = me?.user;
      const roles: string[] | undefined = Array.isArray(user?.roles)
        ? user.roles
        : user?.role
          ? [user.role]
          : undefined;
      if (!roles || !roles.includes("admin")) {
        router.push("/");
        return;
      }
      const { roster: data } = await fetchJSON(`/admin/data/rosters/${rosterId}`);
      setRoster(data);
      setStaff(staffFromRows(data.staffConfigs));
      setSpecialRules(
        data.specialRules
          ? data.specialRules
              .split(",")
              .map((s: string) => s.trim())
              .filter((s: string) => s.length > 0)
          : [],
      );
      // L'API renvoie déjà un tableau (JSON parsé côté serveur) ; on
      // reste tolérant si une valeur nulle ou non-tableau remonte.
      setRegionalRules(
        Array.isArray(data.regionalRules)
          ? data.regionalRules.filter((s: unknown) => typeof s === "string")
          : [],
      );
    } catch (e: any) {
      setError(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!roster) return;
    setSaving(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      const data = {
        name: formData.get("name"),
        nameEn: formData.get("nameEn"),
        descriptionFr: formData.get("descriptionFr") || null,
        descriptionEn: formData.get("descriptionEn") || null,
        budget: parseInt(formData.get("budget") as string),
        tier: formData.get("tier"),
        // Aucune case cochée = aucune ligue (null, comme avant).
        regionalRules: regionalRules.length > 0 ? regionalRules : null,
        specialRules: specialRules.length > 0 ? specialRules.join(",") : null,
        naf: formData.get("naf") === "on",
        ruleset: formData.get("ruleset"),
      };
      await putJSON(`/admin/data/rosters/${roster.id}`, data);
      router.push("/admin/data/rosters");
    } catch (e: any) {
      setError(e.message || "Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  const setStaffField = (
    fmt: GameFormat,
    key: keyof StaffConfig,
    value: number | boolean,
  ) => {
    setStaff((prev) =>
      prev ? { ...prev, [fmt]: { ...prev[fmt], [key]: value } } : prev,
    );
  };

  const handleSaveStaff = async () => {
    if (!roster || !staff) return;
    setSavingStaff(true);
    setError(null);
    setStaffSuccess(null);
    try {
      await putJSON(`/admin/data/rosters/${roster.id}/staff-config`, staff);
      setStaffSuccess("Configuration staff enregistrée.");
    } catch (e: any) {
      setError(e.message || "Erreur lors de l'enregistrement du staff");
    } finally {
      setSavingStaff(false);
    }
  };

  if (loading) return <div>Chargement...</div>;
  if (!roster) return <div>Roster non trouvé</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Modifier un roster</h1>
        <button
          onClick={() => router.push("/admin/data/rosters")}
          className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
        >
          Annuler
        </button>
      </div>

      {error && <p className="text-red-600 text-sm mb-4 p-3 bg-red-50 border border-red-200 rounded">{error}</p>}

      <form onSubmit={handleSubmit} className="bg-white p-6 border rounded shadow-sm">
        <div className="mb-4 p-3 bg-gray-50 rounded">
          <div className="text-sm text-gray-600">
            <strong>Slug:</strong> {roster.slug}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">Ruleset *</label>
            <select
              name="ruleset"
              defaultValue={roster.ruleset}
              className="w-full border rounded px-3 py-2"
            >
              {RULESET_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nom (FR) *</label>
            <input
              type="text"
              name="name"
              defaultValue={roster.name}
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nom (EN) *</label>
            <input
              type="text"
              name="nameEn"
              defaultValue={roster.nameEn}
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Budget (kpo) *</label>
            <input
              type="number"
              name="budget"
              defaultValue={roster.budget}
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tier *</label>
            <select
              name="tier"
              defaultValue={roster.tier}
              required
              className="w-full border rounded px-3 py-2"
            >
              <option value="I">I</option>
              <option value="II">II</option>
              <option value="III">III</option>
              <option value="IV">IV</option>
            </select>
          </div>
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="naf"
                defaultChecked={roster.naf}
                className="w-5 h-5 rounded border-gray-300"
              />
              <span className="text-sm font-medium">NAF</span>
            </label>
          </div>
        </div>
        
        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">Description (FR)</label>
          <textarea
            name="descriptionFr"
            defaultValue={roster.descriptionFr || ""}
            rows={4}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        
        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">Description (EN)</label>
          <textarea
            name="descriptionEn"
            defaultValue={roster.descriptionEn || ""}
            rows={4}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        
        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">
            Ligues régionales
          </label>
          <SlugCheckboxGrid
            catalog={REGIONAL_LEAGUE_OPTIONS}
            selected={regionalRules}
            onToggle={(slug) =>
              setRegionalRules((prev) => toggleSlug(prev, slug))
            }
            testId="roster-regional-leagues"
          />
          <p className="text-xs text-gray-500 mt-1">
            Ligues auxquelles ce roster appartient. Sélection multiple ;
            aucune case cochée = aucune ligue. Conditionne le recrutement
            des Star Players et certains coups de pouce.
          </p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">Règles spéciales</label>
          <SlugCheckboxGrid
            catalog={SPECIAL_RULE_OPTIONS}
            selected={specialRules}
            onToggle={(slug) => setSpecialRules((prev) => toggleSlug(prev, slug))}
            testId="roster-special-rules"
          />
          <p className="text-xs text-gray-500 mt-1">
            Sélection multiple. Aucune case cochée = aucune règle spéciale.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Mise à jour..." : "Mettre à jour"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/data/rosters")}
            className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
          >
            Annuler
          </button>
        </div>
      </form>

      {staff && (
        <div className="bg-white p-6 border rounded shadow-sm mt-6">
          <h2 className="text-lg font-bold mb-1">Staff par format</h2>
          <p className="text-xs text-gray-500 mb-4">
            Coûts en po (ex. 50000). Saisis indépendamment pour chaque format.
          </p>

          {staffSuccess && (
            <p className="text-green-700 text-sm mb-4 p-3 bg-green-50 border border-green-200 rounded">
              {staffSuccess}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {(["bb11", "sevens"] as const).map((fmt) => (
              <div key={fmt} className="border rounded p-4">
                <h3 className="font-semibold mb-3">{FORMAT_LABELS[fmt]}</h3>
                <div className="space-y-3">
                  {STAFF_FIELDS.map((field) =>
                    field.kind === "bool" ? (
                      <label
                        key={field.key}
                        className="flex items-center gap-3 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          data-testid={`staff-${fmt}-${field.key}`}
                          checked={Boolean(staff[fmt][field.key])}
                          onChange={(e) =>
                            setStaffField(fmt, field.key, e.target.checked)
                          }
                          className="w-5 h-5 rounded border-gray-300"
                        />
                        <span className="text-sm font-medium">{field.label}</span>
                      </label>
                    ) : (
                      <div key={field.key}>
                        <label className="block text-sm font-medium mb-1">
                          {field.label}
                        </label>
                        <input
                          type="number"
                          min={0}
                          data-testid={`staff-${fmt}-${field.key}`}
                          value={Number(staff[fmt][field.key])}
                          onChange={(e) =>
                            setStaffField(
                              fmt,
                              field.key,
                              e.target.value === "" ? 0 : parseInt(e.target.value, 10),
                            )
                          }
                          className="w-full border rounded px-3 py-2"
                        />
                      </div>
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={handleSaveStaff}
              disabled={savingStaff}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingStaff ? "Enregistrement..." : "Enregistrer le staff"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

