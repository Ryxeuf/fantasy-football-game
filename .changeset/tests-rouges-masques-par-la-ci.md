---
"@bb/server": patch
---

Réparation des suites de tests rouges, et fin de leur masquage par la CI.

Deux workspaces de tests étaient rouges depuis un moment — 27 tests au total — sans que rien ne le signale : la CI exécutait `pnpm -w test || echo …`, qui avale le code de sortie. Le fallback visait les suites e2e (elles ont besoin d'une infra absente de ce runner et tournent dans `e2e.yml`), mais il masquait du même coup les vrais échecs des deux autres. Elles sont désormais vertes et **gatent** la CI ; les suites e2e sont exclues de la step au lieu d'annuler son résultat.

Rien de cosmétique dans ces échecs : chaque spec décrivait un état révolu du produit.

**Le serveur de test n'était ni attendu, ni arrêté.** Le démarrage était une attente en aveugle d'1,2 s, insuffisante dès que tsx doit compiler le serveur — toutes les specs qui parlent à l'API échouaient alors en `ECONNREFUSED`. On attend `/health`. Symétriquement, `teardown` était exporté depuis un `setupFiles`, où Vitest ne l'appelle jamais : chaque exécution laissait un serveur vivant derrière elle, et ils s'accumulaient. Le cycle de vie passe en `globalSetup`, dans son propre groupe de processus. Enfin `threads: false`, qui sérialisait la suite, n'existe plus depuis Vitest 2 : l'option était ignorée et chaque worker démarrait son propre serveur sur le même port.

**Les directions de poussée étaient inversées dans les tests.** Une poussée éloigne la cible de l'attaquant ; les deux specs attendaient l'opposé, la cible revenant sur son attaquant. Le moteur, lui, applique la bonne règle. Un garde-fou de sens est ajouté : appliquée à la cible, toute direction doit l'éloigner.

**Les slugs de postes anglais n'existaient plus.** `getPlayerCost` ne trouvait ni `skaven_blitzer` ni `skaven_lineman` et retombait sur son repli à 50 000 po pour tous : un Blitzer « coûtait » autant qu'un Trois-quart et le total d'équipe était faux de 150 000 po. Slugs et montants sont maintenant lus dans le roster.

**Le reste.** Un joueur sorti du terrain porte la sentinelle `{ x: -1, y: -1 }` que deux specs prenaient pour une erreur ; le socket factice du chat n'avait pas de `rooms` alors que le handler vérifie l'appartenance à la room du match (garde-fou désormais couvert par un test) ; `coachName` est requis à l'inscription ; les routes répondent dans l'enveloppe `{ success, data }` ; `/match/accept` rend « prematch-setup » depuis l'introduction de la séquence d'avant-match ; et `integration/**` tournait dans deux workspaces à la fois, dont un qui ne démarre aucun serveur.

Deux correctifs touchent le serveur, tous deux sur le chemin du miroir SQLite de test, sans rien changer à Postgres : `/admin/stats` filtrait `roles: { has: … }`, un filtre de liste Postgres qui n'existe pas sur la chaîne JSON du miroir (la route rendait 500 en test) ; et `/__test/seed-user` n'écrivait que `role` à la mise à jour alors que `roles` prime à la lecture, si bien que promouvoir un compte existant en administrateur ne faisait rien.
