-- Lot P.C.2 — admin password reset override.
--
-- Flag User.mustChangePassword pour forcer un changement de mot de
-- passe lors de la prochaine connexion. Mis a true par l'endpoint
-- POST /admin/users/:id/password-reset (lot P.C.2). Remis a false
-- par le handler /auth/change-password existant des qu'un user pose
-- un nouveau mot de passe.
--
-- Aucune migration de donnees : tous les comptes existants demarrent
-- a false (par defaut).

ALTER TABLE "User"
    ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
