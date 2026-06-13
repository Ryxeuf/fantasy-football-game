-- #3 — Partage public opt-in d'une équipe (boucle d'acquisition).
--
-- Le coach peut rendre SON équipe consultable publiquement en lecture
-- seule via un lien non-devinable. Changements additifs et non-bloquants :
--   - `isPublic`   : opt-in, désactivé par défaut (vie privée).
--   - `shareToken` : token unique généré à la première activation, qui
--                    sert d'identifiant d'URL publique stable.

ALTER TABLE "Team" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Team" ADD COLUMN "shareToken" TEXT;

CREATE UNIQUE INDEX "Team_shareToken_key" ON "Team"("shareToken");
