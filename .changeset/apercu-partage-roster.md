---
"@bb/server": minor
"@bb/web": minor
---

Aperçu de partage d'un roster : logo non déformé, nom de l'équipe dans le titre, description écrite par le coach.

**Le logo était étiré, pas mal cadré.** `app/layout.tsx` annonçait `width: 1200, height: 630` pour `public/images/logo.png`, qui fait 1024 × 1024. Les scrapers (Discord, Slack, X) réservent la place d'après les dimensions déclarées puis y peignent le fichier : un carré annoncé en 1,91:1 est écrasé horizontalement. Une image Open Graph racine génère désormais une carte réellement 1200 × 630, logo posé en `objectFit: contain` dans une boîte carrée — règle appliquée à tous les logos du template, y compris ceux qu'uploadent les coachs, dont on ne maîtrise pas les proportions. `openGraph.images` et `twitter.images` sont retirés du layout : Next n'applique le fichier `opengraph-image.tsx` d'un segment que si la metadata du même segment ne déclare pas déjà `images`, sinon il l'ignore en silence.

**Le titre et le texte parlent enfin de l'équipe.** `/r/[token]` et `/me/teams/[id]` portent un titre `<Équipe> — <Race> | Nuffle Arena`, écrit explicitement parce que le `title.template` du layout ne s'applique qu'à `<title>` et pas à `og:title` — or c'est `og:title` qu'affichent les réseaux. La carte montre le logo de l'équipe : celui du coach quand il existe, sinon l'emblème canonique de son roster, rendu en éléments satori (un SVG imbriqué en data URI perd son monogramme, satori ne résolvant pas ses polices).

**Le coach peut écrire le fluff de sa bande.** Nouvelle colonne nullable `Team.description` (≤ 1000 caractères, chaîne vide ramenée à `null`), saisie sur la fiche d'édition via `PATCH /team/:id/description`. Elle prend la place du texte générique du site dans l'aperçu, tronquée sur une frontière de mot. Champ cosmétique comme le nom : hors verrou anti-triche, donc éditable équipe engagée, et journalisé `team.description.update`.

**Le lien que les coachs collent vraiment fonctionne.** Le garde `/me/*` renvoyait toute requête sans session vers `/auth/sync` : le scraper n'atteignait jamais la metadata de `/me/teams/[id]`, quelle qu'elle soit — c'est ce qui produisait la carte générique signalée. Une lecture sans query string sur la seule feuille `/me/teams/:id` part maintenant vers un résolveur `/r/by-id/:id`, qui l'envoie sur `/r/:token` si l'équipe est publique et reconduit le parcours de connexion sinon. Le comportement humain ne change que pour une équipe que son coach a explicitement publiée, et le résolveur ne suit aucune URL fournie par l'appelant.

**Au passage.** L'effectif annoncé sur la page publique et dans la carte comptait les morts et les licenciés (`!p.dead` seul, `players.length`) : il passe par le filtre canonique du roster. Et le bouton « Journal » de la fiche d'équipe, outil d'investigation, est réservé aux admins côté interface — l'autorisation serveur de `GET /team/:id/journal` (propriétaire, admin, commissaire) est inchangée.
