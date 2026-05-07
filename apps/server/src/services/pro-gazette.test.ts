import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proGazetteArticle: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      groupBy: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "../prisma";
import {
  GazetteValidationError,
  createArticles,
  listEditionDates,
  listEditionForDate,
  listLatestEdition,
} from "./pro-gazette";

interface MockedPrisma {
  proGazetteArticle: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
}
const mocked = prisma as unknown as MockedPrisma;

beforeEach(() => {
  vi.clearAllMocks();
  mocked.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn(prisma),
  );
});

describe("listEditionForDate — sprint 1.E.2", () => {
  it("rejette format date invalide", async () => {
    await expect(listEditionForDate("not-a-date")).rejects.toThrow(
      GazetteValidationError,
    );
    await expect(listEditionForDate("2026-13-01")).rejects.toThrow();
  });

  it("renvoie articles d'une journée triés MAIN > BREVE > EDITO", async () => {
    const day = new Date("2026-09-15T00:00:00Z");
    mocked.proGazetteArticle.findMany.mockResolvedValue([
      {
        id: "a_breve",
        date: day,
        type: "BREVE",
        persona: null,
        title: "Brève",
        body: "...",
        relatedTeamIds: null,
        relatedPlayerIds: null,
        createdAt: new Date("2026-09-15T08:00:00Z"),
      },
      {
        id: "a_edito",
        date: day,
        type: "EDITO",
        persona: "cynic",
        title: "Édito",
        body: "...",
        relatedTeamIds: null,
        relatedPlayerIds: null,
        createdAt: new Date("2026-09-15T08:01:00Z"),
      },
      {
        id: "a_main",
        date: day,
        type: "MAIN",
        persona: "statistician",
        title: "Article principal",
        body: "...",
        relatedTeamIds: ["buf", "kc"],
        relatedPlayerIds: null,
        createdAt: new Date("2026-09-15T08:02:00Z"),
      },
    ]);
    const out = await listEditionForDate("2026-09-15");
    expect(out.date).toBe("2026-09-15");
    expect(out.articles[0].type).toBe("MAIN");
    expect(out.articles[0].relatedTeamIds).toEqual(["buf", "kc"]);
    expect(out.articles[1].type).toBe("BREVE");
    expect(out.articles[2].type).toBe("EDITO");
  });

  it("parse relatedTeamIds depuis JSON string (sqlite mirror)", async () => {
    const day = new Date("2026-09-15T00:00:00Z");
    mocked.proGazetteArticle.findMany.mockResolvedValue([
      {
        id: "a1",
        date: day,
        type: "MAIN",
        persona: null,
        title: "T",
        body: "B",
        relatedTeamIds: '["buf","kc"]',
        relatedPlayerIds: null,
        createdAt: day,
      },
    ]);
    const out = await listEditionForDate("2026-09-15");
    expect(out.articles[0].relatedTeamIds).toEqual(["buf", "kc"]);
  });
});

describe("listLatestEdition — sprint 1.E.2", () => {
  it("null si aucun article publié", async () => {
    mocked.proGazetteArticle.findFirst.mockResolvedValue(null);
    expect(await listLatestEdition()).toBeNull();
  });

  it("renvoie l'édition de la dernière date", async () => {
    const latestDate = new Date("2026-09-15T00:00:00Z");
    mocked.proGazetteArticle.findFirst.mockResolvedValue({
      date: latestDate,
    });
    mocked.proGazetteArticle.findMany.mockResolvedValue([
      {
        id: "a1",
        date: latestDate,
        type: "MAIN",
        persona: null,
        title: "T",
        body: "B",
        relatedTeamIds: null,
        relatedPlayerIds: null,
        createdAt: latestDate,
      },
    ]);
    const out = await listLatestEdition();
    expect(out?.date).toBe("2026-09-15");
    expect(out?.articles).toHaveLength(1);
  });
});

describe("listEditionDates — sprint 1.E.2", () => {
  it("rejette limit invalide", async () => {
    await expect(listEditionDates(0)).rejects.toThrow(GazetteValidationError);
    await expect(listEditionDates(500)).rejects.toThrow();
  });

  it("renvoie les dates au format YYYY-MM-DD", async () => {
    mocked.proGazetteArticle.groupBy.mockResolvedValue([
      { date: new Date("2026-09-15T00:00:00Z") },
      { date: new Date("2026-09-14T00:00:00Z") },
    ]);
    const out = await listEditionDates();
    expect(out).toEqual(["2026-09-15", "2026-09-14"]);
  });
});

describe("createArticles — sprint 1.E.2", () => {
  async function expectCode(p: Promise<unknown>, code: string) {
    try {
      await p;
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(GazetteValidationError);
      expect((err as GazetteValidationError).code).toBe(code);
    }
  }

  it("rejette payload vide", async () => {
    await expectCode(
      createArticles({ date: "2026-09-15", articles: [] }),
      "INVALID_PAYLOAD",
    );
  });

  it("rejette type invalide", async () => {
    await expectCode(
      createArticles({
        date: "2026-09-15",
        articles: [
          {
            // @ts-expect-error type invalide volontaire
            type: "FOOBAR",
            title: "T",
            body: "B",
          },
        ],
      }),
      "INVALID_TYPE",
    );
  });

  it("rejette EDITO sans persona", async () => {
    await expectCode(
      createArticles({
        date: "2026-09-15",
        articles: [{ type: "EDITO", title: "T", body: "B" }],
      }),
      "EDITO_REQUIRES_PERSONA",
    );
  });

  it("rejette persona invalide", async () => {
    await expectCode(
      createArticles({
        date: "2026-09-15",
        articles: [
          {
            type: "EDITO",
            // @ts-expect-error persona invalide volontaire
            persona: "alien",
            title: "T",
            body: "B",
          },
        ],
      }),
      "INVALID_PERSONA",
    );
  });

  it("rejette title/body vides", async () => {
    await expectCode(
      createArticles({
        date: "2026-09-15",
        articles: [{ type: "MAIN", title: "", body: "B" }],
      }),
      "INVALID_TITLE",
    );
  });

  it("crée plusieurs articles atomiques", async () => {
    let i = 0;
    mocked.proGazetteArticle.create.mockImplementation(async () => ({
      id: `a${i++}`,
    }));
    const out = await createArticles({
      date: "2026-09-15",
      articles: [
        {
          type: "MAIN",
          persona: "statistician",
          title: "Stats du jour",
          body: "...",
          relatedTeamIds: ["buf"],
        },
        {
          type: "EDITO",
          persona: "cynic",
          title: "Tout va mal",
          body: "...",
        },
      ],
    });
    expect(out).toHaveLength(2);
    expect(mocked.proGazetteArticle.create).toHaveBeenCalledTimes(2);
  });
});
