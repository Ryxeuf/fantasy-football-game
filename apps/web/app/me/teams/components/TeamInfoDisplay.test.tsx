/**
 * La section historiquement titrée « Informations de l'équipe » liste le
 * staff (relances, pom-pom girls, assistants, apothicaire, fans dévoués) :
 * son titre est désormais « Staff de l'équipe ».
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import TeamInfoDisplay from "./TeamInfoDisplay";
import { LanguageProvider } from "../../../contexts/LanguageContext";

/** `toLocaleString("fr-FR")` sépare les milliers avec U+202F : on normalise. */
function normalizeSpaces(text: string | null): string {
  return (text ?? "").replace(/[\u202f\u00a0]/g, " ");
}

const INFO = {
  treasury: 30_000,
  rerolls: 2,
  cheerleaders: 1,
  assistants: 1,
  apothecary: true,
  dedicatedFans: 1,
  teamValue: 1_000_000,
  currentValue: 990_000,
  roster: "skaven",
};

afterEach(() => {
  localStorage.clear();
});

describe("TeamInfoDisplay — titre de section", () => {
  it("affiche « Staff de l'équipe » (et plus « Informations de l'équipe »)", () => {
    render(
      <LanguageProvider>
        <TeamInfoDisplay info={INFO} />
      </LanguageProvider>,
    );
    expect(screen.getByText("Staff de l'équipe")).toBeTruthy();
    expect(screen.queryByText("Informations de l'équipe")).toBeNull();
  });

  it("sort les fans dévoués du total staff, mais dit ce qu'ils ont coûté", () => {
    render(
      <LanguageProvider>
        <TeamInfoDisplay
          info={{ ...INFO, dedicatedFans: 3, dedicatedFansCost: 10_000 }}
        />
      </LanguageProvider>,
    );
    // Les fans dévoués ne comptent ni dans la VE ni dans la VEA : ils ne
    // sont plus dans le total (ancien testid retiré)…
    expect(screen.queryByTestId("dedicated-fans-cost")).toBeNull();
    // …mais l'or dépensé pour eux reste affiché, hors total, sinon il
    // manque au budget sans explication.
    expect(
      normalizeSpaces(
        screen.getByTestId("staff-dedicated-fans-cost").textContent,
      ),
    ).toBe("10K po");
    expect(
      normalizeSpaces(screen.getByTestId("staff-rerolls-cost").textContent),
    ).toBe("170K po");
  });

  it("n'affiche aucune ligne fans quand le premier (offert) est le seul", () => {
    render(
      <LanguageProvider>
        <TeamInfoDisplay info={{ ...INFO, dedicatedFans: 1 }} />
      </LanguageProvider>,
    );
    expect(screen.queryByTestId("staff-dedicated-fans-cost")).toBeNull();
  });

  it("le total staff & relances ignore les fans dévoués", () => {
    const renderWithFans = (dedicatedFans: number) => {
      const { container, unmount } = render(
        <LanguageProvider>
          <TeamInfoDisplay info={{ ...INFO, dedicatedFans }} />
        </LanguageProvider>,
      );
      const text = normalizeSpaces(container.textContent);
      unmount();
      return text;
    };
    // Staff : relances 2×50k + pom-pom 10k + assistant 10k + apo 50k = 170k,
    // identique quel que soit le nombre de fans.
    expect(renderWithFans(1)).toContain("170K po");
    expect(renderWithFans(6)).toContain("170K po");
  });

  it("affiche tous les montants en kpo (aucun montant en po complets)", () => {
    const { container } = render(
      <LanguageProvider>
        <TeamInfoDisplay info={INFO} />
      </LanguageProvider>,
    );
    const text = normalizeSpaces(container.textContent);
    // VE 1 000 000 po -> « 1 000K po » ; trésorerie 30 000 po -> « 30K po ».
    expect(text).toContain("1 000K po");
    expect(text).toContain("30K po");
    // Plus aucun montant en po complets (« 1 000 000 po », « 30 000 po »…).
    expect(text).not.toMatch(/\d{2,3} \d{3} po/);
    expect(text).not.toContain("000 po");
  });

  it("respecte le coût de la config staff quand elle est fournie", () => {
    const { container } = render(
      <LanguageProvider>
        <TeamInfoDisplay
          info={{
            ...INFO,
            dedicatedFans: 2,
            staffConfig: {
              rerollCost: 60_000,
              maxRerolls: 8,
              apothecaryAllowed: true,
              apothecaryCost: 50_000,
              maxCheerleaders: 12,
              cheerleaderCost: 10_000,
              maxAssistants: 6,
              assistantCost: 10_000,
              maxDedicatedFans: 6,
              dedicatedFanCost: 5_000,
            },
          }}
        />
      </LanguageProvider>,
    );
    // Relances 2 × 60 000 po (config DB) = 120 000 po ; total staff
    // 120k + 10k + 10k + 50k = 190k — sans aucune part fans dévoués.
    const text = normalizeSpaces(container.textContent);
    expect(text).toContain("120K po");
    expect(text).toContain("190K po");
  });

  it("affiche « Team staff » en anglais", async () => {
    localStorage.setItem("language", "en");
    render(
      <LanguageProvider>
        <TeamInfoDisplay info={INFO} />
      </LanguageProvider>,
    );
    await waitFor(() => {
      expect(screen.getByText("Team staff")).toBeTruthy();
    });
  });
});

describe("TeamInfoDisplay — coût des joueurs", () => {
  it("affiche le coût joueurs calculé par le serveur quand il est fourni", () => {
    render(
      <LanguageProvider>
        {/* VE stale (1 000k) vs coût joueurs réel (860k) : c'est le champ
            serveur qui doit gagner, pas la dérivation « VE − staff ». */}
        <TeamInfoDisplay info={{ ...INFO, playersCost: 860_000 }} />
      </LanguageProvider>,
    );
    expect(
      normalizeSpaces(screen.getByTestId("staff-players-cost").textContent),
    ).toBe("860K po");
  });

  it("retombe sur « VE − staff » quand le serveur ne fournit rien", () => {
    render(
      <LanguageProvider>
        <TeamInfoDisplay info={INFO} />
      </LanguageProvider>,
    );
    // VE 1 000k − (2×50k relances + 10k + 10k + 50k apothicaire) = 830k
    expect(
      normalizeSpaces(screen.getByTestId("staff-players-cost").textContent),
    ).toBe("830K po");
  });
});

describe("TeamInfoDisplay — coût des Star Players", () => {
  it("affiche une ligne dédiée quand l'équipe en a recruté", () => {
    render(
      <LanguageProvider>
        <TeamInfoDisplay
          info={{ ...INFO, playersCost: 800_000, starPlayersCost: 250_000 }}
        />
      </LanguageProvider>,
    );

    expect(
      normalizeSpaces(screen.getByTestId("staff-star-players-cost").textContent),
    ).toBe("250K po");
    expect(screen.getByText("⭐ Coût des Star Players")).toBeTruthy();
  });

  it("masque la ligne quand aucun Star Player n'est recruté", () => {
    render(
      <LanguageProvider>
        <TeamInfoDisplay info={{ ...INFO, playersCost: 800_000 }} />
      </LanguageProvider>,
    );

    expect(screen.queryByTestId("staff-star-players-cost")).toBeNull();
  });
});

/**
 * Écart VE → VEA.
 *
 * Cas remonté : une équipe Ogre qui n'a joué AUCUN match affichait
 * VE 1 415K / VEA 1 265K sans la moindre explication. L'écart vient
 * entièrement de « Trois-quarts à vil prix », qui annule le Coût
 * d'Embauche des Trois-quarts dans la VEA. La carte doit le dire.
 */
describe("TeamInfoDisplay — écart VE / VEA", () => {
  const OGRE = {
    ...INFO,
    teamValue: 1_415_000,
    currentValue: 1_265_000,
    roster: "ogre",
    playersCost: 1_235_000,
    staffCost: 40_000,
    rerollsCost: 140_000,
  };

  it("chiffre l'exonération « Trois-quarts à vil prix »", () => {
    render(
      <LanguageProvider>
        <TeamInfoDisplay info={{ ...OGRE, cheapLinemenWaived: 150_000 }} />
      </LanguageProvider>,
    );

    expect(
      normalizeSpaces(screen.getByTestId("tv-ctv-cheap-linemen").textContent),
    ).toBe("−150K po");
    expect(screen.getByText("Pourquoi la VEA diffère de la VE")).toBeTruthy();
    // La règle est nommée, pas seulement chiffrée.
    expect(
      screen.getByText(/Trois-quarts à vil prix/),
    ).toBeTruthy();
  });

  it("chiffre les joueurs indisponibles au prochain match", () => {
    render(
      <LanguageProvider>
        <TeamInfoDisplay
          info={{ ...OGRE, currentValue: 1_325_000, unavailablePlayersCost: 90_000 }}
        />
      </LanguageProvider>,
    );

    expect(
      normalizeSpaces(screen.getByTestId("tv-ctv-unavailable").textContent),
    ).toBe("−90K po");
    expect(screen.queryByTestId("tv-ctv-cheap-linemen")).toBeNull();
  });

  it("affiche les deux postes quand ils se cumulent", () => {
    render(
      <LanguageProvider>
        <TeamInfoDisplay
          info={{
            ...OGRE,
            currentValue: 1_175_000,
            cheapLinemenWaived: 150_000,
            unavailablePlayersCost: 90_000,
          }}
        />
      </LanguageProvider>,
    );

    expect(screen.getByTestId("tv-ctv-cheap-linemen")).toBeTruthy();
    expect(screen.getByTestId("tv-ctv-unavailable")).toBeTruthy();
  });

  it("masque le bloc quand VEA et VE ne sont séparées par rien", () => {
    render(
      <LanguageProvider>
        <TeamInfoDisplay
          info={{
            ...OGRE,
            currentValue: OGRE.teamValue,
            cheapLinemenWaived: 0,
            unavailablePlayersCost: 0,
          }}
        />
      </LanguageProvider>,
    );

    expect(screen.queryByTestId("tv-ctv-gap")).toBeNull();
  });

  it("reste muet pour un serveur pré-correctif (champs absents)", () => {
    render(
      <LanguageProvider>
        <TeamInfoDisplay info={OGRE} />
      </LanguageProvider>,
    );

    // Pas d'explication inventée faute de données : mieux vaut rien
    // qu'un chiffre faux.
    expect(screen.queryByTestId("tv-ctv-gap")).toBeNull();
  });
});

/**
 * Le « Résumé global des coûts » totalise la VE. Ses lignes doivent donc
 * s'additionner exactement à la VE affichée juste en dessous — c'est le
 * bloc dont les chiffres étaient jugés « flous et erronés ».
 */
describe("TeamInfoDisplay — résumé global cohérent", () => {
  it("fait tomber joueurs + staff + relances exactement sur la VE", () => {
    render(
      <LanguageProvider>
        <TeamInfoDisplay
          info={{
            ...INFO,
            teamValue: 1_415_000,
            currentValue: 1_265_000,
            playersCost: 1_235_000,
            // Config staff volontairement DIFFÉRENTE des défauts du roster :
            // sans les postes serveur, la re-dérivation locale ferait dériver
            // le total du bloc et l'addition ne tomberait plus sur la VE.
            staffCost: 40_000,
            rerollsCost: 140_000,
            cheapLinemenWaived: 150_000,
          }}
        />
      </LanguageProvider>,
    );

    const players = normalizeSpaces(
      screen.getByTestId("staff-players-cost").textContent,
    );
    const staff = normalizeSpaces(
      screen.getByTestId("staff-rerolls-cost").textContent,
    );
    const ve = normalizeSpaces(screen.getByTestId("global-ve-total").textContent);
    const vea = normalizeSpaces(
      screen.getByTestId("global-vea-total").textContent,
    );

    expect(players).toBe("1 235K po");
    expect(staff).toBe("180K po");
    // 1 235K + 180K = 1 415K : l'addition tombe juste.
    expect(ve).toBe("1 415K po");
    expect(vea).toBe("1 265K po");
  });
});
