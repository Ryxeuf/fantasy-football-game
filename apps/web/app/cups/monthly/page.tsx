"use client";
/**
 * S27.1c — Calendrier des Nuffle Cup mensuelles `/cups/monthly`.
 *
 * Page publique qui consomme `GET /cup/monthly` (S27.1b). Liste les
 * editions ordonnees `monthlyYear DESC, monthlyMonth DESC` avec un
 * lien direct vers la page detail `/cups/{id}`. Foundation pour le
 * bracket visuel (S27.1d) et le match-of-the-week (S27.1e).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "../../lib/api-client";
import { useLanguage } from "../../contexts/LanguageContext";
import MatchOfTheWeekBanner from "../MatchOfTheWeekBanner";

interface MonthlyCup {
  id: string;
  name: string;
  monthlyYear: number | null;
  monthlyMonth: number | null;
  status: string;
  isPublic: boolean;
}

const STATUS_KEY: Record<string, "monthlyStatusOuverte" | "monthlyStatusEnCours" | "monthlyStatusTerminee" | "monthlyStatusArchivee"> = {
  ouverte: "monthlyStatusOuverte",
  en_cours: "monthlyStatusEnCours",
  terminee: "monthlyStatusTerminee",
  archivee: "monthlyStatusArchivee",
};

export default function MonthlyCupsPage(): JSX.Element {
  const { t } = useLanguage();
  const [cups, setCups] = useState<MonthlyCup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const body = await apiRequest<{ cups: MonthlyCup[] }>("/cup/monthly");
        if (!cancelled) setCups(body.cups ?? []);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : t.cups.monthlyError,
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [t.cups.monthlyError]);

  if (loading) {
    return (
      <div data-testid="monthly-cups-loading" className="w-full p-6">
        <p>{t.cups.monthlyLoading}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="monthly-cups-error" className="w-full p-6">
        <p className="text-red-600">
          {t.common.error} : {error}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full p-4 sm:p-6 space-y-4 sm:space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">
          {t.cups.monthlyTitle}
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          {t.cups.monthlyDescription}
        </p>
      </header>

      {/* S27.1h — teaser "Match du moment" si pick admin actif. */}
      <MatchOfTheWeekBanner />

      {cups.length === 0 ? (
        <div
          data-testid="monthly-cups-empty"
          className="text-center py-8 text-gray-500"
        >
          {t.cups.monthlyEmpty}
        </div>
      ) : (
        <ul
          data-testid="monthly-cups-list"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4"
        >
          {cups.map((c) => {
            const statusLabel =
              t.cups[STATUS_KEY[c.status] ?? "monthlyStatusOuverte"];
            return (
              <li
                key={c.id}
                data-testid={`monthly-cup-item-${c.id}`}
                className="border border-gray-200 rounded-lg bg-white hover:border-nuffle-gold transition-colors"
              >
                <Link
                  href={`/cups/${c.id}`}
                  className="block p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-semibold text-nuffle-anthracite">
                      {c.name}
                    </h2>
                    <span className="text-xs uppercase tracking-wide bg-nuffle-gold/10 border border-nuffle-gold/30 text-nuffle-bronze px-2 py-0.5 rounded">
                      {statusLabel}
                    </span>
                  </div>
                  {c.monthlyYear !== null && c.monthlyMonth !== null ? (
                    <p className="text-xs text-gray-500">
                      {String(c.monthlyMonth).padStart(2, "0")}/
                      {c.monthlyYear}
                    </p>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
