import { PrismaClient } from "@prisma/client";
import { createRequire } from "node:module";

let client: any;
if (process.env.TEST_SQLITE === "1") {
  // Charger le client généré pour sqlite via un require ESM-safe.
  // En ESM (apps/server est "type":"module"), l'ancien appel `require()`
  // échouait silencieusement → le code retombait sur le client Postgres
  // par défaut et plantait sur les routes DB (DATABASE_URL manquante).
  try {
    const esmRequire = createRequire(import.meta.url);
    const mod = esmRequire("./prisma-sqlite-client/index.js");
    const SQLiteClient = mod.PrismaClient;
    if (typeof SQLiteClient !== "function") {
      throw new Error(
        `PrismaClient not exported by SQLite client (keys: ${Object.keys(
          mod,
        )
          .slice(0, 5)
          .join(",")})`,
      );
    }
    client = new SQLiteClient();
    console.log("[prisma] Using SQLite test client");
  } catch (e) {
    console.error(
      "[prisma] Impossible de charger le client SQLite de test, fallback Postgres:",
      e instanceof Error ? e.message : e,
    );
    client = new PrismaClient();
  }
} else {
  client = new PrismaClient();
}

export const prisma = client;
