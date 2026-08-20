import { describe, expect, it } from "vitest";
import {
  buildStarPlayerCardData,
  buildTeamPlayerCardData,
  CARD_LABELS,
  decodeCardPayload,
  encodeCardPayload,
  formatGoldAmount,
  hexFromColorNumber,
  isLightColor,
  MAX_ENCODED_PAYLOAD_LENGTH,
  nameFontSize,
  shadeHexColor,
  slugifyForFileName,
  truncateAtWord,
  type PlayerCardData,
} from "./card-model";

const BASE_STAR = {
  displayName: "Grip Soberwall the Third",
  cost: 1_000_000,
  ma: 8,
  st: 5,
  ag: 2,
  pa: 2,
  av: 10,
  skills: "block,dodge,guard,stand-firm",
  isMegaStar: true,
  specialRule: "Règle spéciale de test.",
  specialRuleEn: "Test special rule.",
};

const BASE_PLAYER = {
  name: "Kratch Déverminé",
  number: 4,
  ma: 9,
  st: 3,
  ag: 2,
  pa: 4,
  av: 8,
  skills: "block,dodge",
  spp: 24,
  matchesPlayed: 12,
  totalTouchdowns: 7,
  totalCasualties: 3,
};

function validCard(): PlayerCardData {
  return buildTeamPlayerCardData(BASE_PLAYER, {
    lang: "fr",
    positionName: "Blitzer",
    teamName: "Les Rats des Égouts",
    rosterName: "Skavens",
    rosterSlug: "skaven",
    cost: 90_000,
  });
}

describe("formatGoldAmount", () => {
  it("insère des séparateurs de milliers", () => {
    expect(formatGoldAmount(1_000_000)).toBe("1 000 000");
    expect(formatGoldAmount(90_000)).toBe("90 000");
    expect(formatGoldAmount(500)).toBe("500");
  });

  it("borne les valeurs négatives et décimales", () => {
    expect(formatGoldAmount(-5)).toBe("0");
    expect(formatGoldAmount(1234.9)).toBe("1 234");
  });
});

describe("truncateAtWord", () => {
  it("laisse intact un texte court", () => {
    expect(truncateAtWord("court", 20)).toBe("court");
  });

  it("coupe au mot avec une ellipse", () => {
    const out = truncateAtWord("un texte vraiment beaucoup trop long", 24);
    expect(out.length).toBeLessThanOrEqual(24);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toContain("beaucoup");
  });
});

describe("slugifyForFileName", () => {
  it("translittère accents et espaces", () => {
    expect(slugifyForFileName("Grip Sobërwall the Third")).toBe(
      "grip-soberwall-the-third",
    );
  });

  it("replie sur 'joueur' quand tout est filtré", () => {
    expect(slugifyForFileName("???")).toBe("joueur");
  });
});

describe("nameFontSize", () => {
  it("réduit la taille pour les noms longs", () => {
    expect(nameFontSize("Court")).toBe(66);
    expect(nameFontSize("Grip Soberwall the Third")).toBe(56);
    expect(nameFontSize("Un Nom Vraiment Très Long De Star")).toBe(40);
  });
});

describe("couleurs", () => {
  it("convertit un entier 24 bits en hex", () => {
    expect(hexFromColorNumber(0xa3122e)).toBe("#a3122e");
    expect(hexFromColorNumber(0)).toBe("#000000");
  });

  it("assombrit et éclaircit", () => {
    expect(shadeHexColor("#808080", -1)).toBe("#000000");
    expect(shadeHexColor("#808080", 1)).toBe("#ffffff");
    expect(shadeHexColor("#a3122e", 0)).toBe("#a3122e");
  });

  it("détecte les couleurs claires", () => {
    expect(isLightColor("#f5e642")).toBe(true);
    expect(isLightColor("#101b33")).toBe(false);
  });
});

describe("buildStarPlayerCardData", () => {
  it("assemble une carte star complète en français", () => {
    const card = buildStarPlayerCardData(BASE_STAR, {
      lang: "fr",
      playsFor: ["Humains", "Noblesse Impériale"],
    });
    expect(card.kind).toBe("star");
    expect(card.name).toBe("Grip Soberwall the Third");
    expect(card.kindLabel).toBe(CARD_LABELS.fr.starPlayer);
    expect(card.ribbon).toBe(CARD_LABELS.fr.megaStar);
    expect(card.stats).toEqual({ ma: 8, st: 5, ag: 2, pa: 2, av: 10 });
    expect(card.skills).toContain("Blocage");
    expect(card.cost).toBe(1_000_000);
    expect(card.costLabel).toBe(CARD_LABELS.fr.cost);
    expect(card.infoTitle).toBe(CARD_LABELS.fr.specialRule);
    expect(card.infoText).toBe("Règle spéciale de test.");
  });

  it("bascule règle et compétences en anglais", () => {
    const card = buildStarPlayerCardData(BASE_STAR, {
      lang: "en",
      playsFor: ["Humans"],
    });
    expect(card.infoText).toBe("Test special rule.");
    expect(card.skills).toContain("Block");
  });

  it("respecte le coût forcé (paire) et l'absence de ruban", () => {
    const card = buildStarPlayerCardData(
      { ...BASE_STAR, isMegaStar: false },
      { lang: "fr", playsFor: [], cost: 380_000 },
    );
    expect(card.cost).toBe(380_000);
    expect(card.ribbon).toBeUndefined();
  });
});

describe("buildTeamPlayerCardData", () => {
  it("assemble une carte joueur avec carrière", () => {
    const card = validCard();
    expect(card.kind).toBe("team");
    expect(card.kindLabel).toBe("Blitzer");
    expect(card.number).toBe(4);
    expect(card.rosterSlug).toBe("skaven");
    expect(card.playsFor).toEqual(["Les Rats des Égouts", "Skavens"]);
    expect(card.costLabel).toBe(CARD_LABELS.fr.value);
    expect(card.infoStats).toEqual([
      { label: "MATCHS", value: "12" },
      { label: "TD", value: "7" },
      { label: "SORTIES", value: "3" },
      { label: "PSP", value: "24" },
    ]);
  });

  it("pose le ruban décédé / licencié", () => {
    const dead = buildTeamPlayerCardData(
      { ...BASE_PLAYER, dead: true },
      {
        lang: "fr",
        positionName: "Blitzer",
        teamName: "T",
        rosterSlug: "skaven",
        cost: null,
      },
    );
    expect(dead.ribbon).toBe(CARD_LABELS.fr.deceased);

    const fired = buildTeamPlayerCardData(
      { ...BASE_PLAYER, firedAt: "2026-01-01T00:00:00Z" },
      {
        lang: "en",
        positionName: "Blitzer",
        teamName: "T",
        rosterSlug: "skaven",
        cost: null,
      },
    );
    expect(fired.ribbon).toBe(CARD_LABELS.en.released);
  });

  it("tolère les champs carrière absents", () => {
    const card = buildTeamPlayerCardData(
      {
        name: "Rookie",
        number: 9,
        ma: 6,
        st: 3,
        ag: 3,
        pa: null,
        av: 9,
        skills: "",
      },
      {
        lang: "fr",
        positionName: "Trois-quart",
        teamName: "T",
        rosterSlug: "human",
        cost: 50_000,
      },
    );
    expect(card.infoStats?.every((s) => s.value === "0")).toBe(true);
    expect(card.stats.pa).toBeNull();
    expect(card.skills).toEqual([]);
  });
});

describe("encode / decode du payload", () => {
  it("fait un aller-retour sans perte", () => {
    const card = validCard();
    const decoded = decodeCardPayload(encodeCardPayload(card));
    expect(decoded).toEqual(card);
  });

  it("supporte l'unicode (accents, ellipses)", () => {
    const card: PlayerCardData = {
      ...validCard(),
      name: "Éloïse Cœur-de-Bloc…",
    };
    expect(decodeCardPayload(encodeCardPayload(card))?.name).toBe(
      "Éloïse Cœur-de-Bloc…",
    );
  });

  it("rejette null, le garbage et le JSON non-objet", () => {
    expect(decodeCardPayload(null)).toBeNull();
    expect(decodeCardPayload("")).toBeNull();
    expect(decodeCardPayload("%%%invalid%%%")).toBeNull();
    expect(decodeCardPayload(encodeCardPayload(42 as never))).toBeNull();
  });

  it("rejette un payload trop long", () => {
    expect(
      decodeCardPayload("a".repeat(MAX_ENCODED_PAYLOAD_LENGTH + 1)),
    ).toBeNull();
  });

  it("rejette les champs obligatoires manquants ou hors bornes", () => {
    const card = validCard();
    const noName = { ...card, name: "" };
    expect(decodeCardPayload(encodeCardPayload(noName))).toBeNull();
    const badStats = { ...card, stats: { ...card.stats, ma: 999 } };
    expect(decodeCardPayload(encodeCardPayload(badStats))).toBeNull();
  });

  it("borne les listes et filtre les slugs roster invalides", () => {
    const card = {
      ...validCard(),
      skills: Array.from({ length: 60 }, (_, i) => `Compétence ${i}`),
      rosterSlug: "../etc/passwd",
      ribbon: "X".repeat(200),
    };
    const decoded = decodeCardPayload(encodeCardPayload(card));
    expect(decoded).not.toBeNull();
    expect(decoded!.skills.length).toBeLessThanOrEqual(24);
    expect(decoded!.rosterSlug).toBeUndefined();
    expect(decoded!.ribbon!.length).toBeLessThanOrEqual(24);
  });

  it("neutralise les caractères de contrôle", () => {
    const card = { ...validCard(), name: "Bad\u0007Name" };
    const decoded = decodeCardPayload(encodeCardPayload(card));
    expect(decoded!.name).toBe("Bad Name");
  });

  it("tronque le texte libre trop long", () => {
    const card = {
      ...validCard(),
      infoStats: undefined,
      infoText: "mot ".repeat(400),
    };
    const decoded = decodeCardPayload(encodeCardPayload(card));
    expect(decoded!.infoText!.length).toBeLessThanOrEqual(340);
    expect(decoded!.infoText!.endsWith("…")).toBe(true);
  });
});
