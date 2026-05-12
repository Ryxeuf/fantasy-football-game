-- Sprint P lot P.B.2 — Migration miroir sqlite : tournois Pro League.

CREATE TABLE "ProTournament" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "entryFeeCrowns" INTEGER NOT NULL DEFAULT 100,
    "maxEntries" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'open',
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "ProTournament_slug_key" ON "ProTournament"("slug");
CREATE INDEX "ProTournament_status_createdAt_idx" ON "ProTournament"("status", "createdAt");

CREATE TABLE "ProTournamentEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paidCrowns" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProTournamentEntry_tournamentId_fkey"
        FOREIGN KEY ("tournamentId") REFERENCES "ProTournament" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProTournamentEntry_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProTournamentEntry_tournamentId_userId_key" ON "ProTournamentEntry"("tournamentId", "userId");
CREATE INDEX "ProTournamentEntry_userId_idx" ON "ProTournamentEntry"("userId");
CREATE INDEX "ProTournamentEntry_tournamentId_createdAt_idx" ON "ProTournamentEntry"("tournamentId", "createdAt");
