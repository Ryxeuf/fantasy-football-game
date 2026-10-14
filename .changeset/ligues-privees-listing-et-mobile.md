---
"@bb/server": patch
"@bb/mobile": patch
---

Deux corrections sur les listes de ligues.

**Les ligues privées ne fuient plus par le listing.** `GET /leagues?publicOnly=false` retirait tout filtre de visibilité pour n'importe quel coach connecté : il suffisait de l'appeler pour obtenir le nom, la description et le créateur de toutes les ligues privées. Ce paramètre est désormais réservé aux administrateurs ; pour un coach, il retombe sur la vue habituelle (ligues publiques, plus celles dont il est commissaire, inscrit ou invité).

**Les écrans Ligues de l'application mobile fonctionnent à nouveau.** Ils appelaient `/league` au lieu de `/leagues` (404 sur la liste, le détail, la saison et le classement), et lisaient les réponses sans déplier l'enveloppe `{ success, data }` du serveur. Le classement affiche aussi les touchdowns servis par le serveur.
