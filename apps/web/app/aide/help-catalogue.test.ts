import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import * as FLAG_KEYS from "../lib/featureFlagKeys";
import { HELP_CATEGORIES, HELP_UNLISTED_ROUTES, helpHrefs } from "./help-catalogue";

const APP_DIR = join(__dirname, "..");

/**
 * Toutes les routes de page de l'app (`page.tsx`), hors console admin et
 * routes d'API, en URL (`/teams/[slug]`). Les groupes `(x)` disparaissent
 * de l'URL, les dossiers privés `_x` ne sont pas des routes.
 */
function pageRoutes(dir: string = APP_DIR): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry.startsWith("_") || entry === "node_modules") continue;
      out.push(...pageRoutes(full));
    } else if (entry === "page.tsx") {
      const rel = relative(APP_DIR, dir).split(sep).filter((s) => !/^\(.*\)$/.test(s));
      out.push(`/${rel.join("/")}`.replace(/\/$/, "") || "/");
    }
  }
  return out.filter((r) => !r.startsWith("/admin") && !r.startsWith("/api")).sort();
}

const ROUTES = pageRoutes();
const isDynamic = (route: string) => route.includes("[");

/** Une URL concrète (`/compendium/des-de-blocage`) correspond-elle à une route ? */
function matchesRoute(href: string, route: string): boolean {
  const path = href.split(/[?#]/)[0].replace(/\/$/, "") || "/";
  const a = path.split("/");
  const b = route.split("/");
  return a.length === b.length && b.every((seg, i) => seg.startsWith("[") || seg === a[i]);
}

function isUnlisted(route: string): boolean {
  return Object.keys(HELP_UNLISTED_ROUTES).some((pattern) =>
    pattern.endsWith("/*") ? route.startsWith(pattern.slice(0, -2)) : route === pattern,
  );
}

describe("catalogue de l'aide", () => {
  const features = HELP_CATEGORIES.flatMap((c) => c.features);

  it("a des identifiants uniques (ancres de la page)", () => {
    const ids = [...HELP_CATEGORIES.map((c) => c.id), ...features.map((f) => f.id)];
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id, id).toMatch(/^[a-z0-9-]+$/);
  });

  it("ne laisse aucune catégorie vide ni texte manquant", () => {
    for (const category of HELP_CATEGORIES) {
      expect(category.features.length, category.id).toBeGreaterThan(0);
      expect(category.intro.trim(), category.id).not.toBe("");
    }
    for (const f of features) {
      expect(f.description.trim().length, f.id).toBeGreaterThan(20);
    }
  });

  it("ne pointe que vers des pages qui existent", () => {
    for (const href of helpHrefs(HELP_CATEGORIES)) {
      expect(
        ROUTES.some((route) => matchesRoute(href, route)),
        `lien mort dans l'aide : ${href}`,
      ).toBe(true);
    }
  });

  it("ne gate que sur des feature flags connus du code", () => {
    const known = new Set<string>(Object.values(FLAG_KEYS));
    const gated = features.flatMap((f) => [
      ...(f.flags ?? []),
      ...(f.links ?? []).flatMap((l) => l.flags ?? []),
    ]);
    for (const flag of gated) {
      expect(known.has(flag), `flag inconnu : ${flag}`).toBe(true);
    }
  });

  /**
   * Ratchet d'EXHAUSTIVITÉ : une page statique ajoutée au site doit entrer
   * dans l'aide (fonctionnalité ou lien secondaire) ou dans
   * `HELP_UNLISTED_ROUTES` avec la raison de son absence. Les routes
   * dynamiques (`/teams/[slug]`) s'atteignent depuis leur page d'entrée,
   * que l'aide décrit.
   */
  it("couvre chaque page statique du site, ou dit pourquoi elle n'y est pas", () => {
    const hrefs = helpHrefs(HELP_CATEGORIES);
    const missing = ROUTES.filter(
      (route) =>
        !isDynamic(route) &&
        !isUnlisted(route) &&
        !hrefs.some((href) => matchesRoute(href, route)),
    );
    expect(missing, "pages absentes de l'aide (ajouter au catalogue ou à HELP_UNLISTED_ROUTES)").toEqual([]);
  });

  it("n'exclut que des pages qui existent, avec une raison", () => {
    for (const [pattern, reason] of Object.entries(HELP_UNLISTED_ROUTES)) {
      expect(reason.trim().length, pattern).toBeGreaterThan(10);
      const exists = pattern.endsWith("/*")
        ? ROUTES.some((r) => r.startsWith(pattern.slice(0, -2)))
        : ROUTES.includes(pattern);
      expect(exists, `exclusion obsolète : ${pattern}`).toBe(true);
    }
  });
});
