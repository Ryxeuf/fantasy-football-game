# Notifications internes & cycle de vie des compétitions

## Why

Deux manques remontés par les commissaires et les coachs :

1. **Une ligue ou un championnat ne se clôture pas.** Seul un administrateur
   peut archiver une ligue (`POST /admin/leagues/:id/archive`) ; le
   commissaire qui l'a créée n'a aucun bouton, et personne ne peut la
   supprimer. Côté coupe, l'archivage existe mais uniquement depuis le
   statut « terminée », et la suppression n'existe pas non plus. Les ligues
   d'essai, abandonnées ou créées par erreur s'accumulent dans les listes.
2. **Tout ce qui arrive à un coach lui est signalé hors de l'application.**
   Invitation à une ligue ou une coupe, appariement d'une journée, match à
   valider, demande d'ami : push web (si abonné) et e-mail (si adresse), mais
   rien dans l'interface. Un coach qui a refusé le push ou qui a raté
   l'e-mail ne voit rien, et rien ne lui dit qu'il a quelque chose à faire.

## What Changes

- **Notifications internes (in-app)** : modèle `Notification` persistant par
  utilisateur, service `in-app-notifications` (création jamais bloquante,
  liste paginée, compteur de non lus, lecture unitaire et globale), routes
  `/notifications`, et branchement sur les évènements existants : invitation
  de ligue et de coupe, appariement d'une journée, match prêt à valider,
  demande d'ami reçue / acceptée, archivage et suppression d'une compétition
  à laquelle on participe.
- **Menu web** : cloche avec **compteur de non lus** dans l'en-tête (bureau
  et mobile) et lien « Notifications » dans le menu utilisateur ; page
  `/me/notifications` qui liste les notifications et **les marque lues à la
  consultation**.
- **Cycle de vie des compétitions** : le **commissaire** (créateur) — ou un
  administrateur — peut **archiver** et **supprimer** une ligue
  (`POST /leagues/:id/archive`, `DELETE /leagues/:id`) et une coupe
  (`POST /cup/:id/archive`, `DELETE /cup/:id`), depuis n'importe quel statut.
  Les coachs participants en sont notifiés. Boutons dédiés sur les pages de
  ligue et de coupe (suppression confirmée par saisie du nom).

## How

- Les notifications sont un **effet secondaire jamais bloquant** (pattern
  « hook post-settlement encapsulé ») : `createInAppNotification` capture
  et journalise toute erreur, ne throw jamais, et n'est **pas** soumis aux
  préférences push (`shouldSendNotification`) — un coach qui a coupé le push
  garde ses notifications internes.
- Le texte est produit côté serveur (français, comme les push existants) ;
  `kind` (dot-case) + `meta` (ids) permettent une future localisation.
- L'archivage/suppression vit dans un service dédié
  (`competition-lifecycle`) avec une classe d'erreur typée, plutôt que dans
  `routes/league.ts` (3 000 lignes) et `routes/cup.ts`. Une seule paire de
  handlers, montée sur `/leagues` et `/cup`.
- `League.status = "archived"` et `Cup.status = "archivee"` sont les valeurs
  **déjà** lues par les listes et pages archivées : aucune nouvelle colonne
  de gating.

## Non-goals

- Pas de notification pour chaque tour d'un match en ligne (déjà couvert en
  temps réel par le push et l'UI de jeu), ni pour « adversaire trouvé ».
- Pas de préférences par type de notification interne (suite possible).
- Pas de restauration d'une compétition supprimée : la suppression est
  définitive (cascade Prisma), d'où la confirmation par saisie du nom.
- L'application mobile Expo n'affiche pas encore la cloche (suite possible).
