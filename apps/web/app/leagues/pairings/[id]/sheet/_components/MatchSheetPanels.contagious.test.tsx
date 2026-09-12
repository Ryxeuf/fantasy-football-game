/**
 * Feuille de match — Trait « Contagieux » (Nurgle) : la seconde source de
 * joueur relevé parle SON vocabulaire (Contaminé, ☣️), s'embauche AU PRIX du
 * poste — jamais gratuitement — et coexiste avec Maîtres de la Non-vie quand
 * les deux règles jouent sur le même côté.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import {
  PlayerSelect,
  PostMatchPanel,
  RaiseDeadPanel,
  raisedDeadWording,
  type PostMatchValues,
  type SheetRaisedDead,
  type SheetTeam,
} from "./MatchSheetPanels";

const ROTTER = "nurgle_trois_quart_putrescent";

/** Trois-Quart Putrescent contaminé : embauche au prix du poste (40 000 po). */
const INFECTED: SheetRaisedDead = {
  id: "raised-home-1",
  number: 12,
  name: "Grommit",
  position: ROTTER,
  positionName: "Contaminé (Trois-Quart Putrescent)",
  stats: { ma: 5, st: 3, ag: 4, pa: 6, av: 9 },
  skills: "contagieux,decay",
  cost: 40_000,
  victimId: "a1",
  source: "plague_ridden",
  hireCost: 40_000,
};

const NURGLE: SheetTeam = {
  teamId: "team-home",
  name: "Pustules de Bordeleaux",
  roster: "nurgle",
  raceName: "Nurgle",
  coachName: "Ombrelame",
  teamValue: 1000,
  currentValue: 1000,
  treasury: 100_000,
  players: [
    {
      id: "h1",
      number: 1,
      name: "Pourri 1",
      position: ROTTER,
      positionName: "Trois-Quart Putrescent",
      dead: false,
      missNextMatch: false,
      spp: 0,
      skills: "contagieux,decay",
    },
  ],
};

const VICTIM = {
  id: "a1",
  number: 1,
  name: "Grommit",
  positionName: "Trois-quart",
};

const EMPTY_POST: PostMatchValues = {
  winningsHomeManual: null,
  winningsAwayManual: null,
  dedicatedFansDeltaHome: 0,
  dedicatedFansDeltaAway: 0,
  rankingBonusHome: null,
  rankingBonusAway: null,
  sppBonus: [],
  motmPlayerIds: [],
  costlyErrorsHome: [],
  costlyErrorsAway: [],
  purchasesHome: [],
  purchasesAway: [],
  firedPlayerIds: [],
};

describe("raisedDeadWording", () => {
  it("Contagieux parle de Contaminé au prix du poste ; sans source, c'est un mort relevé gratuit", () => {
    expect(raisedDeadWording("plague_ridden")).toEqual({
      emoji: "☣️",
      rule: "Contagieux",
      noun: "Contaminé",
      purchaseLabel: "Contaminé (prix du poste)",
      free: false,
    });
    expect(raisedDeadWording("masters_of_undeath").free).toBe(true);
    // Serveur antérieur (pas de `source`) : seule Maîtres existait.
    expect(raisedDeadWording(undefined)).toEqual(
      raisedDeadWording("masters_of_undeath"),
    );
  });
});

describe("RaiseDeadPanel — Contagieux", () => {
  it("décrit la règle du côté, nomme le Contaminé et annonce l'embauche au prix du poste", () => {
    render(
      <RaiseDeadPanel
        team={{
          ...NURGLE,
          raiseDead: {
            sources: ["plague_ridden"],
            victims: [{ ...VICTIM, source: "plague_ridden" }],
            positions: [{ slug: ROTTER, name: "Trois-Quart Putrescent" }],
            choice: { victimId: "a1", position: null },
            canHire: true,
          },
          raisedDead: INFECTED,
        }}
        side="home"
        editable
        onChoose={() => {}}
      />,
    );
    const panel = screen.getByTestId("raise-dead-home");
    expect(panel.textContent).toContain("Contagieux");
    expect(panel.textContent).not.toContain("Maîtres de la Non-vie");
    expect(panel.textContent).toContain("Contaminé :");
    const reserve = screen.getByTestId("raise-dead-raised-home").textContent;
    expect(reserve).toContain("Contaminé (prix du poste)");
    expect(reserve).toContain("40 k");
    expect(reserve).not.toContain("gratuit");
    // Un seul Trois-quart : pas de sélecteur de poste.
    expect(screen.queryByTestId("raise-dead-position-home")).toBeNull();
    // Une seule règle : les victimes ne précisent pas laquelle joue.
    const options = within(screen.getByTestId("raise-dead-victim-home"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(options).toEqual(["— aucun —", "N°1 Grommit — Trois-quart"]);
  });

  it("deux règles sur le même côté : chaque victime dit si elle est gratuite ou au prix du poste", () => {
    render(
      <RaiseDeadPanel
        team={{
          ...NURGLE,
          raiseDead: {
            sources: ["masters_of_undeath", "plague_ridden"],
            victims: [
              { ...VICTIM, source: "masters_of_undeath" },
              {
                id: "a2",
                number: 2,
                name: "Costaud",
                positionName: "Bloqueur",
                source: "plague_ridden",
              },
            ],
            positions: [{ slug: ROTTER, name: "Trois-Quart Putrescent" }],
            choice: null,
            canHire: true,
          },
          raisedDead: null,
        }}
        side="home"
        editable
        onChoose={() => {}}
      />,
    );
    expect(screen.getByTestId("raise-dead-home").textContent).toContain(
      "Maîtres de la Non-vie et Contagieux",
    );
    const options = within(screen.getByTestId("raise-dead-victim-home"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(options).toEqual([
      "— aucun —",
      "N°1 Grommit — Trois-quart (gratuit)",
      "N°2 Costaud — Bloqueur (prix du poste)",
    ]);
  });
});

describe("PlayerSelect — Contaminé", () => {
  it("le propose sous ☣️ comme acteur / cible d'évènement", () => {
    render(
      <PlayerSelect
        team={{ ...NURGLE, raisedDead: INFECTED }}
        value=""
        onChange={() => {}}
        testId="ps"
      />,
    );
    const texts = within(screen.getByTestId("ps"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(texts).toContain(
      "☣️ N°12 Grommit — Contaminé (Trois-Quart Putrescent)",
    );
  });
});

describe("PostMatchPanel — embauche du Contaminé AU PRIX du poste", () => {
  const nurgleWithInfected: SheetTeam = {
    ...NURGLE,
    raiseDead: {
      sources: ["plague_ridden"],
      victims: [],
      positions: [{ slug: ROTTER, name: "Trois-Quart Putrescent" }],
      choice: { victimId: "a1", position: null },
      canHire: true,
    },
    raisedDead: INFECTED,
  };

  it("propose le type « Contaminé (prix du poste) » et pré-remplit le coût du poste", () => {
    render(
      <PostMatchPanel
        initial={{
          ...EMPTY_POST,
          purchasesHome: [{ kind: "player", name: "", cost: 0 }],
        }}
        home={nurgleWithInfected}
        away={null}
        onSave={vi.fn()}
      />,
    );
    const kinds = within(screen.getByTestId("purchases-home-kind-0"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(kinds).toContain("Contaminé (prix du poste)");
    expect(kinds).not.toContain("Mort relevé (gratuit)");

    fireEvent.change(screen.getByTestId("purchases-home-kind-0"), {
      target: { value: "raised_dead" },
    });
    expect(screen.getByTestId("purchases-home-raised-0").textContent).toContain(
      "☣️ N°12 Grommit",
    );
    expect(
      (screen.getByTestId("purchases-home-cost-0") as HTMLInputElement).value,
    ).toBe("40000");
    // Le prix catalogue est celui du poste : 0 saisi est signalé.
    fireEvent.change(screen.getByTestId("purchases-home-cost-0"), {
      target: { value: "0" },
    });
    expect(
      screen.getByTestId("purchases-home-cost-hint-0").textContent,
    ).toContain("Prix catalogue");
  });

  it("le rappel de l'étape 4 annonce le prix, jamais « gratuitement », et l'ajoute au bon coût", () => {
    render(
      <PostMatchPanel
        initial={EMPTY_POST}
        home={nurgleWithInfected}
        away={null}
        onSave={vi.fn()}
      />,
    );
    const hint = screen.getByTestId("raise-dead-hire-hint-home").textContent;
    expect(hint).toContain("☣️");
    expect(hint).toContain("contaminé");
    expect(hint).toContain("40 k");
    expect(hint).not.toContain("gratuitement");

    fireEvent.click(screen.getByTestId("raise-dead-hire-add-home"));
    expect(
      (screen.getByTestId("purchases-home-kind-0") as HTMLSelectElement).value,
    ).toBe("raised_dead");
    expect(
      (screen.getByTestId("purchases-home-cost-0") as HTMLInputElement).value,
    ).toBe("40000");
  });
});
