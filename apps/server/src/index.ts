import express from "express";
import cors from "cors";
import { Server } from "boardgame.io/server";
import { toBGIOGame } from "@bb/game-engine";

const PORT = parseInt(process.env.PORT || "8000", 10);

const app = express();
app.use(cors());
app.get("/health", (_req, res) => res.json({ ok: true }));

const server = Server({
  games: [toBGIOGame() as any],
});

// Mount the BGIO server on the same HTTP server
const api = server.run({ port: PORT });
api.then(({ app: srv }) => {
  // Merge our express app as a sub-app
  srv.use("/api", app);
  console.log(`boardgame.io server listening on http://localhost:${PORT}`);
}).catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
