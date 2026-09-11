/**
 * Garde de cablage — la brique « partie offline » est desactivee par un
 * feature gate, pas par une suppression de code.
 *
 * Deux invariants, tous deux faciles a perdre lors d'un refactor :
 *
 *  1. `/local-match` reste monte DERRIERE `requireFeatureFlag` — sinon la
 *     fonctionnalite reste ouverte cote API alors que l'UI la cache, et un
 *     lien partage continue de creer des parties ;
 *  2. le flag est un feature gate NORMAL (jamais un kill-switch), pour que
 *     `FEATURE_FLAGS_FORCE_ENABLED` (CI) et le role admin continuent de le
 *     court-circuiter — les suites e2e exercent encore ces routes.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { KNOWN_FLAGS, OFFLINE_MATCH_FLAG } from "./featureFlags";

const indexSource = readFileSync(join(__dirname, "..", "index.ts"), "utf8");
const featureFlagsSource = readFileSync(
  join(__dirname, "featureFlags.ts"),
  "utf8",
);

describe("gate de la partie offline", () => {
  it("expose une cle stable, connue du registre de synchro", () => {
    expect(OFFLINE_MATCH_FLAG).toBe("offline_match");
    expect(KNOWN_FLAGS.map((f) => f.key)).toContain(OFFLINE_MATCH_FLAG);
  });

  it("monte /local-match derriere requireFeatureFlag", () => {
    const mount = indexSource.match(
      /app\.use\(\s*"\/local-match",([\s\S]{0,200}?)\);/,
    );
    expect(mount, "aucun montage app.use(\"/local-match\", ...)").not.toBeNull();
    expect(mount?.[1]).toContain("requireFeatureFlag(OFFLINE_MATCH_FLAG)");
  });

  it("n'est PAS un kill-switch : la CI et les admins le court-circuitent", () => {
    const killSwitches = featureFlagsSource.match(
      /const KILL_SWITCH_FLAGS = new Set<string>\(\[([\s\S]*?)\]\)/,
    );
    expect(killSwitches).not.toBeNull();
    expect(killSwitches?.[1]).not.toContain("OFFLINE_MATCH_FLAG");
  });
});
