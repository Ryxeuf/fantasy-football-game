---
"@bb/server": patch
"@bb/web": patch
---

Les conteneurs de production lancent node directement, sans pnpm ni la CLI tsx en intermédiaires.

**Des processus parents inactifs pour toute la vie du conteneur.** Le serveur démarrait par `pnpm --filter @bb/server run dev:nowatch`, soit pnpm → shell → CLI tsx → node, et le site par `pnpm --filter @bb/web exec next start`, soit pnpm → Next. Ces parents ne font plus rien une fois l'application lancée, mais gardent leur mémoire — précisément celle que le noyau pousse en swap (alerte `HostSwapSaturated` sur le serveur OVH). Mesuré sur les images de prod : ~48 Mo de mémoire anonyme rendus côté serveur, ~50 Mo côté site.

**Même comportement, moins de processus.** Les images font désormais `cd apps/<app> && exec node …` (loader `--import tsx` côté serveur) : le dossier de travail reste celui que donnait pnpm, dont dépendent dotenv et les lectures de fichiers du site. Le compose de prod pose `init: true` sur les deux services, pour que node ne soit pas PID 1 — il ignorerait sinon le SIGTERM de `docker stop`. Une garde de test (`prod-runtime-command.test.ts`) empêche le retour d'un `pnpm run` dans les CMD.
