/**
 * L'allocateur du builder sous RÈGLEMENT DE TOURNOI : barème PSP du pack
 * (1re/2e compétence, surcoût Élite) et quota de joueurs autorisés à cumuler
 * deux compétences. L'UI doit refuser en amont ce que
 * `validateTournamentSkillPlan` refuserait côté serveur.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NAF_WORLD_CUP_2027, getTournamentRosterRules } from "@bb/game-engine";
import BuildAdvancementAllocator from "./BuildAdvancementAllocator";
import type {
  BuildAdvancement,
  AllocatorPosition,
} from "./build-advancement-rules";

const apiRequest = vi.fn();
vi.mock("../../../lib/api-client", () => ({
  apiRequest: (path: string, init?: RequestInit) => apiRequest(path, init),
}));

const POSITIONS: AllocatorPosition[] = [
  {
    slug: "custom_lineman",
    displayName: "Trois-quart",
    skills: "tackle",
    primarySkills: "G",
    secondarySkills: "A",
  },
];

const CATALOG = {
  skills: [
    { slug: "block", nameFr: "Blocage", category: "General", isElite: true },
    { slug: "tackle", nameFr: "Tacle", category: "General" },
    { slug: "frenzy", nameFr: "Frénésie", category: "General" },
    { slug: "dodge", nameFr: "Esquive", category: "Agility", isElite: true },
  ],
};

function Harness(props: {
  pool?: number;
  pack: typeof NAF_WORLD_CUP_2027;
  packRules: ReturnType<typeof getTournamentRosterRules>;
}) {
  const [value, setValue] = useState<BuildAdvancement[]>([]);
  return (
    <BuildAdvancementAllocator
      ruleset="season_3"
      positions={POSITIONS}
      counts={{ custom_lineman: 1 }}
      pool={props.pool ?? 44}
      value={value}
      onChange={setValue}
      pack={props.pack}
      packRules={props.packRules}
    />
  );
}

/** Ouvre la feuille de sélection du joueur donné. */
async function openPicker(slug = "custom_lineman", ordinal = 0) {
  fireEvent.click(await screen.findByTestId(`allocator-add-${slug}-${ordinal}`));
  return screen.findByTestId("skill-picker");
}

describe("BuildAdvancementAllocator — règlement de tournoi", () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockResolvedValue(CATALOG);
  });

  const pack = {
    ...NAF_WORLD_CUP_2027,
    eliteSkills: ["block"],
    skillCosts: { ...NAF_WORLD_CUP_2027.skillCosts, eliteSurcharge: 2 },
  };

  it("applique le barème du règlement, surcoût Élite compris", async () => {
    // Orques : cumul « none » — aucun joueur ne peut prendre 2 compétences.
    const packRules = getTournamentRosterRules(NAF_WORLD_CUP_2027, "orc");
    render(<Harness pack={pack} packRules={packRules} pool={44} />);

    expect(
      (await screen.findByTestId("allocator-pack-rules")).textContent,
    ).toContain("aucun joueur ne peut cumuler");

    await openPicker();
    // Blocage est Élite pour ce règlement : 6 + 2 = 8 PSP.
    expect(
      screen.getByTestId("skill-picker-option-block").textContent,
    ).toContain("8 PSP");
    expect(
      screen.getByTestId("skill-picker-option-frenzy").textContent,
    ).toContain("6 PSP");

    fireEvent.click(screen.getByTestId("skill-picker-option-block"));
    await waitFor(() =>
      expect(screen.getByTestId("allocator-remaining").textContent).toBe("36"),
    );
  });

  it("interdit la 2e compétence quand le quota de cumul est atteint", async () => {
    const packRules = getTournamentRosterRules(NAF_WORLD_CUP_2027, "orc");
    render(<Harness pack={pack} packRules={packRules} pool={44} />);
    await openPicker();
    fireEvent.click(screen.getByTestId("skill-picker-option-frenzy"));

    await waitFor(() =>
      expect(
        (
          screen.getByTestId(
            "allocator-add-custom_lineman-0",
          ) as HTMLButtonElement
        ).disabled,
      ).toBe(true),
    );
    expect(
      screen.getByTestId("allocator-add-custom_lineman-0").textContent,
    ).toContain("Cumul interdit par le règlement");
  });
});
