---
"@bb/server": minor
"@bb/web": minor
---

Console admin des équipes : masquer les supprimées, les restaurer, et éditer une équipe.

**Trois manques sur le même écran.** `/admin/teams` listait les équipes soft-deletées au milieu des vivantes sans rien en dire : une équipe que son coach avait supprimée s'affichait comme active, et rien ne permettait de la rendre. La suppression admin, elle, hard-deletait joueurs, Star Players puis l'équipe — irréversible, et vouée à échouer en violation de clé étrangère dès que l'équipe avait été engagée, puisqu'elle reste référencée par `LeagueParticipant` / `CupParticipant`. Enfin la fiche d'équipe était en lecture seule : corriger une composition, un recrutement de Star Player ou un staff mal saisi imposait de passer par le compte du coach.

**Le périmètre de suppression devient un filtre à trois états.** `GET /admin/teams` accepte `deleted` = `active` (défaut, masque les supprimées), `deleted` (ne remonte qu'elles) ou `all`, et sert `deletedAt` pour que l'écran distingue les deux. La règle vit dans `buildAdminTeamsWhere`, pur et testable sans Prisma. Côté site : un sélecteur, une ligne barrée avec badge « Supprimée » et date en infobulle, et un bouton qui bascule de Supprimer à Restaurer — seule action qui ait du sens dans cet état.

**La suppression admin s'aligne sur le soft delete du coach.** Elle pose `deletedAt` et ne détruit plus rien, donc `POST /admin/teams/:id/restore` suffit à tout rendre : joueurs, Star Players et rattachements n'ont jamais bougé. Les deux postures restent distinctes et partagent la même définition de « équipe engagée » (`findActiveEngagements`) : le coach est **bloqué** par une compétition non terminée — on ne quitte pas une ligue en cours par la porte de service — l'admin ne l'est **jamais**, puisque son action est réversible, mais reçoit en retour la liste des compétitions impactées.

**L'édition s'ouvre à l'admin, sur les endpoints du coach.** `services/team-edit-access` porte les deux règles : le `where` ne contraint plus `ownerId` pour un admin, et le gel « équipe engagée » — un garde-fou **anti-triche**, pas une règle de jeu — ne s'applique pas à lui, puisque c'est précisément sur ces équipes-là qu'il intervient. Le lock « match en cours » reste opposé à tout le monde : une partie a un état de jeu vivant, y toucher la corromprait. Rien n'est perdu en traçabilité, `TeamAuditEvent` journalisant chaque mutation avec l'acteur `admin`.

**La page `/admin/teams/[id]/edit`** rend les trois blocs demandés : la liste des positions (ajout par poste avec compteur `n/max` recalculé sur le brouillon, retrait, nom et numéro, le tout envoyé en un seul `PUT /team/:id/roster` portant l'état cible), les Star Players et les coups de pouce — ces deux derniers en réutilisant directement les composants du coach. Les joueurs morts ou licenciés y sont verrouillés : les retirer du payload les effacerait de l'historique de l'équipe.

Aucune migration : `Team.deletedAt` existe déjà.
