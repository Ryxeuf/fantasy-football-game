import type { ReactNode } from "react";
import type { CompendiumBlock } from "./types";
import { headingId } from "./data";

/** Rend le **gras** Markdown inline ; laisse les `*` simples intacts. */
function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
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

const CALLOUT_STYLES: Record<
  "info" | "warning" | "example",
  { box: string; label: string; defaultTitle: string; icon: string }
> = {
  info: {
    box: "border-nuffle-gold/40 bg-nuffle-gold/5",
    label: "text-nuffle-gold",
    defaultTitle: "Le saviez-vous ?",
    icon: "💡",
  },
  warning: {
    box: "border-nuffle-red/40 bg-nuffle-red/5",
    label: "text-nuffle-red",
    defaultTitle: "Attention",
    icon: "⚠️",
  },
  example: {
    box: "border-nuffle-bronze/40 bg-nuffle-ivory/40",
    label: "text-nuffle-bronze",
    defaultTitle: "Exemple",
    icon: "🎲",
  },
};

interface BlocksProps {
  readonly blocks: readonly CompendiumBlock[];
}

/**
 * Rend une liste de blocs de contenu du compendium.
 * Server component (pas de "use client") : SSR + cache friendly.
 */
export function Blocks({ blocks }: BlocksProps): JSX.Element {
  const seenHeadings = new Set<string>();

  return (
    <div className="space-y-5">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading": {
            if (block.level === 2) {
              const base = headingId(block.text);
              let id = base;
              let n = 2;
              while (seenHeadings.has(id)) id = `${base}-${n++}`;
              seenHeadings.add(id);
              return (
                <h2
                  key={index}
                  id={id}
                  className="scroll-mt-24 flex items-center gap-2.5 border-b border-nuffle-bronze/15 pb-2 pt-5 font-heading text-2xl font-bold text-nuffle-anthracite"
                >
                  <span
                    aria-hidden
                    className="h-5 w-1.5 shrink-0 rounded-full bg-nuffle-gold"
                  />
                  {block.text}
                </h2>
              );
            }
            return (
              <h3
                key={index}
                className="pt-2 font-heading text-lg font-semibold text-nuffle-bronze"
              >
                {block.text}
              </h3>
            );
          }

          case "paragraph":
            return (
              <p
                key={index}
                className="max-w-prose text-[15px] leading-7 text-nuffle-anthracite/85"
              >
                {renderInline(block.text)}
              </p>
            );

          case "list": {
            const className =
              "ml-5 max-w-prose list-outside space-y-1.5 text-[15px] leading-7 text-nuffle-anthracite/85 marker:text-nuffle-gold";
            const items = block.items.map((item, i) => (
              <li key={i} className="pl-1">
                {renderInline(item)}
              </li>
            ));
            return block.ordered ? (
              <ol
                key={index}
                className={`list-decimal marker:font-score marker:text-base ${className}`}
              >
                {items}
              </ol>
            ) : (
              <ul key={index} className={`list-disc ${className}`}>
                {items}
              </ul>
            );
          }

          case "table":
            return (
              <figure key={index} className="space-y-2">
                <div className="overflow-x-auto rounded-xl border border-nuffle-bronze/20 shadow-sm">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-nuffle-ivory/60 text-left text-xs uppercase tracking-wide text-nuffle-bronze">
                      <tr>
                        {block.columns.map((col, c) => (
                          <th
                            key={c}
                            className="whitespace-nowrap px-3 py-2.5 font-semibold"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {block.rows.map((row, r) => (
                        <tr
                          key={r}
                          className="align-top odd:bg-white even:bg-nuffle-ivory/20"
                        >
                          {row.map((cell, c) => (
                            <td
                              key={c}
                              className="border-t border-nuffle-bronze/10 px-3 py-2 text-nuffle-anthracite/85"
                            >
                              {renderInline(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {block.caption ? (
                  <figcaption className="text-xs italic text-nuffle-anthracite/60">
                    {block.caption}
                  </figcaption>
                ) : null}
              </figure>
            );

          case "callout": {
            const style = CALLOUT_STYLES[block.variant];
            return (
              <aside
                key={index}
                className={`flex gap-3 rounded-xl border px-4 py-3 ${style.box}`}
              >
                <span aria-hidden className="select-none text-lg leading-6">
                  {style.icon}
                </span>
                <div className="min-w-0">
                  <p
                    className={`mb-1 text-xs font-semibold uppercase tracking-wide ${style.label}`}
                  >
                    {block.title ?? style.defaultTitle}
                  </p>
                  <p className="text-[15px] leading-7 text-nuffle-anthracite/85">
                    {renderInline(block.text)}
                  </p>
                </div>
              </aside>
            );
          }

          default:
            return null;
        }
      })}
    </div>
  );
}
