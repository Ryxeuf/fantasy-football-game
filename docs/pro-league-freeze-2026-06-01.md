# Freeze Pro League (2026-06-01)

## Décision

Gel **réversible** complet de la brique **Pro League** (championnat IA vs IA
« Old World League » : 16 équipes simulées, diffusion live, **paris en Crowns**,
Gazette LLM, Hall of Fame). On garde tout le code ; on coupe l'exécution.

Décidé : **couper tout maintenant** (les éventuels paris Crowns ouverts restent
`pending` jusqu'au dégel — aucun Crown perdu, mais potentiellement immobilisé)
via un **interrupteur maître unique**.

> ⚠️ Distinct de la **league de base** (gestion de ligue BB PvP, flag
> `leagues_v2_ui`) et de l'**online play** (game-engine). Voir
> `docs/league-api-path-fix-2026-06-01.md` pour le découpage des briques.

## Interrupteur

`PRO_LEAGUE_ENABLED` (serveur + Next.js server-components). Défaut **on**
(`!== "false"`) pour ne rien changer en dev/CI/tests ; mis à `false` dans les
compose déployés.

| Var | Lu par | Effet quand `false` |
|---|---|---|
| `PRO_LEAGUE_ENABLED` | `apps/server/src/index.ts` | Coupe **les 10 crons** pro-league + monte un guard 404 sur `/pro-league/**`, `/admin/pro-league/**`, `/admin/gazette` |
| `PRO_LEAGUE_ENABLED` | `apps/web/app/pro-league/layout.tsx` (server component, runtime) | `redirect("/")` pour toute la section `/pro-league` |
| `NEXT_PUBLIC_PRO_LEAGUE_ENABLED` | `OnboardingModal.tsx` (client) | Masque le lien onboarding « Suis la Pro League » (cosmétique) |

## Surface gelée

**Crons coupés** (`apps/server/src/index.ts`, garde `&& proLeagueEnabled`) :
sim-runner, drift-watcher, bet-settlement, casualty, spp, level-up, tv, rookie,
hall-of-fame, gazette-LLM.

**Routes 404** : `/pro-league`, `/pro-league/prediction-leagues`,
`/pro-league/survivor`, `/pro-league/gazette`, `/admin/pro-league*`,
`/admin/gazette`.

**Web** : `/pro-league/**` → redirect accueil ; lien onboarding masqué.

**Non touché** : le endpoint `/health/pro-league` répond toujours (reflétera
les sous-systèmes à l'arrêt). La league de base, l'online play et le NFL
Fantasy ne sont pas affectés.

## Déploiement / application

- Code (guards, redirect) : hot-reload en dev. **L'effet du freeze dépend de
  l'env**, donc il faut **recréer les conteneurs** pour charger
  `PRO_LEAGUE_ENABLED=false` :
  ```
  docker compose up -d server web
  ```
- Local dev : `docker-compose.yml` (base) porte déjà `=false` (mergé avec
  l'override gitignoré).
- Prod : `docker-compose.prod.yml` porte `=false` côté server + web.

## Réversibilité (dégel)

1. Mettre `PRO_LEAGUE_ENABLED=true` (et `NEXT_PUBLIC_PRO_LEAGUE_ENABLED=true`)
   dans les compose, ou retirer les lignes.
2. `docker compose up -d server web`.
3. Les crons reprennent ; les routes et la section web redeviennent
   accessibles. Les paris restés `pending` se règlent au prochain passage du
   cron bet-settlement.

## CI

E2E (`.github/workflows/e2e.yml`) ne passe **pas** par docker-compose (lance
`pnpm dev:nowatch` / `build` + `start`), donc `PRO_LEAGUE_ENABLED` y est absent
→ défaut **on** → les specs `tests/e2e-ui/specs/pro-league-*.spec.ts` continuent
de valider le code (utile pour garantir un dégel sain). Les tests unitaires/
intégration tournent aussi avec le défaut on.
