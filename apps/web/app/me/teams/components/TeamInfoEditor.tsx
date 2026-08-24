"use client";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../../lib/api-client";
import { useLanguage } from "../../../contexts/LanguageContext";
import QuantityStepper from "./QuantityStepper";
import StaffRow from "./StaffRow";
import { computeStaffSpend } from "../staff-cost";
import {
  defaultStaffConfig,
  isGameFormat,
  type GameFormat,
  type RosterStaffConfig,
} from "@bb/game-engine";

interface TeamInfo {
  rerolls: number;
  cheerleaders: number;
  assistants: number;
  apothecary: boolean;
  dedicatedFans: number;
  roster?: string; // Roster pour calculer le coût des relances
}

interface TeamInfoEditorProps {
  teamId: string;
  initialInfo: TeamInfo;
  onUpdate: (info: TeamInfo) => void;
  disabled?: boolean;
  roster?: string;
  /** Format de l'équipe (bb11 / sevens) — pilote le fallback de config. */
  format?: string | null;
  /** Budget de construction de l'équipe, en kpo (`Team.initialBudget`). */
  initialBudgetK?: number;
  /** Coût des joueurs engagés, en po. */
  playersCost?: number;
  /** Coût des Star Players recrutés, en po. */
  starPlayersCost?: number;
  /** Config staff résolue (DB par roster × format). Coûts en po. */
  staffConfig?: RosterStaffConfig;
}

/** po → « 60k po » (affichage compact, aligné sur le builder de création). */
function kpo(valuePo: number, suffix: string): string {
  return `${Math.round(valuePo / 1000).toLocaleString("fr-FR")}${suffix}`;
}

export default function TeamInfoEditor({
  teamId,
  initialInfo,
  onUpdate,
  disabled = false,
  roster,
  format,
  initialBudgetK = 0,
  playersCost = 0,
  starPlayersCost = 0,
  staffConfig,
}: TeamInfoEditorProps) {
  const { t } = useLanguage();
  const [info, setInfo] = useState<TeamInfo>(initialInfo);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Config staff : ligne DB résolue par le serveur (roster × format) si
  // fournie, sinon défaut dérivé du package pur pour le même couple. Plus
  // aucune constante de coût ni de plafond n'est écrite en dur ici : les
  // valeurs Sevens (relances ×2, staff 20k, apothicaire 80k) et les rosters
  // sans apothicaire sont donc respectés comme à la création.
  const staff = useMemo<RosterStaffConfig>(() => {
    if (staffConfig) return staffConfig;
    const fmt: GameFormat = isGameFormat(format) ? format : "bb11";
    return defaultStaffConfig(info.roster || roster || "", fmt);
  }, [staffConfig, format, info.roster, roster]);

  // Réaligne les valeurs sur les plafonds de la config (roster/format changé,
  // ou équipe historique au-delà d'un plafond depuis resserré).
  useEffect(() => {
    setInfo((prev) => {
      const next: TeamInfo = {
        ...prev,
        rerolls: Math.min(Math.max(0, prev.rerolls || 0), staff.maxRerolls),
        cheerleaders: Math.min(
          Math.max(0, prev.cheerleaders || 0),
          staff.maxCheerleaders,
        ),
        assistants: Math.min(
          Math.max(0, prev.assistants || 0),
          staff.maxAssistants,
        ),
        dedicatedFans: Math.min(
          Math.max(1, prev.dedicatedFans || 1),
          staff.maxDedicatedFans,
        ),
        apothecary: staff.apothecaryAllowed ? prev.apothecary : false,
      };
      const unchanged =
        next.rerolls === prev.rerolls &&
        next.cheerleaders === prev.cheerleaders &&
        next.assistants === prev.assistants &&
        next.dedicatedFans === prev.dedicatedFans &&
        next.apothecary === prev.apothecary;
      return unchanged ? prev : next;
    });
  }, [staff]);

  // Calculs en temps réel (po).
  const { staffCost, remaining } = useMemo(() => {
    const total = computeStaffSpend(info, staff).total;

    // Même base que le résumé budgétaire de la page d'édition : budget de
    // construction moins les joueurs et Star Players engagés. C'est la règle
    // que le serveur applique au PUT /roster.
    const budget = (initialBudgetK || 0) * 1000;
    const engaged = (playersCost || 0) + (starPlayersCost || 0);

    return { staffCost: total, remaining: budget - engaged - total };
  }, [info, staff, initialBudgetK, playersCost, starPlayersCost]);

  const displayedPlayersCost = (playersCost || 0) + (starPlayersCost || 0);

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // S25.5u — apiRequest unwrap l'enveloppe ApiResponse<T>
      await apiRequest<{ team: unknown }>(`/team/${teamId}/info`, {
        method: "PUT",
        body: JSON.stringify(info),
      });
      onUpdate(info);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: unknown) {
      setError(
        (e as { message?: string })?.message || "Erreur lors de la sauvegarde",
      );
    } finally {
      setLoading(false);
    }
  };

  const updateInfo = (field: keyof TeamInfo, value: number | boolean) => {
    setInfo((prev) => ({ ...prev, [field]: value }));
  };

  const unit = t.teams.kpo;
  const decLabel = (label: string) => `${label} −`;
  const incLabel = (label: string) => `${label} +`;

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="bg-gray-50 px-6 py-3 border-b flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{t.teams.teamStaff}</h3>
          <p className="text-sm text-gray-600 mt-1">
            Configurez les ressources de votre équipe selon les règles Blood
            Bowl
          </p>
        </div>
        <span
          className="text-sm text-gray-600 tabular-nums whitespace-nowrap"
          data-testid="staff-cost"
        >
          {t.teams.staffCost} : {kpo(staffCost, unit)}
        </span>
      </div>

      <div className="p-6 space-y-6">
        {/* Récap en temps réel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="text-sm text-purple-700 font-medium">
              {t.teams.playersCost}
            </div>
            <div
              className="text-2xl font-bold text-purple-900"
              data-testid="staff-players-cost"
            >
              {kpo(displayedPlayersCost, unit)}
            </div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm text-blue-700 font-medium">
              {t.teams.staffCost}
            </div>
            <div
              className="text-2xl font-bold text-blue-900"
              data-testid="staff-total-cost"
            >
              {kpo(staffCost, unit)}
            </div>
          </div>
          <div
            className={`text-center p-4 rounded-lg border ${remaining >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
          >
            <div
              className={`text-sm font-medium ${remaining >= 0 ? "text-green-700" : "text-red-700"}`}
            >
              {t.teams.remainingBudget}
            </div>
            <div
              className={`text-2xl font-bold ${remaining >= 0 ? "text-green-900" : "text-red-900"}`}
              data-testid="staff-remaining-budget"
            >
              {kpo(remaining, unit)}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            ✅ Informations sauvegardées avec succès
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <StaffRow
            label={t.teams.rerolls}
            unitCost={`${kpo(staff.rerollCost, unit)} · max ${staff.maxRerolls}`}
            testId="staff-rerolls"
          >
            <QuantityStepper
              value={info.rerolls}
              min={0}
              max={staff.maxRerolls}
              onChange={(v) => updateInfo("rerolls", v)}
              disabled={disabled}
              label={t.teams.rerolls}
              decrementAriaLabel={decLabel(t.teams.rerolls)}
              incrementAriaLabel={incLabel(t.teams.rerolls)}
              decrementTestId="staff-rerolls-dec"
              incrementTestId="staff-rerolls-inc"
              valueTestId="staff-rerolls-value"
            />
          </StaffRow>

          <StaffRow
            label={t.teams.cheerleaders}
            unitCost={`${kpo(staff.cheerleaderCost, unit)} · max ${staff.maxCheerleaders}`}
            testId="staff-cheerleaders"
          >
            <QuantityStepper
              value={info.cheerleaders}
              min={0}
              max={staff.maxCheerleaders}
              onChange={(v) => updateInfo("cheerleaders", v)}
              disabled={disabled}
              label={t.teams.cheerleaders}
              decrementAriaLabel={decLabel(t.teams.cheerleaders)}
              incrementAriaLabel={incLabel(t.teams.cheerleaders)}
              decrementTestId="staff-cheerleaders-dec"
              incrementTestId="staff-cheerleaders-inc"
              valueTestId="staff-cheerleaders-value"
            />
          </StaffRow>

          <StaffRow
            label={t.teams.assistants}
            unitCost={`${kpo(staff.assistantCost, unit)} · max ${staff.maxAssistants}`}
            testId="staff-assistants"
          >
            <QuantityStepper
              value={info.assistants}
              min={0}
              max={staff.maxAssistants}
              onChange={(v) => updateInfo("assistants", v)}
              disabled={disabled}
              label={t.teams.assistants}
              decrementAriaLabel={decLabel(t.teams.assistants)}
              incrementAriaLabel={incLabel(t.teams.assistants)}
              decrementTestId="staff-assistants-dec"
              incrementTestId="staff-assistants-inc"
              valueTestId="staff-assistants-value"
            />
          </StaffRow>

          <StaffRow
            label={t.teams.dedicatedFans}
            unitCost={`${kpo(staff.dedicatedFanCost, unit)} · 1 à ${staff.maxDedicatedFans} (le 1er est offert)`}
            testId="staff-dedicated-fans"
          >
            <QuantityStepper
              value={info.dedicatedFans}
              min={1}
              max={staff.maxDedicatedFans}
              onChange={(v) => updateInfo("dedicatedFans", v)}
              disabled={disabled}
              label={t.teams.dedicatedFans}
              decrementAriaLabel={decLabel(t.teams.dedicatedFans)}
              incrementAriaLabel={incLabel(t.teams.dedicatedFans)}
              decrementTestId="staff-dedicated-fans-dec"
              incrementTestId="staff-dedicated-fans-inc"
              valueTestId="staff-dedicated-fans-value"
            />
          </StaffRow>

          <label
            htmlFor="staff-apothecary-input"
            className={`sm:col-span-2 flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50 transition-colors ${
              staff.apothecaryAllowed && !disabled
                ? "cursor-pointer hover:bg-gray-100"
                : "opacity-50 cursor-not-allowed"
            }`}
          >
            <div className="min-w-0">
              <div className="font-medium text-gray-900">
                {t.teams.apothecary}
              </div>
              <div className="text-xs text-gray-600">
                {kpo(staff.apothecaryCost, unit)} · {t.teams.apothecaryHelp}
              </div>
              {!staff.apothecaryAllowed && (
                <div
                  data-testid="apothecary-forbidden-roster"
                  className="text-xs text-red-600 mt-1"
                >
                  Indisponible pour cette équipe
                </div>
              )}
            </div>
            <input
              id="staff-apothecary-input"
              data-testid="staff-apothecary"
              type="checkbox"
              role="switch"
              aria-checked={info.apothecary}
              aria-label={t.teams.apothecary}
              disabled={disabled || !staff.apothecaryAllowed}
              className="sr-only peer"
              checked={info.apothecary}
              onChange={(e) => updateInfo("apothecary", e.target.checked)}
            />
            <span
              aria-hidden="true"
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500 peer-focus-visible:ring-offset-2 ${
                info.apothecary ? "bg-emerald-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  info.apothecary ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </span>
          </label>
        </div>

        {/* Bouton de sauvegarde */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={disabled || loading}
            data-testid="staff-save"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? "Sauvegarde..." : "Sauvegarder"}
          </button>
        </div>

        {/* Informations sur les coûts — dérivées de la config du roster. */}
        <div
          className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded"
          data-testid="staff-cost-info"
        >
          <div className="font-semibold">ℹ️ Informations sur les coûts</div>
          <ul className="text-sm mt-1 space-y-0.5 list-disc list-inside">
            <li>
              Relances : {staff.rerollCost.toLocaleString("fr-FR")} po chacune
              (max {staff.maxRerolls})
            </li>
            <li>
              Cheerleaders : {staff.cheerleaderCost.toLocaleString("fr-FR")} po
              chacune (max {staff.maxCheerleaders})
            </li>
            <li>
              Assistants : {staff.assistantCost.toLocaleString("fr-FR")} po
              chacun (max {staff.maxAssistants})
            </li>
            <li>
              Apothicaire :{" "}
              {staff.apothecaryAllowed
                ? `${staff.apothecaryCost.toLocaleString("fr-FR")} po (max 1)`
                : "indisponible pour ce roster"}
            </li>
            <li>
              Fans dévoués : {staff.dedicatedFanCost.toLocaleString("fr-FR")} po
              chacun au-dessus du premier (offert), max {staff.maxDedicatedFans}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
