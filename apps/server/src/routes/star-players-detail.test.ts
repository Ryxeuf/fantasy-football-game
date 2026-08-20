/**
 * Regression : `GET /star-players/:slug` renvoyait toujours 500
 * (`Failed to fetch star player`) — donc la page publique
 * `/star-players/<slug>` etait inaccessible.
 *
 * Cause : le handler faisait `findUnique({ where: { slug } })` alors que
 * le modele Prisma `StarPlayer` declare `@@unique([slug, ruleset])`.
 * `slug` seul n'est PAS un selecteur unique valide ⇒ Prisma leve une
 * `PrismaClientValidationError` ⇒ catch ⇒ 500.
 *
 * Le mock `findUnique` ci-dessous reproduit fidelement ce comportement :
 * il refuse tout `where` qui n'expose pas le couple `slug_ruleset`.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    starPlayer: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    roster: { findFirst: vi.fn() },
  },
}));

vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import express from "express";
import http from "http";
import starPlayersRouter from "./star-players";
import { prisma } from "../prisma";

interface StarPlayerRow {
  slug: string;
  ruleset: string;
  displayName: string;
  cost: number;
  ma: number;
  st: number;
  ag: number;
  pa: number | null;
  av: number;
  specialRule: string | null;
  imageUrl: string | null;
  isMegaStar: boolean;
  skills: Array<{
    skill: { slug: string; nameFr?: string; nameEn?: string };
  }>;
  hirableBy: Array<{ rule: string; roster: { slug: string } | null }>;
}

function makeRow(slug: string, ruleset: string): StarPlayerRow {
  return {
    slug,
    ruleset,
    displayName: "Bomber Dribblesnot",
    cost: 50000,
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 8,
    specialRule: "Bombardier",
    imageUrl: "/data/Star-Players_files/bomber.png",
    isMegaStar: false,
    skills: [
      { skill: { slug: "bombardier", nameFr: "Bombardier", nameEn: "Bombardier" } },
      { skill: { slug: "dodge", nameFr: "Esquive", nameEn: "Dodge" } },
    ],
    hirableBy: [{ rule: "all", roster: null }],
  };
}

const mockedPrisma = prisma as unknown as {
  starPlayer: {
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
};

/**
 * Table en memoire + mocks qui se comportent comme Prisma :
 * `findUnique` n'accepte QUE le selecteur unique compose.
 */
function seed(rows: StarPlayerRow[]): void {
  mockedPrisma.starPlayer.findUnique.mockImplementation(
    ({ where }: { where: Record<string, unknown> }) => {
      const keys = Object.keys(where);
      const isCompound =
        keys.length === 1 &&
        keys[0] === "slug_ruleset" &&
        typeof where.slug_ruleset === "object";
      if (!isCompound) {
        throw new Error(
          `Invalid \`prisma.starPlayer.findUnique()\` invocation: Argument \`where\` needs at least one of \`id\` or \`slug_ruleset\` arguments. Available options are marked with ?. (got: ${keys.join(", ")})`,
        );
      }
      const { slug, ruleset } = where.slug_ruleset as {
        slug: string;
        ruleset: string;
      };
      return Promise.resolve(
        rows.find((r) => r.slug === slug && r.ruleset === ruleset) ?? null,
      );
    },
  );

  mockedPrisma.starPlayer.findFirst.mockImplementation(
    ({ where }: { where: { slug?: string; ruleset?: string } }) =>
      Promise.resolve(
        rows.find(
          (r) =>
            (where.slug === undefined || r.slug === where.slug) &&
            (where.ruleset === undefined || r.ruleset === where.ruleset),
        ) ?? null,
      ),
  );
}

interface DetailResponse {
  success?: boolean;
  error?: string;
  data?: {
    slug: string;
    ruleset?: string;
    displayName: string;
    skills: string;
    skillDetails?: Array<{
      slug: string;
      nameFr: string | null;
      nameEn: string | null;
    }>;
    pairWith?: string;
    pairCost?: number;
    hirableBy: string[];
  };
}

async function getDetail(
  path: string,
): Promise<{ status: number; body: DetailResponse }> {
  const app = express();
  app.use("/star-players", starPlayersRouter);
  const server = http.createServer(app);
  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("listen failed"));
        return;
      }
      http
        .request(
          {
            hostname: "127.0.0.1",
            port: addr.port,
            path: `/star-players${path}`,
            method: "GET",
          },
          (res) => {
            let buf = "";
            res.on("data", (chunk) => (buf += chunk));
            res.on("end", () => {
              server.close();
              try {
                resolve({
                  status: res.statusCode ?? 0,
                  body: buf ? JSON.parse(buf) : {},
                });
              } catch (e) {
                reject(e);
              }
            });
          },
        )
        .on("error", (e) => {
          server.close();
          reject(e);
        })
        .end();
    });
  });
}

describe("GET /star-players/:slug", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renvoie le detail du star player du ruleset par defaut", async () => {
    seed([makeRow("bomber_dribblesnot", "season_3")]);

    const { status, body } = await getDetail("/bomber_dribblesnot");

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data?.slug).toBe("bomber_dribblesnot");
    expect(body.data?.displayName).toBe("Bomber Dribblesnot");
    expect(body.data?.skills).toBe("bombardier,dodge");
    expect(body.data?.hirableBy).toEqual(["all"]);
  });

  it("respecte le ruleset demande en query", async () => {
    seed([
      makeRow("bomber_dribblesnot", "season_2"),
      makeRow("bomber_dribblesnot", "season_3"),
    ]);

    const { status, body } = await getDetail(
      "/bomber_dribblesnot?ruleset=season_2",
    );

    expect(status).toBe(200);
    expect(body.data?.ruleset).toBe("season_2");
  });

  it("retombe sur un autre ruleset quand le star n'existe pas dans celui demande", async () => {
    seed([makeRow("bomber_dribblesnot", "season_2")]);

    const { status, body } = await getDetail("/bomber_dribblesnot");

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data?.ruleset).toBe("season_2");
  });

  it("renvoie 404 (et pas 500) pour un slug inconnu", async () => {
    seed([makeRow("bomber_dribblesnot", "season_3")]);

    const { status, body } = await getDetail("/inconnu");

    expect(status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Star player not found");
  });

  it("expose les noms de competences FRAIS de la base (skillDetails)", async () => {
    seed([makeRow("bomber_dribblesnot", "season_3")]);

    const { body } = await getDetail("/bomber_dribblesnot");

    expect(body.data?.skillDetails).toEqual([
      { slug: "bombardier", nameFr: "Bombardier", nameEn: "Bombardier" },
      { slug: "dodge", nameFr: "Esquive", nameEn: "Dodge" },
    ]);
  });

  it("calcule le prix de PAIRE depuis les couts DB (grak + crumbleberry)", async () => {
    const grak = { ...makeRow("grak", "season_3"), cost: 250000 };
    const crumbleberry = { ...makeRow("crumbleberry", "season_3"), cost: 30000 };
    seed([grak, crumbleberry]);

    const { body } = await getDetail("/grak");

    // Le prix de paire vient de la DB (250k + 30k), pas du catalogue
    // statique compile — un edit admin du cout est visible immediatement.
    expect(body.data?.pairWith).toBe("crumbleberry");
    expect(body.data?.pairCost).toBe(280000);
  });

  it("paire sans partenaire en base : pairCost omis (repli front)", async () => {
    seed([{ ...makeRow("grak", "season_3"), cost: 250000 }]);

    const { body } = await getDetail("/grak");

    expect(body.data?.pairWith).toBe("crumbleberry");
    expect(body.data?.pairCost).toBeUndefined();
  });

  it("ne capture pas la route /search avec le pattern /:slug", async () => {
    seed([]);
    mockedPrisma.starPlayer.findMany.mockResolvedValue([]);

    const { status, body } = await getDetail("/search?q=bomber");

    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });
});
