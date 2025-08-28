import { Server, Origins } from "boardgame.io/dist/cjs/server";
import express from "express";
import cors from "cors";
import { toBGIOGame } from "@bb/game-engine";

const BGIO_PORT = parseInt(process.env.BGIO_PORT || "8000", 10);
const API_PORT = parseInt(process.env.API_PORT || "8001", 10);

// Serveur boardgame.io
const bgioServer = Server({
  games: [toBGIOGame() as any],
  origins: [Origins.LOCALHOST, Origins.LOCALHOST_IN_DEVELOPMENT],
});

bgioServer.run({ port: BGIO_PORT });
console.log(`boardgame.io server listening on http://localhost:${BGIO_PORT}`);

// Serveur Express API
const app = express();
app.use(cors());
app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(API_PORT, () => {
  console.log(`Express API server listening on http://localhost:${API_PORT}`);
});
