import { Server, Origins } from "boardgame.io/dist/cjs/server";
import { toBGIOGame } from "@bb/game-engine";

const PORT = parseInt(process.env.PORT || "8000", 10);

const server = Server({
  games: [toBGIOGame() as any],
  origins: [Origins.LOCALHOST, Origins.LOCALHOST_IN_DEVELOPMENT],
});

server.run({ port: PORT });

console.log(`boardgame.io server listening on http://localhost:${PORT}`);
