# Sprint 24 — Stabilite & DX core

> Duree cible : ~5 jours
> Theme : eteindre les feux P0 avant que le trafic Q (SEO/GEO) grimpe + 
> ameliorer le confort dev quotidien.
> Pre-requis : aucun. Ce sprint deverrouille les 3 suivants.

## Taches

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| S24.1 | Cookie `auth_token` httpOnly=true + sameSite=strict + secure=true | FIX | S | [x] | `apps/web/app/api/sync-auth-cookie/route.ts:22`. Bloque le vol via XSS. Actuellement httpOnly=false "pour synchro JS" mais le token est deja en localStorage donc surface deja redondante. |
| S24.2 | Helmet + CSP + HSTS + X-Frame-Options DENY | FIX | M | [ ] | `apps/server/src/index.ts:65-100`. Aucun en-tete securite actuellement. Au minimum X-Frame, X-Content-Type-Options nosniff, HSTS 1 an, CSP img-src + script-src self. |
| S24.3 | JWT refresh token (15 min access + 7j refresh, rotation + blacklist) | FIX | M | [ ] | `apps/server/src/routes/auth.ts:90-100`. Token actuel 7j sans rotation = 7j de fenetre si compromission. Pattern refresh + access. |
| S24.4 | WebSocket cleanup listeners + room leak | FIX | S | [ ] | `apps/web/app/play/[id]/hooks/useGameSocket.ts:365-370`. Listeners non desabonnes apres disconnect : fuite memoire progressive sur sessions longues. |
| S24.5 | Polling fallback 3s -> 10s + backoff exponentiel | FIX | M | [ ] | `apps/web/app/play/[id]/hooks/useGameState.ts:301`. Quand WS degrade, X clients = X requetes/3s. Trop agressif a la scale beta. |
| S24.6 | Verifier `app.use(authRateLimiter)` + couverture `/leagues` GET | FIX | S | [ ] | Divergence detectee entre agents backend ("non applique") et securite ("present"). Confirmer end-to-end + ajouter tests. |
| S24.7 | Retirer `console.log` debug en prod (web) | FIX | S | [ ] | `apps/web/app/play/[id]/page.tsx:615,729,743` + autres. 10+ logs de debug visibles dans les devtools. |
| S24.8 | Wrapper minimal pour `console.error` backend (preparation S25) | FIX | S | [ ] | 270 console.* eparpilles dans `apps/server/src/`. Wrapper temporaire `serverLog.error()` qui delegue a console mais permet swap vers pino en S25 sans toucher chaque call site. |
| S24.9 | Docker compose dev hot-reload + 5 make targets quotidiens | CONFORT | S | [ ] | `docker-compose.yml` actuellement statique (`pnpm install && pnpm run dev`). Ajouter bind mount + nodemon/turbopack hot reload. Targets : `make logs`, `make reset-db`, `make seed`, `make tunnel`, `make snapshot-prod`. Cycle dev x5 plus rapide. |

## Definition of done

- [ ] Tests passent (4809+ verts)
- [ ] tsc OK sur tous les packages (web + server + game-engine + ui + mobile)
- [ ] Audit securite : `curl -I` sur prod renvoie HSTS, X-Frame-Options, CSP
- [ ] Demo : login -> token expire en 15min -> refresh transparent
- [ ] Demo : edit fichier server -> hot reload visible en <2s

## Risques

- **JWT refresh (S24.3)** : risque de casser les sessions actives. Migrer
  les users existants via grace period (anciens tokens 7j tolerated 24h).
- **Helmet + CSP (S24.2)** : CSP trop strict casse Pixi.js, Umami,
  inline styles Tailwind. Tester progressivement (Report-Only d'abord).
- **Hot reload Docker (S24.9)** : bind mount sur node_modules pose des
  problemes de permissions. Eviter de mount node_modules.

## Sources

Findings agents : securite#1-3, performance#1-2, frontend#1, backend#5, DX#10-11.
