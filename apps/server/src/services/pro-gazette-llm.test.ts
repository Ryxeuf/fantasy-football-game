import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./pro-gazette-recap", () => ({
  getDailyRecap: vi.fn(),
}));

vi.mock("./pro-gazette", () => ({
  createArticles: vi.fn(),
  listEditionForDate: vi.fn(),
}));

vi.mock("./anthropic-client", () => ({
  callClaude: vi.fn(),
  AnthropicError: class extends Error {
    code: string;
    constructor(code: string, msg: string) {
      super(msg);
      this.code = code;
    }
  },
}));

import { getDailyRecap, type DailyRecap } from "./pro-gazette-recap";
import { createArticles, listEditionForDate } from "./pro-gazette";
import { callClaude } from "./anthropic-client";
import {
  GazetteLLMError,
  buildUserPrompt,
  generateEditionForDate,
  parseLLMResponse,
} from "./pro-gazette-llm";

const mockedRecap = vi.mocked(getDailyRecap);
const mockedListEdition = vi.mocked(listEditionForDate);
const mockedCreate = vi.mocked(createArticles);
const mockedCall = vi.mocked(callClaude);

const RECAP_FIXTURE: DailyRecap = {
  fromAt: "2026-05-06T00:00:00.000Z",
  toAt: "2026-05-07T00:00:00.000Z",
  matchesPlayed: 1,
  matches: [
    {
      id: "m1",
      homeTeamSlug: "buf-snow-ogres",
      homeTeamName: "Buffalo Snow Ogres",
      awayTeamSlug: "gb-cheese-halflings",
      awayTeamName: "Green Bay Cheese Halflings",
      scoreHome: 4,
      scoreAway: 0,
      outcome: "home",
      touchdownCount: 4,
      casualtyCount: 5,
      nuffleCount: 1,
      playedAt: "2026-05-06T20:00:00.000Z",
    },
  ],
  standings: [
    {
      teamSlug: "buf-snow-ogres",
      teamName: "Buffalo Snow Ogres",
      played: 5,
      wins: 5,
      draws: 0,
      losses: 0,
      points: 15,
      rank: 1,
    },
  ],
  storylines: [
    {
      type: "blowout",
      weight: 8,
      refs: { matchId: "m1", winner: "buf-snow-ogres" },
      summary: "Buffalo ecrase Green Bay 4-0",
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildUserPrompt — sprint 1.E.1", () => {
  it("inclut date + matchs + standings + storylines", () => {
    const prompt = buildUserPrompt({
      recap: RECAP_FIXTURE,
      date: "2026-05-06",
    });
    expect(prompt).toContain("2026-05-06");
    expect(prompt).toContain("Buffalo Snow Ogres");
    expect(prompt).toContain("buf-snow-ogres");
    expect(prompt).toContain("blowout");
    expect(prompt).toContain('"score": "4-0"');
    expect(prompt).toContain("MAIN");
  });

  // Q.A.4 — Tests enrichissement rivalry_buildup
  it("expose les refs de rivalry_buildup au LLM (Q.A.4)", () => {
    const recapWithRivalry: DailyRecap = {
      ...RECAP_FIXTURE,
      storylines: [
        ...RECAP_FIXTURE.storylines,
        {
          type: "rivalry_buildup",
          weight: 90,
          refs: {
            matchId: "m1",
            home: "buf-snow-ogres",
            away: "kc-soaring-hawks",
            priorCount: 3,
            since: "2026-08-25",
            suggestedPersona: "statistician",
            winsHome: 2,
            winsAway: 0,
            drawsHistorical: 1,
            streakKind: "win",
            streakLength: 2,
          },
          summary:
            "Buffalo et KC : 4e affrontement. Bilan : 2-1-0 pour Buffalo.",
        },
      ],
    };
    const prompt = buildUserPrompt({
      recap: recapWithRivalry,
      date: "2026-05-06",
    });
    // Le prompt doit contenir les refs (winsHome/winsAway/streakKind)
    expect(prompt).toContain("rivalry_buildup");
    expect(prompt).toContain('"winsHome": 2');
    expect(prompt).toContain('"streakKind": "win"');
    expect(prompt).toContain('"suggestedPersona": "statistician"');
    // Et l'instruction supplementaire pour le statistician
    expect(prompt).toContain("EDITO 'statistician'");
  });

  it("n'ajoute pas d'instruction statistician si pas de rivalry_buildup", () => {
    const prompt = buildUserPrompt({
      recap: RECAP_FIXTURE,
      date: "2026-05-06",
    });
    expect(prompt).not.toContain("EDITO 'statistician'");
  });

  it("n'expose pas les refs pour les autres types de storyline", () => {
    const prompt = buildUserPrompt({
      recap: RECAP_FIXTURE,
      date: "2026-05-06",
    });
    // RECAP_FIXTURE a un blowout avec refs.matchId mais on ne doit
    // pas l'exposer (seul rivalry_buildup expose ses refs).
    expect(prompt).toContain('"summary":');
    expect(prompt).not.toContain('"matchId": "m1"');
  });
});

function expectCode(fn: () => unknown, code: string): void {
  try {
    fn();
    throw new Error("expected throw");
  } catch (err) {
    expect(err).toBeInstanceOf(GazetteLLMError);
    expect((err as GazetteLLMError).code).toBe(code);
  }
}

describe("parseLLMResponse — sprint 1.E.1", () => {
  it("parse une reponse valide", () => {
    const json = JSON.stringify({
      articles: [
        {
          type: "MAIN",
          persona: null,
          title: "Buffalo broie Green Bay",
          body: "Une victoire totale ce soir...",
          relatedTeamSlugs: ["buf-snow-ogres"],
        },
        {
          type: "EDITO",
          persona: "cynic",
          title: "Cynic edito",
          body: "Tout cela etait previsible...",
          relatedTeamSlugs: [],
        },
      ],
    });
    const out = parseLLMResponse(json);
    expect(out).toHaveLength(2);
    expect(out[0].type).toBe("MAIN");
    expect(out[0].persona).toBeNull();
    expect(out[0].relatedTeamIds).toEqual(["buf-snow-ogres"]);
    expect(out[1].type).toBe("EDITO");
    expect(out[1].persona).toBe("cynic");
  });

  it("tolere les fences ```json", () => {
    const fenced = '```json\n{"articles":[{"type":"BREVE","persona":null,"title":"t","body":"b"}]}\n```';
    const out = parseLLMResponse(fenced);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("BREVE");
  });

  it("INVALID_JSON sur garbage", () => {
    expectCode(() => parseLLMResponse("not json"), "INVALID_JSON");
  });

  it("INVALID_SHAPE si pas d'articles", () => {
    expectCode(() => parseLLMResponse('{"foo": 1}'), "INVALID_SHAPE");
  });

  it("NO_ARTICLES si articles vide", () => {
    expectCode(() => parseLLMResponse('{"articles": []}'), "NO_ARTICLES");
  });

  it("INVALID_TYPE rejette des types inconnus", () => {
    expectCode(
      () =>
        parseLLMResponse(
          JSON.stringify({
            articles: [{ type: "NEWSFLASH", title: "t", body: "b" }],
          }),
        ),
      "INVALID_TYPE",
    );
  });

  it("EDITO_REQUIRES_PERSONA si edito sans persona", () => {
    expectCode(
      () =>
        parseLLMResponse(
          JSON.stringify({
            articles: [{ type: "EDITO", persona: null, title: "t", body: "b" }],
          }),
        ),
      "EDITO_REQUIRES_PERSONA",
    );
  });

  it("INVALID_PERSONA si persona inconnue", () => {
    expectCode(
      () =>
        parseLLMResponse(
          JSON.stringify({
            articles: [
              { type: "MAIN", persona: "alien", title: "t", body: "b" },
            ],
          }),
        ),
      "INVALID_PERSONA",
    );
  });

  it("INVALID_TITLE rejette title vide", () => {
    expectCode(
      () =>
        parseLLMResponse(
          JSON.stringify({
            articles: [{ type: "MAIN", persona: null, title: "", body: "b" }],
          }),
        ),
      "INVALID_TITLE",
    );
  });

  it("filtre relatedTeamSlugs non-string + default []", () => {
    const out = parseLLMResponse(
      JSON.stringify({
        articles: [
          {
            type: "BREVE",
            persona: null,
            title: "t",
            body: "b",
            relatedTeamSlugs: ["ok", 42, null, "ok2"],
          },
        ],
      }),
    );
    expect(out[0].relatedTeamIds).toEqual(["ok", "ok2"]);
  });
});

describe("generateEditionForDate — sprint 1.E.1", () => {
  it("skip si edition existe deja", async () => {
    mockedListEdition.mockResolvedValue({
      date: "2026-05-06",
      articles: [
        {
          id: "a1",
          date: "2026-05-06",
          type: "MAIN",
          persona: null,
          title: "t",
          body: "b",
          relatedTeamIds: [],
          relatedPlayerIds: [],
          createdAt: "2026-05-07T00:00:00.000Z",
        },
      ],
    });
    const out = await generateEditionForDate({
      date: new Date("2026-05-06T00:00:00Z"),
    });
    expect(out.skipped).toBe(true);
    expect(out.skipReason).toBe("edition_already_exists");
    expect(mockedRecap).not.toHaveBeenCalled();
    expect(mockedCall).not.toHaveBeenCalled();
  });

  it("skip si recap.matchesPlayed=0", async () => {
    mockedListEdition.mockResolvedValue(null);
    mockedRecap.mockResolvedValue({
      ...RECAP_FIXTURE,
      matchesPlayed: 0,
      matches: [],
    });
    const out = await generateEditionForDate({
      date: new Date("2026-05-06T00:00:00Z"),
    });
    expect(out.skipped).toBe(true);
    expect(out.skipReason).toBe("no_matches");
    expect(mockedCall).not.toHaveBeenCalled();
  });

  it("genere + persiste + retourne ids", async () => {
    mockedListEdition.mockResolvedValue(null);
    mockedRecap.mockResolvedValue(RECAP_FIXTURE);
    mockedCall.mockResolvedValue({
      text: JSON.stringify({
        articles: [
          {
            type: "MAIN",
            persona: null,
            title: "T1",
            body: "B1",
            relatedTeamSlugs: [],
          },
          {
            type: "EDITO",
            persona: "cynic",
            title: "T2",
            body: "B2",
            relatedTeamSlugs: [],
          },
        ],
      }),
      usage: { inputTokens: 10, outputTokens: 20 },
    });
    mockedCreate.mockResolvedValue(["id1", "id2"]);
    const out = await generateEditionForDate({
      date: new Date("2026-05-06T00:00:00Z"),
    });
    expect(out.skipped).toBe(false);
    expect(out.created).toBe(2);
    expect(out.articleIds).toEqual(["id1", "id2"]);
    expect(mockedCreate).toHaveBeenCalledWith({
      date: "2026-05-06",
      articles: expect.any(Array),
    });
    const passedArticles = mockedCreate.mock.calls[0][0].articles;
    expect(passedArticles).toHaveLength(2);
  });

  it("propage erreur LLM (pas swallow)", async () => {
    mockedListEdition.mockResolvedValue(null);
    mockedRecap.mockResolvedValue(RECAP_FIXTURE);
    mockedCall.mockRejectedValue(new Error("network"));
    await expect(
      generateEditionForDate({
        date: new Date("2026-05-06T00:00:00Z"),
      }),
    ).rejects.toThrow(/network/);
  });

  it("propage GazetteLLMError si parse fail", async () => {
    mockedListEdition.mockResolvedValue(null);
    mockedRecap.mockResolvedValue(RECAP_FIXTURE);
    mockedCall.mockResolvedValue({ text: "not json" });
    await expect(
      generateEditionForDate({
        date: new Date("2026-05-06T00:00:00Z"),
      }),
    ).rejects.toBeInstanceOf(GazetteLLMError);
  });
});
