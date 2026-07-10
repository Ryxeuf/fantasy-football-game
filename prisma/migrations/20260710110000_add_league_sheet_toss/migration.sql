-- Toss d'avant-match : côté vainqueur du toss + son choix (donner le
-- coup d'envoi ou recevoir). L'équipe qui engage se déduit des deux.
ALTER TABLE "LeagueMatchSheet" ADD COLUMN "tossWinner" TEXT;
ALTER TABLE "LeagueMatchSheet" ADD COLUMN "tossChoice" TEXT;
