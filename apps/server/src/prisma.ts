import { PrismaClient } from "@prisma/client";

let client: any;
if (process.env.TEST_SQLITE === '1') {
  // Charger le client généré pour sqlite
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PrismaClient: SQLiteClient } = require('./prisma-sqlite-client');
    client = new SQLiteClient();
  } catch (e) {
    // fallback: utiliser client par défaut (peut échouer si pas de DB Postgres)
    client = new PrismaClient();
  }
} else {
  client = new PrismaClient();
}

export const prisma = client;


