# Tasks: me-dashboard-clean-url

> Toutes les taches sont faites -- livrees et mergees via la PR #900.

## 1. URL propre `/me`

- [x] 1.1 Remplacer le redirect `/me -> /me/teams` par le rendu du
      `CoachDashboard` dans `apps/web/app/me/page.tsx`.
- [x] 1.2 Charger `/auth/me` cote page, afficher un ecran de chargement, et
      renvoyer vers `/login` si le profil n'est pas resolu.
- [x] 1.3 S'appuyer sur le middleware existant pour la garde d'authentification
      de `/me/*` (aucune nouvelle garde applicative).

## 2. Home publique + bandeau coach

- [x] 2.1 Faire rendre `/` toujours `MarketingHome` (retirer la bascule inline
      vers le dashboard) dans `apps/web/app/page.tsx`.
- [x] 2.2 Detecter le coach connecte via `/auth/me` (uniquement si un
      `auth_token` est present) et calculer son nom d'affichage.
- [x] 2.3 Ajouter la prop `coachName` a `MarketingHome` et un bandeau en tete
      de hero pointant vers `/me` quand `coachName` est present.

## 3. Lien retour depuis le dashboard

- [x] 3.1 Ajouter un lien "Retour a l'accueil" -> `/` dans `CoachDashboard`.

## 4. Decouplage + i18n

- [x] 4.1 Extraire `CoachUser` + `coachDisplayName` dans
      `apps/web/app/components/home/coach.ts` ; re-exporter le type depuis
      `CoachDashboard` pour compat.
- [x] 4.2 Ajouter les cles i18n FR/EN : `home.dashboard.backToHome`,
      `home.dashboardBannerGreeting`, `home.dashboardBannerCta`.

## 5. Verification feature flag

- [x] 5.1 Confirmer que tous les points d'entree "Jouer en ligne" ->
      `/me/matches` sont gated par `online_play` (dashboard, home marketing,
      menu compte) + gate de route `OnlinePlayGate` + middleware serveur.

## 6. Tests

- [x] 6.1 `home-page.test.tsx` : `/` rend la home publique ; bandeau `/me`
      quand connecte ; pas de bandeau si `/auth/me` echoue.
- [x] 6.2 `CoachDashboard.test.tsx` : presence du lien retour accueil.
- [x] 6.3 Nouveau `me/page.test.tsx` : rendu du dashboard + ecran de chargement.
- [x] 6.4 `tsc --noEmit` vert + suite vitest des fichiers touches verte.
