-- Réengagement Phase B — consentement (opt-in) au digest e-mail
-- hebdomadaire + état d'idempotence.
--
-- RGPD : `enabled` est false par défaut (opt-in explicite). La
-- désinscription en un clic pose `enabled=false` + `unsubscribedAt`.
-- `lastSentAt` garde l'idempotence du job hebdomadaire.

CREATE TABLE "EmailDigestPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "lastSentAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailDigestPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailDigestPreference_userId_key" ON "EmailDigestPreference"("userId");

ALTER TABLE "EmailDigestPreference" ADD CONSTRAINT "EmailDigestPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
