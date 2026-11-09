"use client";
/**
 * Sélecteur « Toutes / Les miennes » des listes de compétitions. Lit et
 * écrit `?scope=` (`router.replace`, sans défiler) : la page relit le même
 * paramètre et le transmet à l'API. Monté sous un `<Suspense>` par la page
 * (`useSearchParams`).
 */

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "../contexts/LanguageContext";
import {
  parseCompetitionScope,
  withCompetitionScope,
  type CompetitionScope,
} from "../lib/competition-scope";

interface Props {
  /** Préfixe des `data-testid` (`<prefix>-all`, `<prefix>-mine`). */
  testIdPrefix?: string;
}

export default function ScopeToggle({ testIdPrefix = "scope-toggle" }: Props) {
  const { t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = parseCompetitionScope(params?.get("scope"));

  function select(scope: CompetitionScope) {
    if (scope === current) return;
    const qs = withCompetitionScope(params?.toString() ?? "", scope);
    router.replace(`${pathname ?? ""}${qs}`, { scroll: false });
  }

  const options: Array<{ value: CompetitionScope; label: string }> = [
    { value: "all", label: t.myCompetitions.scopeAll },
    { value: "mine", label: t.myCompetitions.scopeMine },
  ];

  return (
    <div
      role="radiogroup"
      aria-label={t.myCompetitions.scopeLabel}
      data-testid={testIdPrefix}
      className="inline-flex rounded-md border border-gray-300 bg-white p-0.5 text-sm"
    >
      {options.map((o) => {
        const active = o.value === current;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            data-testid={`${testIdPrefix}-${o.value}`}
            onClick={() => select(o.value)}
            className={`rounded px-3 py-1.5 font-medium transition-colors ${
              active
                ? "bg-nuffle-gold text-white"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
