# Gestion des ligues : fix migrations dev + invitations + joueurs de test — 2026-06-08

## 1. Problème de migrations (cause racine)

La gestion de ligue livrée le 2026-06-06 a ajouté des tables/colonnes
(`LeagueInvitation`, `LeaguePool`, `LeagueParticipant.poolId`, …) avec leurs
migrations dans le repo. **Mais** la commande de démarrage du conteneur dev
([docker-compose.yml](docker-compose.yml)) ne faisait que `prisma generate &&
pnpm run dev` — elle **n'appliquait jamais** le schéma à la DB. La DB dev était
donc en retard → la page ligue plantait (requêtes sur des colonnes/tables
absentes).

**Fix immédiat** (DB dev en cours) : `prisma db push` non-destructif appliqué
dans le conteneur → « database is now in sync ». La page fonctionne après
rechargement.

**Fix durable** : la commande du conteneur `server` applique désormais
`pnpm -w prisma db push --skip-generate` au boot (sans `--accept-data-loss` :
les changements additifs s'appliquent, un changement destructif fait échouer
le boot au lieu de détruire des données). Pour l'activer :
`docker compose up -d server` (recrée le conteneur).

## 2. Inviter des joueurs

Le système d'invitation existait **entièrement côté backend** (routes
`/leagues/:id/invitations`, page publique d'acceptation
`/leagues/invitations/[code]`) et le composant `InviteCoachModal` existait,
mais **n'était jamais branché** dans la page détail (ni les clés de flag web).

Branché :
- `apps/web/app/lib/featureFlagKeys.ts` : ajout de `LEAGUE_INVITATIONS_FLAG`.
- `apps/web/app/leagues/[id]/page.tsx` : bouton **✉️ Inviter un coach**
  (commissaire, gaté par le flag `league_invitations`) qui ouvre
  `InviteCoachModal` (autocomplete coach → génère un lien d'invitation).

**Pré-requis pour voir le bouton** : flag `league_invitations` actif pour
l'utilisateur. Les admins voient tous les flags (bypass). Sinon l'activer dans
`/admin/feature-flags` (toggle global ou override user).

Flux : Inviter un coach → lien `/leagues/invitations/:code` → le coach
l'ouvre, choisit son équipe, accepte → inscrit à la saison.

## 3. Ajouter des joueurs de test (dev)

Nouveau, **dev uniquement** (404 en prod) :
- `apps/server/src/routes/league-test-data.ts` :
  `POST /leagues/seasons/:seasonId/test-participant` — réservé au commissaire,
  crée un coach jetable + une équipe de test (roster pris dans
  `allowedRosters`, 11 joueurs génériques) et l'inscrit à la saison. Garde-fou
  `NODE_ENV !== "production"`. Sûr : compte de test sans mot de passe valide.
- `apps/web/app/leagues/[id]/TestParticipantButton.tsx` : bouton **🧪 Équipe de
  test** (commissaire, rendu seulement si `process.env.NODE_ENV !== production`,
  donc invisible en prod), affiché quand une saison est sélectionnée.
- Test : `league-test-data.test.ts` (404 prod / 403 non-commissaire / succès).

La saison doit être en `draft`/`scheduled` (règle `addParticipant`).

## Vérification

- `tsc --noEmit` OK (web + serveur).
- Tests : serveur **3727** (dont nouveau `league-test-data.test.ts`), web
  ligues **70** — tous verts.
- DB dev synchronisée via `prisma db push`.
