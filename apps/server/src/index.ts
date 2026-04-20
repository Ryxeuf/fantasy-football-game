import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { createServer } from "node:http";
import authRoutes from "./routes/auth";
import matchRoutes from "./routes/match";
import adminRoutes from "./routes/admin";
import adminDataRoutes from "./routes/admin-data";
import userRoutes from "./routes/user";
import teamRoutes from "./routes/team";
import starPlayersRoutes from "./routes/star-players";
import publicSkillsRoutes from "./routes/public-skills";
import publicRostersRoutes from "./routes/public-rosters";
import publicPositionsRoutes from "./routes/public-positions";
import cupRoutes from "./routes/cup";
import localMatchRoutes from "./routes/local-match";
import matchmakingRoutes from "./routes/matchmaking";
import leaderboardRoutes from "./routes/leaderboard";
import pushRoutes from "./routes/push";
import friendsRoutes from "./routes/friends";
import {
  userFeatureFlagsRouter,
  adminFeatureFlagsRouter,
} from "./routes/feature-flags";
import dotenv from "dotenv";
import { execSync } from "node:child_process";
import { prisma } from "./prisma";
import { authRateLimiter, apiRateLimiter } from "./middleware/rateLimiter";
import { setupSocket } from "./socket";
import { CORS_ORIGINS } from "./config";

dotenv.config({ path: "../../prisma/.env" });
// Si tests SQLite: pousser le schéma SQLite en mémoire partagée au démarrage
if (process.env.TEST_SQLITE === "1") {
  const url =
    process.env.TEST_DATABASE_URL || "file:memdb1?mode=memory&cache=shared";
  try {
    execSync(
      `TEST_DATABASE_URL='${url}' npx prisma db push --schema prisma/sqlite/schema.prisma --skip-generate`,
      {
        stdio: "inherit",
        cwd: process.cwd(),
        env: { ...process.env, TEST_DATABASE_URL: url },
      },
    );
    console.log(`SQLite schema pushed (TEST_DATABASE_URL=${url})`);
  } catch (e) {
    console.error("Failed to push SQLite schema for tests", e);
  }
}

const API_PORT = parseInt(process.env.API_PORT || "8201", 10);

// Serveur Express API
const app = express();
// Trust le premier proxy (Traefik) pour obtenir la vraie IP client via X-Forwarded-For
app.set("trust proxy", 1);
app.use(cors({ origin: CORS_ORIGINS }));
app.use(bodyParser.json());

// Rate limiting global sur toutes les routes API (100 req/min par IP)
app.use(apiRateLimiter);

app.get("/health", (_req, res) => res.json({ ok: true }));

// Rate limiting strict uniquement sur login/register (anti brute-force)
app.use("/auth/login", authRateLimiter);
app.use("/auth/register", authRateLimiter);
app.use("/auth", authRoutes);
app.use("/match", matchRoutes);
app.use("/admin", adminRoutes);
app.use("/admin/data", adminDataRoutes);
app.use("/user", userRoutes);
app.use("/team", teamRoutes);
app.use("/star-players", starPlayersRoutes);
app.use("/api", publicSkillsRoutes);
app.use("/api", publicRostersRoutes);
app.use("/api", publicPositionsRoutes);
app.use("/cup", cupRoutes);
app.use("/local-match", localMatchRoutes);
app.use("/matchmaking", matchmakingRoutes);
app.use("/leaderboard", leaderboardRoutes);
app.use("/push", pushRoutes);
app.use("/friends", friendsRoutes);
app.use("/api/feature-flags", userFeatureFlagsRouter);
app.use("/admin/feature-flags", adminFeatureFlagsRouter);

// Endpoint public de reset pour tests (uniquement en TEST_SQLITE=1)
if (process.env.TEST_SQLITE === "1") {
  app.post("/__test/reset", async (_req, res) => {
    // Ordre de suppression des entités pour respecter les FK:
    //   turn → teamSelection → _MatchToUser → match → teamPlayer → team → user
    // Chaque étape est isolée dans un try/catch pour que les entités
    // facultatives (modèles présents uniquement dans le schéma Postgres)
    // n'empêchent pas le reset.
    const safe = async (label: string, fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[__test/reset] ${label}: ${msg.slice(0, 160)}`);
      }
    };
    try {
      await safe("turn", () => prisma.turn.deleteMany({}));
      await safe("matchQueue", () =>
        (prisma as any).matchQueue?.deleteMany?.({}) ?? Promise.resolve(),
      );
      await safe("teamSelection", () => prisma.teamSelection.deleteMany({}));
      await safe("_MatchToUser", () =>
        (prisma as any).$executeRawUnsafe('DELETE FROM "_MatchToUser"'),
      );
      await safe("match", () => prisma.match.deleteMany({}));
      await safe("teamPlayer", () => prisma.teamPlayer.deleteMany({}));
      await safe("team", () => prisma.team.deleteMany({}));
      await safe("user", () => prisma.user.deleteMany({}));
      return res.json({ ok: true });
    } catch (e: any) {
      console.error(e);
      return res.status(500).json({ error: e?.message || "reset failed" });
    }
  });

  // Seed d'utilisateurs de test (register est désactivé en pré-alpha,
  // donc on expose un endpoint dédié aux tests E2E).
  app.post("/__test/seed-user", async (req, res) => {
    try {
      const { email, password, name } = req.body as {
        email?: string;
        password?: string;
        name?: string;
      };
      if (!email || !password) {
        return res
          .status(400)
          .json({ error: "email et password requis" });
      }

      const bcrypt = await import("bcryptjs");
      const passwordHash = await bcrypt.default.hash(password, 4);

      const displayName = name || email.split("@")[0];
      // Seul le schéma Postgres expose `valid`; on évite de le passer afin que
      // le même payload fonctionne sur les deux schémas.
      const user = await prisma.user.upsert({
        where: { email },
        update: { passwordHash },
        create: {
          email,
          passwordHash,
          name: displayName,
          coachName: displayName,
          role: "user",
          roles: JSON.stringify(["user"]),
        },
      });

      return res.json({ id: user.id, email: user.email, name: user.name });
    } catch (e: any) {
      console.error(e);
      return res
        .status(500)
        .json({ error: e?.message || "seed-user failed" });
    }
  });

  // Seed d'équipe minimale (11 linemen) pour les tests E2E.
  // Contourne /team/create-from-roster qui fait des includes incompatibles
  // avec le schéma SQLite de test (starPlayers, etc.).
  app.post("/__test/seed-team", async (req, res) => {
    try {
      const { ownerId, name, roster } = req.body as {
        ownerId?: string;
        name?: string;
        roster?: "skaven" | "lizardmen";
      };
      if (!ownerId || !name || !roster) {
        return res
          .status(400)
          .json({ error: "ownerId, name et roster requis" });
      }
      if (roster !== "skaven" && roster !== "lizardmen") {
        return res
          .status(400)
          .json({ error: "roster doit être skaven ou lizardmen" });
      }

      const team = await prisma.team.create({
        data: {
          ownerId,
          name,
          roster,
          teamValue: 1000,
          initialBudget: 1000,
          treasury: 0,
          rerolls: 0,
          cheerleaders: 0,
          assistants: 0,
          apothecary: false,
        },
      });

      // 11 linemen génériques, stats de base
      const players = Array.from({ length: 11 }, (_, i) => ({
        teamId: team.id,
        name: `${name} ${i + 1}`,
        position: "Lineman",
        number: i + 1,
        ma: 6,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
        skills: "",
      }));
      await prisma.teamPlayer.createMany({ data: players });

      return res.json({ id: team.id, name: team.name, roster: team.roster });
    } catch (e: any) {
      console.error(e);
      return res
        .status(500)
        .json({ error: e?.message || "seed-team failed" });
    }
  });

  // Seed des rosters + linemen de test. Nécessaire pour que
  // `getLinemanStats` (utilisé par `addJourneymen` pendant la phase
  // pré-match) trouve une position lineman à appliquer aux journeymen.
  // En prod ce seed est fait par `apps/server/src/seed.ts` mais il
  // suppose le schéma Postgres complet — on expose ici une version
  // minimale et idempotente pour les tests.
  app.post("/__test/seed-rosters", async (_req, res) => {
    try {
      const rosters: Array<{
        slug: string;
        name: string;
        nameEn: string;
        tier: string;
      }> = [
        { slug: "skaven", name: "Skavens", nameEn: "Skaven", tier: "II" },
        {
          slug: "lizardmen",
          name: "Hommes-lézards",
          nameEn: "Lizardmen",
          tier: "I",
        },
      ];

      // Seed for both rulesets so tests covering either season_2 or
      // season_3 endpoints have data.
      const rulesets = ["season_2", "season_3"] as const;
      for (const ruleset of rulesets) {
        for (const r of rosters) {
          const roster = await prisma.roster.upsert({
            where: { slug_ruleset: { slug: r.slug, ruleset } },
            update: {},
            create: {
              slug: r.slug,
              ruleset,
              name: r.name,
              nameEn: r.nameEn,
              budget: 1_000_000,
              tier: r.tier,
            },
          });

          await prisma.position.upsert({
            where: {
              rosterId_slug: {
                rosterId: roster.id,
                slug: `${r.slug}_lineman`,
              },
            },
            update: {},
            create: {
              rosterId: roster.id,
              slug: `${r.slug}_lineman`,
              displayName: "Lineman",
              cost: 50_000,
              min: 0,
              max: 16, // getLinemanStats prend la position avec le plus grand max
              ma: 6,
              st: 3,
              ag: 3,
              pa: 4,
              av: 8,
            },
          });
        }
      }

      return res.json({
        ok: true,
        rulesets,
        rosters: rosters.map((r) => r.slug),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[__test/seed-rosters]", msg);
      return res.status(500).json({ error: msg || "seed-rosters failed" });
    }
  });
}

const httpServer = createServer(app);
setupSocket(httpServer);

httpServer.listen(API_PORT, () => {
  console.log(`Express API server listening on http://localhost:${API_PORT}`);
});
