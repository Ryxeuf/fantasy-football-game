"use client";
/**
 * Briques partagées des consoles admin Ligues et Coupes : garde admin,
 * bascule de visibilité, badges de statut et bloc de champs numériques.
 *
 * Les deux familles n'ont pas le même vocabulaire de statut (anglais côté
 * ligue, français côté coupe) : chaque famille garde sa table de libellés,
 * seul le rendu est commun.
 */

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../lib/api-client";

/**
 * Redirige vers `/` un visiteur qui n'est pas admin. Cosmétique : le
 * serveur refuse de toute façon (`adminOnly`). Renvoie `true` une fois le
 * rôle confirmé, pour ne pas afficher la console à un non-admin.
 */
export function useAdminGate(): boolean {
  const router = useRouter();
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let cancelled = false;
    apiRequest<{ user: { role?: string; roles?: string[] } | null }>(
      "/auth/me",
    )
      .then((me) => {
        if (cancelled) return;
        const roles =
          me?.user?.roles ?? (me?.user?.role ? [me.user.role] : []);
        if (roles.includes("admin")) setOk(true);
        else router.replace("/");
      })
      .catch(() => {
        if (!cancelled) router.replace("/");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);
  return ok;
}

export function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

export interface StatusMeta {
  readonly label: string;
  /** Classes Tailwind du badge. */
  readonly tone: string;
}

export const LEAGUE_STATUS_META: Readonly<Record<string, StatusMeta>> = {
  draft: { label: "Brouillon", tone: "bg-gray-100 text-gray-700" },
  open: { label: "Ouverte", tone: "bg-green-100 text-green-800" },
  in_progress: { label: "En cours", tone: "bg-blue-100 text-blue-800" },
  completed: { label: "Terminée", tone: "bg-amber-100 text-amber-800" },
  archived: { label: "Archivée", tone: "bg-purple-100 text-purple-800" },
};

export const CUP_STATUS_META: Readonly<Record<string, StatusMeta>> = {
  ouverte: { label: "Ouverte", tone: "bg-green-100 text-green-800" },
  en_cours: { label: "En cours", tone: "bg-blue-100 text-blue-800" },
  terminee: { label: "Terminée", tone: "bg-amber-100 text-amber-800" },
  archivee: { label: "Archivée", tone: "bg-purple-100 text-purple-800" },
};

export function StatusBadge({
  status,
  meta,
}: {
  status: string;
  meta: Readonly<Record<string, StatusMeta>>;
}) {
  const m = meta[status] ?? { label: status, tone: "bg-gray-100 text-gray-700" };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${m.tone}`}
    >
      {m.label}
    </span>
  );
}

/**
 * Interrupteur Publique / Privée. `role="switch"` + `aria-checked` : lu
 * comme un interrupteur par les lecteurs d'écran, et cible tactile d'au
 * moins 36 px de haut sur mobile.
 */
export function VisibilityToggle({
  isPublic,
  onToggle,
  disabled,
  testId,
}: {
  isPublic: boolean;
  onToggle: () => void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isPublic}
      data-testid={testId}
      onClick={onToggle}
      disabled={disabled}
      title={
        isPublic
          ? "Publique : listée et lisible de tous. Cliquer pour la rendre privée."
          : "Privée : visible des seuls commissaire, admins et participants. Cliquer pour la rendre publique."
      }
      className={`inline-flex items-center gap-2 min-h-[36px] px-3 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap shrink-0 self-start transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        isPublic
          ? "bg-green-50 border-green-200 text-green-800 hover:bg-green-100"
          : "bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200"
      }`}
    >
      <span
        aria-hidden="true"
        className={`relative inline-block w-7 h-4 rounded-full transition-colors ${
          isPublic ? "bg-green-500" : "bg-gray-400"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${
            isPublic ? "left-3.5" : "left-0.5"
          }`}
        />
      </span>
      <span>{isPublic ? "🌍 Publique" : "🔒 Privée"}</span>
    </button>
  );
}

export interface NumberFieldDef<K extends string> {
  readonly key: K;
  readonly label: string;
  readonly min?: number;
  readonly max?: number;
}

/**
 * Grille de champs entiers (barème). Une colonne sur petit mobile, deux
 * puis quatre au-delà : les libellés restent lisibles sans scroll
 * horizontal.
 */
export function NumberFieldsGrid<K extends string>({
  fields,
  values,
  onChange,
  disabled,
  testIdPrefix,
}: {
  fields: ReadonlyArray<NumberFieldDef<K>>;
  values: Record<K, string>;
  onChange: (key: K, value: string) => void;
  disabled?: boolean;
  testIdPrefix: string;
}) {
  return (
    <div className="grid grid-cols-1 min-[400px]:grid-cols-2 lg:grid-cols-4 gap-3">
      {fields.map((f) => (
        <label key={f.key} className="block">
          <span className="text-xs font-medium text-gray-700">{f.label}</span>
          <input
            type="number"
            inputMode="numeric"
            step={1}
            min={f.min}
            max={f.max}
            value={values[f.key]}
            disabled={disabled}
            data-testid={`${testIdPrefix}-${f.key}`}
            onChange={(e) => onChange(f.key, e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500"
          />
        </label>
      ))}
    </div>
  );
}

/** Carte de section de formulaire, padding resserré sur mobile. */
export function Section({
  title,
  description,
  children,
  tone = "default",
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <section
      className={`rounded-xl border bg-white p-4 sm:p-6 space-y-4 shadow-sm ${
        tone === "danger" ? "border-red-200" : "border-gray-200"
      }`}
    >
      <div>
        <h2
          className={`text-base sm:text-lg font-semibold ${
            tone === "danger" ? "text-red-700" : "text-gray-900"
          }`}
        >
          {title}
        </h2>
        {description ? (
          <p className="text-xs sm:text-sm text-gray-500 mt-1">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** Convertit un champ texte en entier, `null` si vide ou invalide. */
export function parseIntField(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}
