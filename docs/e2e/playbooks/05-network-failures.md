# Playbook 05 — Coupures réseau & forfeit

**Objectif :** valider le comportement du serveur et de l'UI quand un
joueur perd la connexion, ferme sa page, ou tente de reconnecter.

**Durée estimée :** 10 minutes.

## Reconnexion "propre" (rafraîchir F5)

1. [ ] Alice et Bob sont dans un match actif, tour 3.
2. [ ] Alice rafraîchit son onglet (F5).
3. [ ] Attendre ≤ 5 secondes → la vue se recharge, le plateau est
      identique, le chat est conservé.
4. [ ] Bob voit brièvement `game:player-disconnected` puis
      `game:player-connected` (pas d'alerte forfeit).

## Fermeture d'onglet → réouverture

5. [ ] Alice ferme complètement son onglet.
6. [ ] Bob voit une bannière "Adversaire déconnecté".
7. [ ] Alice rouvre `/play-hidden/<id>` dans les 10 secondes → la
      bannière disparaît côté Bob.
8. [ ] Le match reprend normalement.

## Coupure réseau simulée

Dans DevTools → onglet Network → Offline.

9. [ ] Couper le réseau d'Alice pendant son tour.
10. [ ] Alice tente un move → l'UI indique "connexion perdue".
11. [ ] Bob voit une alerte + le compte à rebours forfeit.
12. [ ] Réactiver le réseau avant le timeout → Alice revient dans la
       partie.
13. [ ] Alice relance son action → elle s'applique.

## Forfeit par timeout

14. [ ] Couper le réseau d'Alice pendant 30+ secondes (au-delà du timeout
       configuré).
15. [ ] Bob reçoit `game:match-forfeited`.
16. [ ] Le scoreboard indique "forfait" et le match passe en status
       `ended`.
17. [ ] Alice revient en ligne → elle voit l'écran de fin avec son
       forfait enregistré.

## Spectateur (si implémenté)

18. [ ] Carol (3e user) ouvre `/spectate/<id>` → elle voit le match en
       lecture seule.
19. [ ] Quand Alice joue une action, Carol la voit apparaître aussi.
20. [ ] Carol ferme son onglet → pas d'impact sur Alice/Bob.

## Sanity checks serveur

- [ ] Les logs serveur ne montrent pas d'erreur "Unhandled promise
      rejection".
- [ ] `game-rooms` log bien chaque join/leave avec le compteur mis à
      jour.
- [ ] Aucun socket "zombie" : après déconnexion, la room a bien 0 ou 1
      sockets, pas N > 2.

**Version / commit testé :** ______________
