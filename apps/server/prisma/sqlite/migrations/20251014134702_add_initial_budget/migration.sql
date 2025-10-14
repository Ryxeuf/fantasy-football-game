-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roster" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "treasury" INTEGER NOT NULL DEFAULT 0,
    "rerolls" INTEGER NOT NULL DEFAULT 0,
    "cheerleaders" INTEGER NOT NULL DEFAULT 0,
    "assistants" INTEGER NOT NULL DEFAULT 0,
    "apothecary" BOOLEAN NOT NULL DEFAULT false,
    "dedicatedFans" INTEGER NOT NULL DEFAULT 1,
    "teamValue" INTEGER NOT NULL DEFAULT 0,
    "currentValue" INTEGER NOT NULL DEFAULT 0,
    "initialBudget" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Team_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Team" ("apothecary", "assistants", "cheerleaders", "createdAt", "currentValue", "dedicatedFans", "id", "name", "ownerId", "rerolls", "roster", "teamValue", "treasury") SELECT "apothecary", "assistants", "cheerleaders", "createdAt", "currentValue", "dedicatedFans", "id", "name", "ownerId", "rerolls", "roster", "teamValue", "treasury" FROM "Team";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
