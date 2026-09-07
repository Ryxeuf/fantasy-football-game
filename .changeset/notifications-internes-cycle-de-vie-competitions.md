---
"@bb/server": minor
"@bb/web": minor
---

Notifications internes et cycle de vie des compétitions : un coach retrouve dans l'application tout ce qui le concerne, et un commissaire peut archiver ou supprimer sa ligue ou sa coupe.

**Tout ce qui arrivait à un coach partait hors du site.** Invitation à une ligue ou à une coupe, appariement d'une journée, match à valider, demande d'ami : push web (si abonné) et e-mail (si adresse), mais rien dans l'interface. Un coach qui a refusé le push ou raté l'e-mail ne voyait rien. La table `Notification` conserve désormais cet historique par utilisateur ; la création est un **effet secondaire jamais bloquant** (un échec est journalisé, l'action métier aboutit) et **indépendante des préférences push** — un coach qui a coupé le push garde ses notifications. Les routes `/notifications` servent la liste paginée, le compteur de non lus et la lecture (unitaire ou globale), toujours filtrées par utilisateur : marquer la notification d'un autre est un 404, jamais une fuite.

**Dans le menu et sur une page dédiée.** Une cloche avec le **nombre de non lus** dans l'en-tête (bureau et mobile, rafraîchie toutes les 60 s et au retour sur l'onglet) et une entrée « Notifications » dans le menu utilisateur mènent à `/me/notifications`. La page met en avant les nouvelles notifications puis **les marque lues dès leur consultation**, la pastille disparaît. Elle est aussi prévenue de l'archivage ou de la suppression d'une compétition à laquelle on participe.

**Archiver ou supprimer sa compétition.** Seul un administrateur pouvait archiver une ligue, une coupe ne s'archivait que depuis « terminée » et rien ne se supprimait. Le **commissaire** (créateur) — ou un admin — dispose maintenant de `POST /leagues/:id/archive`, `DELETE /leagues/:id`, `POST /cup/:id/archive` et `DELETE /cup/:id`, quel que soit le statut courant. L'archivage est idempotent et pose les valeurs déjà lues par les listes d'archives. La suppression est définitive (saisons, poules, appariements, feuilles, invitations et documents partent avec la compétition ; équipes et matchs joués en ligne survivent) : l'interface exige la saisie du nom exact. Les coachs inscrits sont notifiés dans les deux cas — pour une suppression, ils sont résolus avant l'effacement et prévenus après sa réussite, jamais d'annonce d'une suppression qui a échoué.
