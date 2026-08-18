---
"@bb/server": patch
---

Correction de l'accès aux pages de détail des Star Players : `GET /star-players/:slug` renvoyait un 500 (`Failed to fetch star player`) car le handler interrogeait Prisma avec `findUnique({ where: { slug } })` alors que `slug` n'est unique qu'associé au `ruleset` (`@@unique([slug, ruleset])`). La route utilise désormais `findFirst` avec résolution du ruleset (query `?ruleset=`, repli sur le ruleset par défaut puis sur tout ruleset), expose le ruleset résolu et renvoie un vrai 404 sur slug inconnu. La route `GET /star-players/search`, masquée par le pattern `/:slug`, est de nouveau joignable.
