import express from "express";
import cors from "cors";
import compression from "compression";
import bodyParser from "body-parser";
import { createServer } from "node:http";
import authRoutes from "./routes/auth";
import authRefreshRoutes from "./routes/auth-refresh";
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
import careerStatsRoutes from "./routes/career-stats";
import achievementsRoutes from "./routes/achievements";
import leagueRoutes from "./routes/league";
import kofiRoutes from "./routes/kofi";
import {
  userFeatureFlagsRouter,
  adminFeatureFlagsRouter,
} from "./routes/feature-flags";
import { requireFeatureFlag } from "./middleware/requireFeatureFlag";
import { ONLINE_PLAY_FLAG } from "./services/featureFlags";
import dotenv from "dotenv";
import { execSync } from "node:child_process";
import { prisma } from "./prisma";
import { authRateLimiter, apiRateLimiter } from "./middleware/rateLimiter";
import { publicCache } from "./middleware/publicCache";
import { requestTiming } from "./middleware/requestTiming";
import { securityHeaders } from "./middleware/securityHeaders";
import { setupSocket } from "./socket";
import { CORS_ORIGINS } from "./config";
import { invalidateAllMemo } from "./utils/memoize-async";
import { serverLog } from "./utils/server-log";

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
    serverLog.log(`SQLite schema pushed (TEST_DATABASE_URL=${url})`);
  } catch (e) {
    serverLog.error("Failed to push SQLite schema for tests", e);
  }
}

const API_PORT = parseInt(process.env.API_PORT || "8201", 10);

// Serveur Express API
const app = express();
// Trust le premier proxy (Traefik) pour obtenir la vraie IP client via X-Forwarded-For
app.set("trust proxy", 1);
// Security envelope (HSTS, X-Frame-Options, CSP, X-Content-Type-Options,
// Referrer-Policy). Must run before route handlers so the headers ship on
// every response, including 4xx/5xx. CSP defaults to Report-Only — set
// SECURITY_CSP_MODE=enforce once the report endpoint is wired.
app.use(securityHeaders());
app.use(cors({ origin: CORS_ORIGINS }));
// gzip/deflate/br responses over ~1KB. Team payloads with 11-16 players
// plus star players commonly exceed 50KB uncompressed.
app.use(compression());
// Warn on any request that took >=500ms. Set REQUEST_LOG=1 to see every
// request (useful locally; stays off in prod to avoid log spam).
app.use(requestTiming(500));
app.use(bodyParser.json());

// Rate limiting global sur toutes les routes API (100 req/min par IP)
app.use(apiRateLimiter);

app.get("/health", (_req, res) => res.json({ ok: true }));

// Rate limiting strict uniquement sur login/register/refresh (anti brute-force)
app.use("/auth/login", authRateLimiter);
app.use("/auth/register", authRateLimiter);
app.use("/auth/refresh", authRateLimiter);
app.use("/auth", authRefreshRoutes);
app.use("/auth", authRoutes);
app.use("/match", requireFeatureFlag(ONLINE_PLAY_FLAG), matchRoutes);
app.use("/admin", adminRoutes);
app.use("/admin/data", adminDataRoutes);
app.use("/user", userRoutes);
app.use("/team", teamRoutes);
app.use("/star-players", starPlayersRoutes);
// Public reference data: cache for 1h with 24h stale-while-revalidate.
app.use("/api", publicCache(), publicSkillsRoutes);
app.use("/api", publicCache(), publicRostersRoutes);
app.use("/api", publicCache(), publicPositionsRoutes);
app.use("/cup", cupRoutes);
app.use("/local-match", localMatchRoutes);
app.use("/matchmaking", requireFeatureFlag(ONLINE_PLAY_FLAG), matchmakingRoutes);
app.use(
  "/leaderboard",
  requireFeatureFlag(ONLINE_PLAY_FLAG),
  leaderboardRoutes,
);
app.use("/push", pushRoutes);
app.use("/friends", friendsRoutes);
app.use("/career-stats", careerStatsRoutes);
app.use("/achievements", achievementsRoutes);
app.use("/leagues", leagueRoutes);
// Webhook Ko-fi : public (authentifié via `verification_token` dans le payload).
// Pas de rate limiter applicatif : Ko-fi doit pouvoir retenter.
app.use("/webhooks/kofi", kofiRoutes);
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
        serverLog.warn(`[__test/reset] ${label}: ${msg.slice(0, 160)}`);
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
      // League hierarchy: participants/rounds cascade from seasons; seasons
      // and leagues must be removed before users (creatorId is RESTRICT).
      await safe("leagueRound", () =>
        (prisma as any).leagueRound?.deleteMany?.({}) ?? Promise.resolve(),
      );
      await safe("leagueParticipant", () =>
        (prisma as any).leagueParticipant?.deleteMany?.({}) ??
        Promise.resolve(),
      );
      await safe("leagueSeason", () =>
        (prisma as any).leagueSeason?.deleteMany?.({}) ?? Promise.resolve(),
      );
      await safe("league", () =>
        (prisma as any).league?.deleteMany?.({}) ?? Promise.resolve(),
      );
      // Cup hierarchy (creator is RESTRICT vs User).
      await safe("cupParticipant", () =>
        (prisma as any).cupParticipant?.deleteMany?.({}) ?? Promise.resolve(),
      );
      await safe("cup", () =>
        (prisma as any).cup?.deleteMany?.({}) ?? Promise.resolve(),
      );
      // UserAchievement + Friendship cascade on User, but deleting explicitly
      // avoids surprises if cascade rules change.
      await safe("userAchievement", () =>
        (prisma as any).userAchievement?.deleteMany?.({}) ?? Promise.resolve(),
      );
      await safe("friendship", () =>
        (prisma as any).friendship?.deleteMany?.({}) ?? Promise.resolve(),
      );
      await safe("teamPlayer", () => prisma.teamPlayer.deleteMany({}));
      await safe("team", () => prisma.team.deleteMany({}));
      await safe("user", () => prisma.user.deleteMany({}));
      // Reference data caches (memoizeAsync) survive the DB wipe and would
      // otherwise serve stale `[]` lists to the next test. Drop everything.
      invalidateAllMemo();
      return res.json({ ok: true });
    } catch (e: any) {
      serverLog.error(e);
      return res.status(500).json({ error: e?.message || "reset failed" });
    }
  });

  // Seed d'utilisateurs de test : endpoint dédié aux tests E2E qui crée
  // un compte déjà validé (bypass de la modération admin).
  app.post("/__test/seed-user", async (req, res) => {
    try {
      const { email, password, name, role, valid } = req.body as {
        email?: string;
        password?: string;
        name?: string;
        role?: string;
        valid?: boolean;
      };
      if (!email || !password) {
        return res
          .status(400)
          .json({ error: "email et password requis" });
      }

      const bcrypt = await import("bcryptjs");
      const passwordHash = await bcrypt.default.hash(password, 4);

      const displayName = name || email.split("@")[0];
      const effectiveRole = role ?? "user";
      // `valid` et `roles` sont normalises pour rester compatibles avec les
      // deux schemas (Postgres: Boolean / String[], SQLite: Boolean / String
      // JSON). Par defaut un user de test est valide pour que les suites
      // existantes continuent de passer sans modification.
      const update: Record<string, unknown> = { passwordHash };
      if (typeof valid === "boolean") update.valid = valid;
      if (typeof role === "string") update.role = role;
      const user = await prisma.user.upsert({
        where: { email },
        update,
        create: {
          email,
          passwordHash,
          name: displayName,
          coachName: displayName,
          role: effectiveRole,
          roles: JSON.stringify([effectiveRole]),
          ...(typeof valid === "boolean" ? { valid } : {}),
        },
      });

      return res.json({ id: user.id, email: user.email, name: user.name });
    } catch (e: any) {
      serverLog.error(e);
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
      serverLog.error(e);
      return res
        .status(500)
        .json({ error: e?.message || "seed-team failed" });
    }
  });

  // Seed des rosters + linemen de test. Nécessaire pour que
  // `getLinemanStats` (utilisé par `addJourneymen` pendant la phase
  // pré-match) trouve une position lineman à appliquer aux journeymen.
  // Seed minimal de skills pour les tests E2E qui exercent /api/skills.
  // Couvre deux catégories (General, Agility) et les deux rulesets pour
  // valider le filtrage. Idempotent via upsert sur le composite slug+ruleset.
  app.post("/__test/seed-skills", async (_req, res) => {
    try {
      const skills: Array<{
        slug: string;
        nameFr: string;
        nameEn: string;
        category: string;
      }> = [
        { slug: "block", nameFr: "Blocage", nameEn: "Block", category: "General" },
        { slug: "dodge", nameFr: "Esquive", nameEn: "Dodge", category: "Agility" },
        { slug: "tackle", nameFr: "Plaquage", nameEn: "Tackle", category: "General" },
      ];
      const rulesets = ["season_2", "season_3"] as const;
      for (const ruleset of rulesets) {
        for (const s of skills) {
          await prisma.skill.upsert({
            where: { slug_ruleset: { slug: s.slug, ruleset } },
            update: {},
            create: {
              slug: s.slug,
              ruleset,
              nameFr: s.nameFr,
              nameEn: s.nameEn,
              description: `Description ${s.nameFr}`,
              descriptionEn: `Description ${s.nameEn}`,
              category: s.category,
            },
          });
        }
      }
      // Drop the public-skills cache so the freshly seeded rows are visible
      // to the very next /api/skills call without waiting for TTL.
      invalidateAllMemo();
      return res.json({
        ok: true,
        rulesets,
        skills: skills.map((s) => s.slug),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      serverLog.error("[__test/seed-skills]", msg);
      return res.status(500).json({ error: msg || "seed-skills failed" });
    }
  });

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
      serverLog.error("[__test/seed-rosters]", msg);
      return res.status(500).json({ error: msg || "seed-rosters failed" });
    }
  });
}

const httpServer = createServer(app);
setupSocket(httpServer);

httpServer.listen(API_PORT, () => {
  serverLog.log(`Express API server listening on http://localhost:${API_PORT}`);
});
