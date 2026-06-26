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
  { box: string; label: string; defaultTitle: string }
> = {
  info: {
    box: "border-nuffle-gold/40 bg-nuffle-gold/5",
    label: "text-nuffle-gold",
    defaultTitle: "Le saviez-vous ?",
  },
  warning: {
    box: "border-nuffle-red/40 bg-nuffle-red/5",
    label: "text-nuffle-red",
    defaultTitle: "Attention",
  },
  example: {
    box: "border-nuffle-bronze/40 bg-nuffle-ivory/40",
    label: "text-nuffle-bronze",
    defaultTitle: "Exemple",
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
                  className="scroll-mt-24 border-b border-nuffle-bronze/15 pb-2 pt-4 text-2xl font-semibold text-nuffle-anthracite"
                >
                  {block.text}
                </h2>
              );
            }
            return (
              <h3
                key={index}
                className="pt-2 text-lg font-semibold text-nuffle-anthracite"
              >
                {block.text}
              </h3>
            );
          }

          case "paragraph":
            return (
              <p
                key={index}
                className="text-[15px] leading-relaxed text-nuffle-anthracite/85"
              >
                {renderInline(block.text)}
              </p>
            );

          case "list": {
            const className =
              "ml-5 list-outside space-y-1 text-[15px] leading-relaxed text-nuffle-anthracite/85";
            const items = block.items.map((item, i) => (
              <li key={i}>{renderInline(item)}</li>
            ));
            return block.ordered ? (
              <ol key={index} className={`list-decimal ${className}`}>
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
                <div className="overflow-x-auto rounded-lg border border-nuffle-bronze/20">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-nuffle-ivory/50 text-left text-xs uppercase tracking-wide text-nuffle-bronze">
                      <tr>
                        {block.columns.map((col, c) => (
                          <th
                            key={c}
                            className="whitespace-nowrap px-3 py-2 font-semibold"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-nuffle-bronze/15">
                      {block.rows.map((row, r) => (
                        <tr key={r} className="align-top">
                          {row.map((cell, c) => (
                            <td
                              key={c}
                              className="px-3 py-2 text-nuffle-anthracite/85"
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
                className={`rounded-lg border px-4 py-3 ${style.box}`}
              >
                <p
                  className={`mb-1 text-xs font-semibold uppercase tracking-wide ${style.label}`}
                >
                  {block.title ?? style.defaultTitle}
                </p>
                <p className="text-[15px] leading-relaxed text-nuffle-anthracite/85">
                  {renderInline(block.text)}
                </p>
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
