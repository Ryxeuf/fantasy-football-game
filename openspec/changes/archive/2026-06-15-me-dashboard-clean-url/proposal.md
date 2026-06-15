# Donner une URL propre au tableau de bord coach et clarifier accueil <-> espace perso

> Archive le 2026-06-15. Implemente et merge via la PR #900
> ("Refactor: Split home page into marketing + dashboard routes").
>
> Note de provenance : le code a ete livre AVANT la redaction de ce change
> OpenSpec. Cet enregistrement est donc retro-documente pour conserver le
> journal de decisions versionne (substitut d'ADR), conformement a
> `CLAUDE.md`. Les taches sont cochees car le code correspondant est deja
> sur `main`.

## Why

L'accueil `/` etait "double-face" : il basculait *inline*, cote client, vers
le tableau de bord du coach des qu'un `auth_token` valide etait present. Trois
limites :

1. **Pas d'URL propre pour l'espace perso.** Le tableau de bord ne vivait qu'a
   la racine `/` (et `/me` se contentait de rediriger vers `/me/teams`).
   Impossible de partager / marquer la page perso, ni d'y revenir directement.
2. **Pas d'acces a l'accueil public une fois connecte.** Comme `/` basculait
   automatiquement, un coach connecte ne pouvait plus voir la home marketing
   (ni la consulter telle qu'un visiteur la voit).
3. **Navigation implicite.** Aucun lien explicite entre l'accueil public et
   l'espace personnalise, dans un sens comme dans l'autre.

En parallele, on voulait confirmer que les actions "Jouer en ligne" (pointant
vers `/me/matches`) restaient bien conditionnees par le feature flag
`online_play` partout ou elles apparaissent.

## What Changes

- **URL propre `/me`.** La page `/me` rend desormais le `CoachDashboard` (au
  lieu de rediriger vers `/me/teams`). L'acces connecte est deja garanti par
  le middleware Next.js (`/me/*` exige un `auth_token` valide, sinon
  redirection `/auth/sync` ou `/login`).
- **`/` toujours publique.** La racine rend toujours la home marketing (rendu
  serveur preserve, SEO). Plus de bascule inline du tableau de bord.
- **Liens croises explicites :**
  - Depuis `/`, si un coach est identifie via `/auth/me`, un bandeau
    personnalise pointe vers `/me`.
  - Depuis `/me`, un lien "Retour a l'accueil" pointe vers `/` (la home
    publique, soit la vue "deconnectee").
- **Decouplage technique.** `CoachUser` + `coachDisplayName` sont extraits
  dans `apps/web/app/components/home/coach.ts` pour que la home marketing
  n'embarque pas tout le composant tableau de bord (page la plus sensible
  SEO/perf).
- **i18n FR/EN** ajoutes : `home.dashboard.backToHome`,
  `home.dashboardBannerGreeting`, `home.dashboardBannerCta`.
- **Verification (aucun changement de code) :** le CTA "Jouer en ligne" ->
  `/me/matches` etait deja gated par `online_play` dans le dashboard, la home
  marketing et le menu compte, en plus du gate de route `OnlinePlayGate` et du
  middleware serveur `requireFeatureFlag`.

## Impact

- **Capability** : nouvelle spec `home-dashboard` (accueil web + navigation
  vers l'espace personnalise + gating des actions en ligne).
- **Code (deja merge, PR #900)** : `apps/web/app/page.tsx`,
  `apps/web/app/me/page.tsx`,
  `apps/web/app/components/home/MarketingHome.tsx`,
  `apps/web/app/components/home/CoachDashboard.tsx`,
  `apps/web/app/components/home/coach.ts`,
  `apps/web/app/i18n/translations.ts` ; tests `home-page.test.tsx`,
  `CoachDashboard.test.tsx`, `me/page.test.tsx`.
- **Aucune migration Prisma, aucun changement de contrat d'API.**
- **Comportement modifie a noter** : un coach connecte n'atterrit plus
  automatiquement sur son tableau de bord en visitant `/` ; il voit la home
  publique avec un bandeau vers `/me`. Choix assume (cf. `design.md`).

## Non-Goals

- Redirection automatique optionnelle `/ -> /me` pour les connectes (ecartee,
  cf. `design.md` ; reouvrable si souhaite plus tard).
- Refonte visuelle de la home marketing ou du tableau de bord.
- Changement du middleware d'authentification `/me/*` ou du format des flags.
