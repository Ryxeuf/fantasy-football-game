/**
 * Le web lit les règlements depuis l'API : il doit reconstruire la borne
 * ouverte de la taxe Star Players (`null` en JSON → `Infinity` côté moteur),
 * sinon la dernière tranche ne s'appliquerait jamais.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const apiRequest = vi.fn();
vi.mock("./api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

import { NAF_WORLD_CUP_2027, tournamentStarPlayerSppTax } from "@bb/game-engine";
import {
  fetchTournamentRulesets,
  invalidateTournamentRulesetsCache,
} from "./tournament-rulesets";

/** Payload tel que le sert `GET /api/tournament-rulesets`. */
function payload() {
  return {
    rulesets: [
      {
        slug: "naf_world_cup_2027",
        enabled: true,
        definition: {
          ...NAF_WORLD_CUP_2027,
          starPlayerSppTax: [
            { maxTotalCostK: 199, spp: 18 },
            { maxTotalCostK: null, spp: 32 },
          ],
        },
      },
    ],
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  invalidateTournamentRulesetsCache();
});

describe("fetchTournamentRulesets", () => {
  it("réhydrate la borne ouverte en Infinity", async () => {
    apiRequest.mockResolvedValue(payload());
    const [pack] = await fetchTournamentRulesets();
    expect(pack.definition.starPlayerSppTax[1].maxTotalCostK).toBe(
      Number.POSITIVE_INFINITY,
    );
    // Sans réhydratation, un coût cumulé élevé ne tomberait dans aucune
    // tranche et la taxe serait silencieusement nulle.
    expect(tournamentStarPlayerSppTax(pack.definition, 900)).toBe(32);
    expect(tournamentStarPlayerSppTax(pack.definition, 100)).toBe(18);
  });

  it("ne télécharge la liste qu'une fois", async () => {
    apiRequest.mockResolvedValue(payload());
    await fetchTournamentRulesets();
    await fetchTournamentRulesets();
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });

  it("échec réseau : liste vide plutôt qu'un règlement inapplicable", async () => {
    apiRequest.mockRejectedValue(new Error("offline"));
    expect(await fetchTournamentRulesets()).toEqual([]);
  });
});
