# Tasks — Aperçu de partage d'un roster

## Modèle et serveur

- [x] Prisma : colonne `Team.description String?` (nullable, lisible sans
      backfill).
- [x] `schemas/team.schemas.ts` : `updateTeamDescriptionSchema` +
      `UpdateTeamDescriptionBody` (≤ 1000 après trim, chaîne vide ⇒ `null`).
- [x] `services/team-description.ts` : `updateTeamDescription`,
      `TeamDescriptionError` typée (`not_found` / `invalid_description`),
      no-op si valeur identique, journal `team.description.update` avec
      `before` (calqué sur `services/team-rename.ts`).
- [x] `routes/team-description-handler.ts` + route
      `PATCH /team/:id/description` câblée dans `routes/team.ts`.
- [x] `services/team-audit-read.ts` : libellé `team.description.update`.
- [x] `services/team-share.ts` : `getPublicTeamPreviewById` (aperçu
      minimal, `isPublic` obligatoire) + route
      `GET /api/public/teams/by-id/:id`.
- [x] Tests serveur : `services/team-description.test.ts`,
      `routes/team-description-handler.test.ts`,
      `services/team-share-preview.test.ts`.
- [x] Miroir SQLite : `Team.description` dans
      `apps/server/prisma/sqlite/schema.prisma` (schéma distinct, généré
      par le job e2e-api) + spec `tests/e2e-api/specs/team-share-preview.spec.ts`
      qui exerce les deux routes contre ce miroir.

## Images OG

- [x] `app/lib/og-image-content.ts` : `logoUrl` et `description` dans
      `OgContent` / `RosterShareOgInput`, helpers de troncature partagés
      (`truncateForMeta`, `truncateForOg`) et `buildShareTitle`.
- [x] `app/lib/og-image-template.tsx` : boîte carrée `objectFit: contain`
      pour le logo, sous-titre qui accepte la description.
- [x] `app/lib/og-team-logo.ts` (pur) : absolutisation d'un `logoUrl`
      relatif, repli data-URI sur `renderTeamLogoSvg`.
- [x] `app/opengraph-image.tsx` racine (1200 × 630) + retrait de
      `openGraph.images` / `twitter.images` dans `app/layout.tsx`.
- [x] Tests : `og-image-content` (troncature, titre, description),
      `og-team-logo` (absolutisation, data URI, repli).

## Partage

- [x] `app/r/[token]` : titre `<Équipe> — <Race> | Nuffle Arena`,
      description du coach en `description` / `og:description`, logo dans
      l'`opengraph-image`, description affichée sur la page.
- [x] `app/me/teams/[id]/layout.tsx` (generateMetadata, `noindex`, gaté
      sur `isPublic`) + `app/me/teams/[id]/opengraph-image.tsx`.
- [x] `lib/private-team-share-divert.ts` (pur) + branchement dans
      `middleware.ts` + résolveur `app/r/by-id/[id]/route.ts` : sans ça, le
      garde `/me/*` redirige le scraper avant tout rendu et AUCUNE metadata
      de `/me/teams/[id]` n'est jamais lue.
- [x] Tests : metadata `/r/[token]`, metadata `/me/teams/[id]` (gate
      privé/public), détournement (périmètre) et résolveur (pas de
      redirection ouverte).

## Web

- [x] `TeamDescriptionEditor` sur `/me/teams/[id]/edit` (textarea +
      compteur + sauvegarde) et affichage de la description sur la fiche
      `/me/teams/[id]`.
- [x] `TeamShareToggle` : dire que c'est le lien public qui porte
      l'aperçu enrichi.
- [x] Clés i18n fr/en + tests composants.

## Suites possibles

- [ ] Les pages qui déclarent leur propre `openGraph` sans `images`
      (blog, compendium, skills, ligues…) n'ont aucune `og:image` :
      leur en donner une, ou factoriser un défaut partagé.
- [ ] Modération de la description (blocklist), comme envisagé pour le nom
      d'équipe.
