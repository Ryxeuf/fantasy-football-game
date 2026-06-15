# Design: me-dashboard-clean-url

## Contexte

- `apps/web` est en Next.js 14 app router. `app/page.tsx` est un composant
  `"use client"` mais reste rendu cote serveur au premier chargement (SEO).
- Un middleware (`apps/web/middleware.ts`) protege deja toutes les routes
  `/me/*` : sans `auth_token` valide, redirection vers `/auth/sync` (pas de
  cookie) ou `/login` (cookie invalide).
- Les flags sont exposes cote client via `FeatureFlagContext` +
  `useFeatureFlag`. Le flag `online_play` gate la partie "Jouer en ligne".

## Decision 1 -- Deplacer le tableau de bord vers `/me`

`/me` rend le `CoachDashboard` (avant : simple redirect vers `/me/teams`). On
reutilise le middleware existant pour la garde d'authentification au lieu
d'ajouter une garde applicative : un visiteur deconnecte n'atteint jamais le
composant. La page recharge tout de meme `/auth/me` pour recuperer le profil ;
en cas d'echec (token tout juste expire), elle renvoie vers `/login`.

## Decision 2 -- `/` reste toujours la home publique

C'est le coeur du change. Auparavant `/` basculait vers le dashboard quand
connecte. On retire cette bascule : `/` rend **toujours** `MarketingHome`.

**Pourquoi (et tradeoff) :** l'exigence "un lien sur la page d'accueil, quand
on est connecte, vers la page personnalisee" n'a de sens que si l'accueil
reste visible une fois connecte. Une redirection automatique `/ -> /me`
rendrait l'accueil inaccessible aux connectes et contredirait l'exigence.

**Consequence assumee :** un coach connecte n'atterrit plus directement sur son
tableau de bord depuis `/` ; il voit la home publique avec un bandeau "Mon
tableau de bord -> /me". Alternative ecartee : redirection auto vers `/me` avec
un parametre de contournement (`/?home`) pour revoir la home -- jugee plus
alambiquee et contraire a l'exigence ci-dessus.

## Decision 3 -- Bandeau coach plutot que CTA hero dynamique

Le lien `/ -> /me` est rendu comme un bandeau personnalise distinct en tete du
hero, plutot qu'en mutant le libelle/cible des CTA marketing existants selon
l'etat d'authentification. Raisons : eviter un ecart d'hydratation SSR<->client
sur les CTA principaux, et garder un signal "espace perso" clair et non
ambigu. Le bandeau n'apparait qu'apres le mount et seulement si un `auth_token`
est present -> zero flash et zero requete pour les visiteurs deconnectes ; le
rendu serveur reste identique a la home publique (SEO).

## Decision 4 -- Extraire `coach.ts`

`CoachUser` + `coachDisplayName` sont deplaces dans
`components/home/coach.ts`. `MarketingHome` ne recoit qu'un `coachName`
(string | null) calcule en amont par `page.tsx`, sans importer le gros
composant `CoachDashboard`. On garde la page racine legere (SEO/perf).

## Decision 5 -- Gating `online_play` : verification, pas de changement

Audit confirmant que tous les points d'entree "Jouer en ligne" ->
`/me/matches` sont deja gated par `online_play` :
- `CoachDashboard` (carte stat), `MarketingHome` (section Play Online),
  `AuthBar` (menu compte) : conditionnes par `useFeatureFlag(ONLINE_PLAY_FLAG)`.
- Route `/me/matches` : enveloppee par `OnlinePlayGate` (cosmetique) +
  enforcement serveur `requireFeatureFlag("online_play")` sur `/match` et
  `/matchmaking`.
Les autres actions du dashboard (`/me/teams/new`, `/local-matches`, `/teams`,
`/tutoriel`) sont des fonctions toujours disponibles : pas de flag requis.

## Risques / suivi

- Regression de comportement pour les connectes (plus de dashboard auto a la
  racine) -- documentee, reversible si on souhaite plus tard une redirection
  optionnelle.
- Hydratation : le bandeau et la detection coach restent strictement
  post-mount pour preserver l'egalite du premier rendu serveur/client.
