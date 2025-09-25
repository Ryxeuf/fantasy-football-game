import { Server, Origins } from "boardgame.io/dist/cjs/server";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import authRoutes from "./routes/auth";
import matchRoutes from "./routes/match";
import adminRoutes from "./routes/admin";
import userRoutes from "./routes/user";
import teamRoutes from "./routes/team";
import dotenv from "dotenv";
import { toBGIOGame } from "@bb/game-engine";
import { execSync } from "node:child_process";

dotenv.config({ path: "../../prisma/.env" });
// Si tests SQLite: pousser le schéma SQLite en mémoire partagée au démarrage
if (process.env.TEST_SQLITE === '1') {
  const url = process.env.TEST_DATABASE_URL || 'file:memdb1?mode=memory&cache=shared';
  try {
    execSync(`TEST_DATABASE_URL='${url}' npx prisma db push --schema prisma/sqlite/schema.prisma --skip-generate`, {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: { ...process.env, TEST_DATABASE_URL: url },
    });
    console.log(`SQLite schema pushed (TEST_DATABASE_URL=${url})`);
  } catch (e) {
    console.error('Failed to push SQLite schema for tests', e);
  }
}

const BGIO_PORT = parseInt(process.env.BGIO_PORT || "8000", 10);
const API_PORT = parseInt(process.env.API_PORT || "8001", 10);
const MATCH_SECRET = process.env.MATCH_SECRET || "dev-match-secret";

// Serveur boardgame.io
const bgioServer = Server({
  games: [toBGIOGame() as any],
  origins: [Origins.LOCALHOST, Origins.LOCALHOST_IN_DEVELOPMENT],
  // Validation du token de match transmis côté client via `credentials`
  authenticate: async (credentials: any) => {
    try {
      const token = typeof credentials === "string" ? credentials : credentials?.matchToken;
      if (!token) throw new Error("matchToken manquant");
      const payload: any = (await import("jsonwebtoken")).default.verify(token, MATCH_SECRET);
      // Optionnel: retourner des métadonnées utiles
      return { matchId: payload.matchId, userId: payload.userId } as any;
    } catch (e) {
      throw new Error("Authentification match invalide");
    }
  },
});

bgioServer.run({ port: BGIO_PORT });
console.log(`boardgame.io server listening on http://localhost:${BGIO_PORT}`);

// Serveur Express API
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/auth", authRoutes);
app.use("/match", matchRoutes);
app.use("/admin", adminRoutes);
app.use("/user", userRoutes);
app.use("/team", teamRoutes);

app.listen(API_PORT, () => {
  console.log(`Express API server listening on http://localhost:${API_PORT}`);
});
