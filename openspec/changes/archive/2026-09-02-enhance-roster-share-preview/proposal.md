# Aperçu de partage d'un roster (logo, titre, description)

## Why

Un coach a collé le lien de son équipe dans Discord. L'aperçu affiché est
celui du site, et il est mauvais sur les trois axes :

1. **Le logo est déformé.** `app/layout.tsx` déclare
   `openGraph.images = [{ url: "/images/logo.png", width: 1200, height: 630 }]`,
   or `public/images/logo.png` fait **1024 × 1024**. Les dimensions
   annoncées mentent : Discord, Slack et X étirent l'image carrée dans une
   boîte 1,91:1. Le logo n'est pas mal cadré, il est *écrasé*.
2. **Le titre ne dit pas de quelle équipe il s'agit.** `/me/teams/[id]`
   n'exporte aucune metadata : l'aperçu retombe sur le titre générique du
   site, identique pour un roster, un article de blog ou la page d'accueil.
3. **Le texte est celui du site.** Le coach n'a nulle part où écrire le
   fluff de son équipe, donc rien d'autre à afficher.

Le partage d'équipe est pourtant une boucle d'acquisition explicite du
repo (`TeamShareToggle`, `/r/:token`, `buildRosterShareOgContent`) : c'est
le seul endroit où un utilisateur amène lui-même des inconnus sur le site.
Un aperçu générique et déformé y coûte cher.

## What Changes

- **Modèle.** Nouvelle colonne `Team.description` (`String?`, nullable —
  aucune migration de backfill possible, cf. `prisma db push`). C'est le
  fluff libre de l'équipe, saisi par le coach.
- **Serveur.** `PATCH /team/:id/description` `{ description }` réservé au
  propriétaire, validé par Zod (≤ 1000 caractères, chaîne vide ⇒ `null`),
  journalisé `team.description.update`. Volontairement HORS du verrou
  anti-triche du roster : la description est cosmétique, comme le nom
  (`team.rename`). Nouvel endpoint public
  `GET /api/public/teams/by-id/:id` qui rend un **aperçu minimal**
  (nom, race, VE, effectif, logo, description, token de partage) et
  **uniquement** si l'équipe est publique.
- **Images OG.** `OgImageTemplate` accepte un logo, rendu dans une boîte
  carrée fixe en `objectFit: contain` : quelles que soient les proportions
  de la source, l'image ne peut plus être étirée. Nouvel
  `app/opengraph-image.tsx` racine (1200 × 630 réellement générés) qui
  remplace le `logo.png` mal déclaré ; `openGraph.images` /
  `twitter.images` sont retirés de `app/layout.tsx` pour que la convention
  de fichier Next.js s'applique.
- **Partage d'un roster.** `/r/[token]` et `/me/teams/[id]` affichent le
  **logo de l'équipe** (celui uploadé par le coach, sinon l'emblème
  programmatique du roster), un **titre `<Équipe> — <Race> | Nuffle
  Arena`** et, quand elle existe, la **description du coach** à la place
  du texte du site. `/me/teams/[id]` reçoit sa première metadata (avec
  `robots: noindex`, c'est une page privée).
- **Le lien que les coachs collent réellement.** `middleware.ts` renvoie
  toute requête non authentifiée sur `/me/*` vers `/auth/sync` : le
  scraper n'atteignait donc JAMAIS la metadata de `/me/teams/[id]`, quelle
  qu'elle soit. Une requête de LECTURE, sans query string, sur la seule
  feuille `/me/teams/:id` part désormais vers un résolveur
  `/r/by-id/:id` : équipe publique ⇒ `/r/:token` (l'aperçu est alors celui
  du roster, et le destinataire du lien voit l'équipe au lieu d'un mur de
  connexion) ; sinon, parcours de connexion inchangé.
- **Web.** Saisie de la description sur la fiche d'édition de l'équipe
  (`/me/teams/[id]/edit`), affichage sur la fiche et sur la page publique
  de partage.

## Impact

- **Colonne nullable, lisible sans backfill** : `description = null`
  signifie « aucun fluff », l'affichage retombe sur la description
  générée. Conforme à la règle du repo (`prisma/migrations/` est gitignoré,
  la prod applique `db push`).
- **Vie privée.** `/me/teams/[id]` n'enrichit son aperçu que si l'équipe
  est **publique** (`isPublic`). Une équipe privée continue d'afficher la
  carte générique du site : le partage reste opt-in, comme
  `TeamShareToggle` l'a toujours posé. Le panneau de partage le dit
  désormais explicitement.
- **Aperçus des autres pages.** Retirer `openGraph.images` de la racine
  ne dégrade rien : Next.js remplace intégralement `openGraph` au niveau
  d'un segment qui le déclare (`resolveOpenGraph`), donc les pages qui
  déclarent leur propre `openGraph` sans images n'héritaient déjà pas de
  l'image racine. Les pages qui ne déclarent rien (accueil, `/me/*`)
  héritent maintenant d'une image correctement proportionnée.
- **Parcours de connexion.** Le détournement ne change le comportement
  humain que pour une équipe dont le coach a explicitement activé le
  partage (`isPublic`, faux par défaut) : un visiteur sans session y voit
  la page publique au lieu du login. C'est l'intention même du partage —
  et pour le destinataire d'un lien, qui n'est pas le propriétaire, c'est
  la seule issue utile. Toutes les autres URLs `/me/*` (liste, builder,
  sous-pages, requêtes avec query string, écritures) sont inchangées.
- Aucun impact moteur : ni la VE, ni le budget, ni la composition ne
  dépendent de la description.
