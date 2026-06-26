/**
 * Construction des enregistrements de recherche à partir des contenus
 * publics. Fonctions pures : elles reçoivent des données déjà chargées
 * (compendium local + réponses d'API) et renvoient des `SearchRecord[]`.
 */

import { chapters, chapterToc } from "../compendium/data";
import type { CompendiumBlock, CompendiumChapter } from "../compendium/types";
import { stripRosterPrefix, cleanDisplayName } from "../teams/position-slug";
import type { SearchRecord } from "./search";

/** Texte indexable d'un bloc de compendium. */
function blockText(block: CompendiumBlock): string {
  switch (block.type) {
    case "heading":
    case "paragraph":
      return block.text;
    case "list":
      return block.items.join(" ");
    case "callout":
      return `${block.title ?? ""} ${block.text}`;
    case "table":
      return [block.caption ?? "", ...block.columns, ...block.rows.flat()].join(
        " ",
      );
    default:
      return "";
  }
}

/** Un enregistrement pour le chapitre + un par section (h2) avec ancre. */
function chapterRecords(chapter: CompendiumChapter): SearchRecord[] {
  const toc = chapterToc(chapter);
  const out: SearchRecord[] = [];
  const introParts: string[] = [chapter.summary];
  let h2Index = -1;
  let section: { anchor: string; title: string; parts: string[] } | null = null;

  for (const block of chapter.blocks) {
    if (block.type === "heading" && block.level === 2) {
      h2Index += 1;
      section = { anchor: toc[h2Index]?.id ?? "", title: block.text, parts: [] };
      out.push({
        id: `rule:${chapter.slug}#${section.anchor}`,
        type: "rule",
        title: section.title,
        subtitle: `Règles · ${chapter.title}`,
        text: "", // rempli ci-dessous une fois la section terminée
        url: `/compendium/${chapter.slug}${section.anchor ? `#${section.anchor}` : ""}`,
      });
    } else {
      const t = blockText(block);
      if (section) section.parts.push(t);
      else introParts.push(t);
    }
    // Met à jour le texte du dernier enregistrement de section au fil de l'eau.
    if (section) {
      out[out.length - 1] = { ...out[out.length - 1], text: section.parts.join(" ") };
    }
  }

  out.unshift({
    id: `rule:${chapter.slug}`,
    type: "rule",
    title: chapter.title,
    subtitle: "Règles",
    text: introParts.join(" "),
    url: `/compendium/${chapter.slug}`,
  });
  return out;
}

/** Enregistrements du compendium (chapitres + sections). */
export function compendiumRecords(): SearchRecord[] {
  return chapters.flatMap(chapterRecords);
}

export interface ApiSkill {
  slug: string;
  nameFr: string;
  description?: string | null;
  category?: string | null;
}

export function skillRecords(skills: readonly ApiSkill[]): SearchRecord[] {
  return skills.map((s) => ({
    id: `skill:${s.slug}`,
    type: "skill",
    title: s.nameFr,
    subtitle: "Compétence",
    text: `${s.nameFr}. ${s.description ?? ""}`,
    url: `/skills/${s.slug}`,
  }));
}

export interface ApiPosition {
  slug: string;
  displayName: string;
  displayNameEn?: string | null;
  rosterSlug: string;
  cost?: number | null;
  skills?: string | null;
}

export function positionRecords(
  positions: readonly ApiPosition[],
  rosterNameBySlug: ReadonlyMap<string, string> = new Map(),
): SearchRecord[] {
  return positions.map((p) => {
    const { name } = cleanDisplayName(p.displayName);
    const segment = stripRosterPrefix(p.slug, p.rosterSlug);
    const rosterName = rosterNameBySlug.get(p.rosterSlug);
    return {
      id: `position:${p.slug}`,
      type: "position",
      title: name,
      subtitle: rosterName ? `Position · ${rosterName}` : "Position",
      text: `${name} ${p.displayNameEn ?? ""} ${rosterName ?? ""}`.trim(),
      url: `/teams/${p.rosterSlug}/${segment}`,
    };
  });
}

export interface ApiRoster {
  slug: string;
  name: string;
  tier?: string | null;
}

export function rosterRecords(rosters: readonly ApiRoster[]): SearchRecord[] {
  return rosters.map((r) => ({
    id: `roster:${r.slug}`,
    type: "roster",
    title: r.name,
    subtitle: r.tier ? `Équipe · Tier ${r.tier}` : "Équipe",
    text: `${r.name} ${r.tier ? `tier ${r.tier}` : ""}`.trim(),
    url: `/teams/${r.slug}`,
  }));
}

export interface ApiStar {
  slug: string;
  displayName: string;
  specialRule?: string | null;
  cost?: number | null;
}

export function starRecords(stars: readonly ApiStar[]): SearchRecord[] {
  return stars.map((s) => ({
    id: `star:${s.slug}`,
    type: "star",
    title: s.displayName,
    subtitle: "Star Player",
    text: `${s.displayName}. ${s.specialRule ?? ""}`,
    url: `/star-players`,
  }));
}
