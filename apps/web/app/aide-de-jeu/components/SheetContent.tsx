"use client";

import Link from "next/link";
import { useState } from "react";
import type { ReactNode } from "react";
import type { Sheet, SheetTable } from "../data/sheets";

/** Rend le **gras** Markdown inline, comme le fait le compendium. */
function renderInline(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    const match = /^\*\*([^*]+)\*\*$/.exec(part);
    if (match) {
      return (
        <strong key={i} className="font-semibold text-nuffle-anthracite">
          {match[1]}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/**
 * Une table à deux colonnes (« 2D6 » + effet) se lit mieux en liste de
 * lignes qu'en tableau sur un écran de téléphone : le premier terme
 * devient une pastille de dé, le reste coule sur toute la largeur.
 * Au-delà de deux colonnes, on garde un vrai tableau, scrollable.
 */
function TableRows({ table }: { readonly table: SheetTable }): JSX.Element {
  if (table.columns.length > 3) {
    return (
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[30rem] border-collapse text-left text-sm">
          <thead>
            <tr>
              {table.columns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="border-b border-nuffle-bronze/25 px-2 py-2 font-subtitle text-[0.65rem] font-bold uppercase tracking-wider text-nuffle-bronze"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className="border-b border-nuffle-bronze/12 px-2 py-2 align-top text-[0.8rem] leading-relaxed text-nuffle-anthracite/80"
                  >
                    {renderInline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-nuffle-bronze/15">
      {table.rows.map((row, i) => (
        <li key={i} className="flex gap-3 py-3">
          <span className="w-11 flex-none pt-0.5 text-center font-score text-xl leading-tight text-nuffle-red">
            {row[0]}
          </span>
          <div className="min-w-0 flex-1 text-sm leading-relaxed text-nuffle-anthracite/80">
            {row.length === 3 ? (
              <>
                <p className="font-semibold text-nuffle-anthracite">{renderInline(row[1])}</p>
                <p className="mt-1">{renderInline(row[2])}</p>
              </>
            ) : (
              <p>{renderInline(row[1])}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Corps d'une fiche : onglets de variante (si plusieurs), table, renvoi. */
export function SheetContent({ sheet }: { readonly sheet: Sheet }): JSX.Element {
  const [variantId, setVariantId] = useState(sheet.variants[0].id);
  const variant =
    sheet.variants.find((v) => v.id === variantId) ?? sheet.variants[0];

  return (
    <div>
      {sheet.variants.length > 1 && (
        <div
          className="-mx-4 mb-1 flex gap-2 overflow-x-auto px-4 pb-3"
          role="tablist"
          aria-label={`Variantes — ${sheet.title}`}
        >
          {sheet.variants.map((v) => {
            const active = v.id === variant.id;
            return (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setVariantId(v.id)}
                className={`flex h-11 flex-none items-center rounded-full px-4 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-nuffle-anthracite text-nuffle-ivory"
                    : "border border-nuffle-bronze/25 bg-nuffle-ivory/50 text-nuffle-bronze hover:border-nuffle-gold/50"
                }`}
              >
                {v.label}
              </button>
            );
          })}
        </div>
      )}

      <TableRows table={variant.table} />

      {sheet.chapterSlug && (
        <Link
          href={`/compendium/${sheet.chapterSlug}`}
          className="mt-4 flex h-12 items-center justify-center gap-2 rounded-2xl border border-dashed border-nuffle-bronze/40 text-sm font-semibold text-nuffle-bronze transition-colors hover:border-nuffle-gold hover:text-nuffle-gold"
        >
          Lire le chapitre complet
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="m9 6 6 6-6 6" />
          </svg>
        </Link>
      )}
    </div>
  );
}
