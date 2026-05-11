import express from "express";
import cors from "cors";
import compression from "compression";
import bodyParser from "body-parser";
import { createServer } from "node:http";
import authRoutes from "./routes/auth";
import authPrivacyRoutes from "./routes/auth-privacy";
import authRefreshRoutes from "./routes/auth-refresh";
import matchRoutes from "./routes/match";
import adminRoutes from "./routes/admin";
import adminDataRoutes from "./routes/admin-data";
import adminLeaguesRoutes from "./routes/admin-leagues";
import adminAnalyticsRoutes from "./routes/admin-analytics";
import adminSimRoutes from "./routes/admin-sim";
import adminSimReplaysRoutes from "./routes/admin-sim-replays";
import adminWalletRoutes from "./routes/admin-wallet";
import adminUtilitiesRoutes from "./routes/admin-utilities";
import adminProSeasonRoutes from "./routes/admin-pro-season";
import userRoutes from "./routes/user";
import teamRoutes from "./routes/team";
import teamAdvancementRoutes from "./routes/team-advancement";
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
import coachRoutes from "./routes/coach";
import leagueRoutes from "./routes/league";
import { tutorialRouter, adminTutorialRouter } from "./routes/tutorial";
import kofiRoutes from "./routes/kofi";
import {
  feedbackPublicRouter,
  feedbackAdminRouter,
} from "./routes/feedback";
import proLeagueRoutes from "./routes/pro-league";
import {
  userFeatureFlagsRouter,
  adminFeatureFlagsRouter,
} from "./routes/feature-flags";
import { requireFeatureFlag } from "./middleware/requireFeatureFlag";
import { maintenanceMode } from "./middleware/maintenance";
import {
  AI_TRAINING_FLAG,
  ONLINE_PLAY_FLAG,
  LEAGUES_V2_UI_FLAG,
  invalidateFeatureFlagsCache,
} from "./services/featureFlags";
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
import { serverLog, setServerLogImpl } from "./utils/server-log";
import { pinoServerLogImpl } from "./utils/pino-logger";
import { requestContext } from "./middleware/requestContext";
import { liveness, readiness } from "./utils/healthcheck";
import { appMetrics, metricsExposition } from "./utils/metrics";

dotenv.config({ path: "../../prisma/.env" });

// S25.1 — Branche pino comme implementation de serverLog en prod/dev. En
// test (TEST_SQLITE=1 ou NODE_ENV=test) on garde la delegation console.*
// pour ne pas casser les spies des suites existantes.
const inTestEnv =
  process.env.NODE_ENV === "test" || process.env.TEST_SQLITE === "1";
if (!inTestEnv && process.env.LOG_FORMAT !== "console") {
  setServerLogImpl(pinoServerLogImpl);
}
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
// S25.1 — Correlation ID + per-request pino child logger. Mounted before
// requestTiming so the requestId is visible in slow-call warnings.
app.use(requestContext());
// Warn on any request that took >=500ms. Set REQUEST_LOG=1 to see every
// request (useful locally; stays off in prod to avoid log spam).
app.use(requestTiming(500));
app.use(bodyParser.json());

// Rate limiting global sur toutes les routes API (100 req/min par IP)
app.use(apiRateLimiter);

// Sprint P (Lot P.A.1) — mode maintenance global. Kill-switch :
// 503 + Retry-After pour toutes les routes sauf /health/*, /admin/*
// et auth essentielles. Toggle via /admin/feature-flags.
app.use(maintenanceMode());

// Healthchecks S25.1 :
//  - /health      : alias retro-compatible vers liveness ({ok:true,status:"live"})
//  - /health/live : liveness pure (process up)
//  - /health/ready: readiness profond (ping DB, 503 si la DB est down)
const probeReadiness = readiness({
  dbPing: () => prisma.$queryRaw`SELECT 1`,
  timeoutMs: 1500,
});
app.get("/health", liveness);
app.get("/health/live", liveness);
app.get("/health/ready", probeReadiness);

// Pro League healthcheck (sprint 1.F.2). Sous-systeme observable :
// season, simRunner, gazette, bettingMarkets. 503 si "down", 200
// sinon (degraded compris : un orchestrateur qui veut un signal
// strict peut filtrer status='up').
app.get("/health/pro-league", async (_req, res) => {
  try {
    const { getProLeagueHealth } = await import(
      "./services/pro-league-health"
    );
    const out = await getProLeagueHealth();
    const code = out.status === "down" ? 503 : 200;
    res.status(code).json(out);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    serverLog.error(`[health/pro-league] failed: ${msg}`);
    res.status(503).json({ status: "down", error: "internal-error" });
  }
});

// Endpoint Prometheus (S25.3). Format texte standard, scrape par
// Prometheus qui le pousse ensuite vers Grafana LGTM.
app.get("/metrics", async (_req, res, next) => {
  try {
    const body = await metricsExposition(appMetrics.registry);
    res.setHeader("Content-Type", appMetrics.registry.contentType);
    res.send(body);
  } catch (err) {
    next(err);
  }
});

// Rate limiting strict uniquement sur login/register/refresh (anti brute-force)
app.use("/auth/login", authRateLimiter);
app.use("/auth/register", authRateLimiter);
app.use("/auth/refresh", authRateLimiter);
app.use("/auth", authRefreshRoutes);
app.use("/auth", authPrivacyRoutes);
app.use("/auth", authRoutes);
app.use("/match", requireFeatureFlag(ONLINE_PLAY_FLAG), matchRoutes);
app.use("/admin", adminRoutes);
app.use("/admin/data", adminDataRoutes);
app.use("/user", userRoutes);
app.use("/team", teamRoutes);
// L2.B.3 — routes level-up Jeu en Ligue. Mountees sur /team aussi
// pour partager le namespace, mais dans un router separe pour ne pas
// gonfler `routes/team.ts` qui depasse deja 2000 lignes.
app.use("/team", teamAdvancementRoutes);
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
app.use("/coach", publicCache(), coachRoutes);
app.use("/leagues", leagueRoutes);
// S26 DoD — telemetrie tutoriel (mesure du KPI 80% completion).
app.use("/tutorial", tutorialRouter);
app.use("/admin/tutorial", adminTutorialRouter);
// Webhook Ko-fi : public (authentifié via `verification_token` dans le payload).
// Pas de rate limiter applicatif : Ko-fi doit pouvoir retenter.
app.use("/webhooks/kofi", kofiRoutes);
app.use("/api/feature-flags", userFeatureFlagsRouter);
app.use("/admin/feature-flags", adminFeatureFlagsRouter);
// L2.C.6 — admin leagues : reservation aux admins, route distincte
// pour ne pas polluer /admin (qui devient un sac fourre-tout).
app.use("/admin/leagues", adminLeaguesRoutes);
app.use("/admin", adminAnalyticsRoutes);
app.use("/admin/sim", adminSimRoutes);
// Sprint Pro League 0.E.2 / 0.E.3 — exposition lecture seule des replays
// panel pour la validation C6-C9 du gate Phase 0 → Phase 1 (cf.
// docs/roadmap/sprints/pro-league-gate.md). Mountée sur un namespace
// distinct (`/admin/sim-replays`) pour éviter la double exécution du
// middleware d'auth qui se produirait si on imbriquait sous `/admin/sim`.
app.use("/admin/sim-replays", adminSimReplaysRoutes);
// Lot P.B.1 — admin wallet (audit financier strict). Mountee sur /admin
// pour avoir /admin/wallets/* et /admin/bets/*.
app.use("/admin", adminWalletRoutes);
// Utilitaires admin (seed, etc.) — endpoints idempotents avec audit log.
app.use("/admin/utilities", adminUtilitiesRoutes);
// Lot P.B.3 — season factory Pro League (clone, reset standings, force
// forfeit, cancel season). Audit log strict sur toutes les actions.
app.use("/admin/pro-league", adminProSeasonRoutes);
// Feedback public : pas d'auth, captcha + rate limiter dedies dans le router.
app.use("/feedback", feedbackPublicRouter);
app.use("/pro-league", proLeagueRoutes);
// Console admin : auth + role admin appliques dans le router.
app.use("/admin/feedback", feedbackAdminRouter);

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
      // Feedback public : pas de FK vers User, on peut wiper a tout moment.
      await safe("feedback", () =>
        (prisma as any).feedback?.deleteMany?.({}) ?? Promise.resolve(),
      );
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
      const {
        email,
        password,
        name,
        role,
        valid,
        leaderboardStatus,
        rankedMatches,
      } = req.body as {
        email?: string;
        password?: string;
        name?: string;
        role?: string;
        valid?: boolean;
        leaderboardStatus?: "visible" | "hidden_admin";
        /**
         * Nombre de `EloSnapshot` a creer pour ce user (default 0). Sert aux
         * specs E2E qui veulent simuler un coach ayant joue des matches
         * ranked (le leaderboard filtre sur `eloSnapshots: { some: {} }`).
         */
        rankedMatches?: number;
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
      if (typeof leaderboardStatus === "string") {
        update.leaderboardStatus = leaderboardStatus;
      }
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
          ...(typeof leaderboardStatus === "string"
            ? { leaderboardStatus }
            : {}),
        },
      });

      const snapshots =
        typeof rankedMatches === "number" && rankedMatches > 0
          ? Math.min(Math.trunc(rankedMatches), 100)
          : 0;
      if (snapshots > 0) {
        // Cree des snapshots avec des `recordedAt` ordonnes pour eviter les
        // collisions de timestamp si deux snapshots sont crees dans la meme ms.
        const baseTime = Date.now() - snapshots * 60_000;
        await Promise.all(
          Array.from({ length: snapshots }).map((_, i) =>
            prisma.eloSnapshot.create({
              data: {
                userId: user.id,
                rating: 1000,
                delta: 0,
                recordedAt: new Date(baseTime + i * 60_000),
              },
            }),
          ),
        );
      }

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
            update: { budget: 1000 },
            create: {
              slug: r.slug,
              ruleset,
              name: r.name,
              nameEn: r.nameEn,
              // Budget en kpo, comme dans `season3-reference-data.ts`.
              budget: 1000,
              tier: r.tier,
            },
          });

          // Cost et budget sont exprimés en kpo (kilo-pièces d'or), unité
          // utilisée par le team builder côté front (ex: Lineman = 50, budget
          // équipe = 1000). Aligner sur cette convention pour que les boutons
          // "+ Ajouter" soient cliquables (cost <= teamValue) dans l'E2E UI.
          await prisma.position.upsert({
            where: {
              rosterId_slug: {
                rosterId: roster.id,
                slug: `${r.slug}_lineman`,
              },
            },
            update: { cost: 50, displayName: "Lineman" },
            create: {
              rosterId: roster.id,
              slug: `${r.slug}_lineman`,
              displayName: "Lineman",
              cost: 50,
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

      // Seed les feature flags de base. Les pages /play, /lobby, /waiting,
      // /leaderboard, etc. sont gatées par <OnlinePlayGate> qui exige le flag
      // `online_play`. En tests on s'appuie sur FEATURE_FLAGS_FORCE_ENABLED=true
      // pour bypass la vérification ; mais l'API /api/feature-flags/me ne
      // renvoie que les clés présentes en base, donc sans cette seed la
      // sentinelle côté client reste à `loading=false, flags=∅` et la gate
      // affiche "fonctionnalité indisponible".
      const flagSeeds: Array<{ key: string; description: string }> = [
        {
          key: ONLINE_PLAY_FLAG,
          description: "Active toute la zone multijoueur (lobby, leaderboard, etc.)",
        },
        {
          key: AI_TRAINING_FLAG,
          description: "Active les matchs d'entrainement contre l'IA",
        },
        {
          key: LEAGUES_V2_UI_FLAG,
          description:
            "Sprint Ligues v2 — UI de gestion complete des ligues (creation, edition, admin saison, inscription, calendrier interactif).",
        },
      ];
      for (const flag of flagSeeds) {
        await prisma.featureFlag.upsert({
          where: { key: flag.key },
          update: { enabled: true },
          create: {
            key: flag.key,
            description: flag.description,
            enabled: true,
          },
        });
      }
      invalidateFeatureFlagsCache();

      return res.json({
        ok: true,
        rulesets,
        rosters: rosters.map((r) => r.slug),
        flags: flagSeeds.map((f) => f.key),
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

// L2.A.11 — Cron interne pour les forfaits de pairing de ligue.
// Toutes les `LEAGUE_FORFEIT_TICK_MS` ms, on declenche un sweep des
// pairings dont la deadline est depassee. En env de test (TEST_SQLITE
// ou NODE_ENV=test), on desactive la boucle pour ne pas polluer les
// suites avec des updates concurrents. Override possible via
// `LEAGUE_FORFEIT_TICK_MS=0` pour desactiver explicitement (ex:
// runner CI ou dev local quand on ne veut pas de side-effects).
const inTestForfeitEnv =
  process.env.NODE_ENV === "test" || process.env.TEST_SQLITE === "1";
const tickMsEnv = Number(process.env.LEAGUE_FORFEIT_TICK_MS);
const tickMs = Number.isFinite(tickMsEnv)
  ? tickMsEnv
  : 60 * 60 * 1000;
if (!inTestForfeitEnv && tickMs > 0) {
  // Import dynamique pour eviter de pulluler les workers de tests
  // qui mockent `prisma` mais ne mockent pas la boucle.
  void import("./services/league-forfeit").then(({ sweepDeadlinePairings }) => {
    const tick = async () => {
      try {
        const out = await sweepDeadlinePairings();
        if (out.forfeited > 0) {
          serverLog.info(
            `[league-forfeit] sweep: forfeited=${out.forfeited} skipped=${out.skipped} (inspected=${out.inspected})`,
          );
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "unknown";
        serverLog.error(`[league-forfeit] sweep failed: ${msg}`);
      }
    };
    // First tick scheduled `tickMs` after boot (donne le temps a la
    // DB d'etre prete). Pas de tick immediat pour eviter de bloquer
    // le boot.
    setInterval(() => {
      void tick();
    }, tickMs).unref();
  });
}

// =============================================================================
// Pro League sim-runner cron (sprint Pro League lot 1.A.4 — activation).
// =============================================================================
// Pre-simule les matchs ProLeague dont scheduledAt tombe dans les
// prochaines 24h. Persiste Replay + met a jour ProLeagueMatch.
//
// Tick par defaut : 10 min. Configurable via PRO_LEAGUE_SIM_RUNNER_TICK_MS.
// Mettre = 0 pour desactiver (CI / dev local sans side-effects).
const inTestSimRunnerEnv =
  process.env.NODE_ENV === "test" || process.env.TEST_SQLITE === "1";
const simRunnerTickMsEnv = Number(process.env.PRO_LEAGUE_SIM_RUNNER_TICK_MS);
const simRunnerTickMs = Number.isFinite(simRunnerTickMsEnv)
  ? simRunnerTickMsEnv
  : 10 * 60 * 1000;
if (!inTestSimRunnerEnv && simRunnerTickMs > 0) {
  void import("./services/pro-league-sim-runner").then(
    ({ simulateUpcomingMatches }) => {
      const tick = async () => {
        try {
          const out = await simulateUpcomingMatches();
          if (out.simulated > 0 || out.failed > 0 || out.versionMismatched > 0) {
            serverLog.info(
              `[pro-league-sim] tick: simulated=${out.simulated} skipped=${out.skipped} failed=${out.failed} versionMismatched=${out.versionMismatched} (inspected=${out.inspected})`,
            );
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "unknown";
          serverLog.error(`[pro-league-sim] tick failed: ${msg}`);
        }
      };
      setInterval(() => {
        void tick();
      }, simRunnerTickMs).unref();
    },
  );
}

// Lot 2.A.5 — engine drift watcher. Calcule chaque heure la drift
// observée (rolling 7j) vs FUMBBL et pousse `nuffle_engine_drift`
// pour Grafana. Désactivable via PRO_LEAGUE_DRIFT_WATCHER_TICK_MS=0.
const driftWatcherTickMsEnv = Number(
  process.env.PRO_LEAGUE_DRIFT_WATCHER_TICK_MS,
);
const driftWatcherTickMs = Number.isFinite(driftWatcherTickMsEnv)
  ? driftWatcherTickMsEnv
  : 60 * 60 * 1000;
if (!inTestSimRunnerEnv && driftWatcherTickMs > 0) {
  void import("./services/pro-league-engine-drift-watcher").then(
    ({ startDriftWatcher }) => {
      startDriftWatcher({ intervalMs: driftWatcherTickMs });
    },
  );
}


// =============================================================================
// Pro League bet-settlement cron (sprint 1.D.5).
// =============================================================================
// Sweep les matchs completed dont les markets restent open/closed (jamais
// settled) et evalue les bets : credit gagnants WIN, marque market settled.
// Idempotent (skip si ProBetSettlement existe deja).
//
// Tick par defaut : 5 min. Configurable via PRO_LEAGUE_BET_SETTLE_TICK_MS.
// Mettre = 0 pour desactiver (CI / dev local).
const inTestBetSettleEnv =
  process.env.NODE_ENV === "test" || process.env.TEST_SQLITE === "1";
const betSettleTickMsEnv = Number(process.env.PRO_LEAGUE_BET_SETTLE_TICK_MS);
const betSettleTickMs = Number.isFinite(betSettleTickMsEnv)
  ? betSettleTickMsEnv
  : 5 * 60 * 1000;
if (!inTestBetSettleEnv && betSettleTickMs > 0) {
  void import("./services/pro-bet-settlement").then(
    ({ sweepUnsettledMarkets }) => {
      const tick = async () => {
        try {
          const out = await sweepUnsettledMarkets();
          if (out.settled > 0 || out.failed > 0) {
            serverLog.info(
              `[pro-bet-settle] sweep: settled=${out.settled} failed=${out.failed} (inspected=${out.matchesInspected})`,
            );
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "unknown";
          serverLog.error(`[pro-bet-settle] sweep failed: ${msg}`);
        }
      };
      setInterval(() => {
        void tick();
      }, betSettleTickMs).unref();
    },
  );
}


// =============================================================================
// Pro League casualty sweep cron (Lot 3.C.1 — wiring).
// =============================================================================
// Sweep les matchs `ready` ou `completed` avec `casualtiesAppliedAt=null`,
// applique les casualties sur les rosters concernes (niggling, stat
// reductions, mort) et marque le match comme traite (idempotent).
//
// Doit tourner AVANT le cron Hall-of-Fame (qui inducte les morts) et
// AVANT le cron rookie-replenish (qui regenere les slots vides), sinon
// les morts ne sont pas detectes. Le `setInterval` ne garantit pas
// l'ordonnancement strict, mais l'ecart de 30min entre ticks (et
// l'idempotence de chaque sweep) absorbe les cas limites.
//
// Tick par defaut : 30 min. Configurable via PRO_LEAGUE_CASUALTY_TICK_MS.
// Mettre = 0 pour desactiver (CI / dev local).
const inTestCasualtyEnv =
  process.env.NODE_ENV === "test" || process.env.TEST_SQLITE === "1";
const casualtyTickMsEnv = Number(process.env.PRO_LEAGUE_CASUALTY_TICK_MS);
const casualtyTickMs = Number.isFinite(casualtyTickMsEnv)
  ? casualtyTickMsEnv
  : 30 * 60 * 1000;
if (!inTestCasualtyEnv && casualtyTickMs > 0) {
  void import("./services/pro-roster-casualties").then(
    ({ sweepMatchCasualties }) => {
      const tick = async () => {
        try {
          const out = await sweepMatchCasualties();
          if (out.processed > 0 || out.failed > 0) {
            serverLog.info(
              `[pro-casualty] sweep: processed=${out.processed} failed=${out.failed} (inspected=${out.inspected})`,
            );
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "unknown";
          serverLog.error(`[pro-casualty] sweep failed: ${msg}`);
        }
      };
      setInterval(() => {
        void tick();
      }, casualtyTickMs).unref();
    },
  );
}


// =============================================================================
// Pro League SPP / progression cron (Lot 3.C.2).
// =============================================================================
// Sweep les matchs `ready`/`completed` avec `sppAppliedAt=null`,
// attribue les SPP (TD=3, CAS=2, COMP=1, MVP=4) aux rosters reels
// emis par le sim, met a jour `spp` cumulatif + compteurs carriere
// (tdCount, casCount, compCount, mvpCount). Idempotent.
//
// Tick par defaut : 30 min. Configurable via PRO_LEAGUE_SPP_TICK_MS.
// Mettre = 0 pour desactiver (CI / dev local).
const inTestSppEnv =
  process.env.NODE_ENV === "test" || process.env.TEST_SQLITE === "1";
const sppTickMsEnv = Number(process.env.PRO_LEAGUE_SPP_TICK_MS);
const sppTickMs = Number.isFinite(sppTickMsEnv)
  ? sppTickMsEnv
  : 30 * 60 * 1000;
if (!inTestSppEnv && sppTickMs > 0) {
  void import("./services/pro-roster-spp").then(({ sweepMatchSpp }) => {
    const tick = async () => {
      try {
        const out = await sweepMatchSpp();
        if (out.processed > 0 || out.failed > 0) {
          serverLog.info(
            `[pro-spp] sweep: processed=${out.processed} failed=${out.failed} (inspected=${out.inspected})`,
          );
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "unknown";
        serverLog.error(`[pro-spp] sweep failed: ${msg}`);
      }
    };
    setInterval(() => {
      void tick();
    }, sppTickMs).unref();
  });
}


// =============================================================================
// Pro League level-up cron (Lot 3.C.4).
// =============================================================================
// Sweep les rosters `active` avec spp>0, calcule le level attendu via
// la table BB officielle et applique les advancements manquants
// (1 skill General par level franchi). Idempotent : un roster deja
// au niveau cible passe en no-op.
//
// Doit tourner APRES le SPP cron (qui credit le `spp`). Le decalage
// de 30min sur les ticks setInterval garanti l'ordre logique en
// regime stable.
//
// Tick par defaut : 30 min. Configurable via PRO_LEAGUE_LEVELUP_TICK_MS.
// Mettre = 0 pour desactiver (CI / dev local).
const inTestLevelUpEnv =
  process.env.NODE_ENV === "test" || process.env.TEST_SQLITE === "1";
const levelUpTickMsEnv = Number(process.env.PRO_LEAGUE_LEVELUP_TICK_MS);
const levelUpTickMs = Number.isFinite(levelUpTickMsEnv)
  ? levelUpTickMsEnv
  : 30 * 60 * 1000;
if (!inTestLevelUpEnv && levelUpTickMs > 0) {
  void import("./services/pro-roster-level-up").then(({ sweepLevelUps }) => {
    const tick = async () => {
      try {
        const out = await sweepLevelUps();
        if (out.processed > 0 || out.failed > 0) {
          serverLog.info(
            `[pro-levelup] sweep: processed=${out.processed} failed=${out.failed} (inspected=${out.inspected})`,
          );
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "unknown";
        serverLog.error(`[pro-levelup] sweep failed: ${msg}`);
      }
    };
    setInterval(() => {
      void tick();
    }, levelUpTickMs).unref();
  });
}


// =============================================================================
// Pro League TV recompute cron (Lot 4.D.3).
// =============================================================================
// Sweep les rosters `active` et reconcilie `tvCached` apres :
//   - les level-ups (skills appris -> +20k chacun)
//   - les casualties (niggling +1 -> -10k chacun)
// Le level-up applier recompute deja inline lors d'un level-up, mais
// les niggling sont incrementes par le casualty cron sans toucher
// la TV. Ce cron rattrape le drift en regime stable.
//
// Idempotent : `recomputePlayerTv` no-op si tvCached deja correct.
//
// Tick par defaut : 30 min. Configurable via PRO_LEAGUE_TV_TICK_MS.
// Mettre = 0 pour desactiver (CI / dev local).
const inTestTvEnv =
  process.env.NODE_ENV === "test" || process.env.TEST_SQLITE === "1";
const tvTickMsEnv = Number(process.env.PRO_LEAGUE_TV_TICK_MS);
const tvTickMs = Number.isFinite(tvTickMsEnv)
  ? tvTickMsEnv
  : 30 * 60 * 1000;
if (!inTestTvEnv && tvTickMs > 0) {
  void import("./services/pro-roster-tv").then(({ sweepRecomputeTvs }) => {
    const tick = async () => {
      try {
        const out = await sweepRecomputeTvs();
        if (out.processed > 0 || out.failed > 0) {
          serverLog.info(
            `[pro-tv] sweep: processed=${out.processed} failed=${out.failed} (inspected=${out.inspected})`,
          );
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "unknown";
        serverLog.error(`[pro-tv] sweep failed: ${msg}`);
      }
    };
    setInterval(() => {
      void tick();
    }, tvTickMs).unref();
  });
}


// =============================================================================
// Pro League rookie replenish cron (sprint 1.E.6).
// =============================================================================
// Sweep les equipes Pro dont le roster `active` est sous la cible
// (TARGET_ROSTER_SIZE = 12) et genere des rookies pour combler. Couvre
// les morts (status='dead' apres casualties 1.E.4) et toute attrition
// future. Idempotent (no-op si deja plein).
//
// Tick par defaut : 30 min. Configurable via PRO_LEAGUE_ROOKIE_TICK_MS.
// Mettre = 0 pour desactiver (CI / dev local).
const inTestRookieEnv =
  process.env.NODE_ENV === "test" || process.env.TEST_SQLITE === "1";
const rookieTickMsEnv = Number(process.env.PRO_LEAGUE_ROOKIE_TICK_MS);
const rookieTickMs = Number.isFinite(rookieTickMsEnv)
  ? rookieTickMsEnv
  : 30 * 60 * 1000;
if (!inTestRookieEnv && rookieTickMs > 0) {
  void import("./services/pro-roster-generator").then(
    ({ sweepRookieReplenish }) => {
      const tick = async () => {
        try {
          const out = await sweepRookieReplenish();
          if (out.replenished > 0 || out.failed > 0) {
            serverLog.info(
              `[pro-rookie] sweep: replenished=${out.replenished} failed=${out.failed} (inspected=${out.inspected})`,
            );
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "unknown";
          serverLog.error(`[pro-rookie] sweep failed: ${msg}`);
        }
      };
      setInterval(() => {
        void tick();
      }, rookieTickMs).unref();
    },
  );
}


// =============================================================================
// Pro League Hall of Fame death-induction cron (sprint 1.E.5).
// =============================================================================
// Sweep les joueurs status='dead' (post-casualties 1.E.4) et cree
// l'entree Hall of Fame correspondante (idempotent par
// (rosterId, reason='death_in_match')).
//
// Tick par defaut : 30 min. Configurable via PRO_LEAGUE_HOF_TICK_MS.
// Mettre = 0 pour desactiver (CI / dev local).
const inTestHofEnv =
  process.env.NODE_ENV === "test" || process.env.TEST_SQLITE === "1";
const hofTickMsEnv = Number(process.env.PRO_LEAGUE_HOF_TICK_MS);
const hofTickMs = Number.isFinite(hofTickMsEnv)
  ? hofTickMsEnv
  : 30 * 60 * 1000;
if (!inTestHofEnv && hofTickMs > 0) {
  void import("./services/pro-hall-of-fame").then(
    ({ sweepDeathInductions }) => {
      const tick = async () => {
        try {
          const out = await sweepDeathInductions();
          if (out.inducted > 0 || out.failed > 0) {
            serverLog.info(
              `[pro-hof] sweep: inducted=${out.inducted} failed=${out.failed} (inspected=${out.inspected})`,
            );
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "unknown";
          serverLog.error(`[pro-hof] sweep failed: ${msg}`);
        }
      };
      setInterval(() => {
        void tick();
      }, hofTickMs).unref();
    },
  );
}


// =============================================================================
// Pro League Nuffle Gazette LLM cron (sprint 1.E.1).
// =============================================================================
// Genere quotidiennement (8h UTC par defaut) une edition Gazette pour
// J-1 via Claude Haiku. Idempotent (skip si edition existante).
//
// Strategie : tick 5 min, declenche generateEditionForDate si l'heure
// UTC == PRO_LEAGUE_GAZETTE_HOUR_UTC (default 8) et qu'on n'a pas
// deja tick aujourd'hui. Simple et tolerant aux redemarrages : si le
// serveur restart entre 8h00 et 8h05, ca tick au prochain tick.
//
// Mettre PRO_LEAGUE_GAZETTE_TICK_MS = 0 pour desactiver.
// Necessite ANTHROPIC_API_KEY dans l'env.
const inTestGazetteEnv =
  process.env.NODE_ENV === "test" || process.env.TEST_SQLITE === "1";
const gazetteTickMsEnv = Number(process.env.PRO_LEAGUE_GAZETTE_TICK_MS);
const gazetteTickMs = Number.isFinite(gazetteTickMsEnv)
  ? gazetteTickMsEnv
  : 5 * 60 * 1000;
const gazetteHourEnv = Number(process.env.PRO_LEAGUE_GAZETTE_HOUR_UTC);
const gazetteHourUtc = Number.isFinite(gazetteHourEnv) ? gazetteHourEnv : 8;
if (
  !inTestGazetteEnv &&
  gazetteTickMs > 0 &&
  process.env.ANTHROPIC_API_KEY
) {
  void import("./services/pro-gazette-llm").then(
    ({ generateEditionForDate }) => {
      let lastRunDate: string | null = null;
      const tick = async () => {
        const now = new Date();
        if (now.getUTCHours() !== gazetteHourUtc) return;
        const today = now.toISOString().slice(0, 10);
        if (lastRunDate === today) return;
        lastRunDate = today;
        try {
          const out = await generateEditionForDate();
          if (!out.skipped) {
            serverLog.info(
              `[pro-gazette-llm] cron: generated date=${out.date} articles=${out.created}`,
            );
          } else {
            serverLog.info(
              `[pro-gazette-llm] cron: skipped (${out.skipReason}) date=${out.date}`,
            );
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "unknown";
          serverLog.error(`[pro-gazette-llm] cron failed: ${msg}`);
        }
      };
      setInterval(() => {
        void tick();
      }, gazetteTickMs).unref();
    },
  );
}
