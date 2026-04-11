# Playbook 01 — Match complet (happy path)

**Objectif :** valider manuellement qu'un match multijoueur complet
(pré-match, setup, 2 × 8 tours, fin de match) s'enchaîne sans blocage.

**Durée estimée :** 30–45 minutes.

**Prérequis :** 2 machines (ou 2 navigateurs en mode navigation privée),
serveur et front lancés en mode dev ou staging.

## Setup

1. [ ] Lancer `docker compose up` (ou `make dev`) et vérifier
      `curl http://localhost:8201/health` → `{"ok":true}`.
2. [ ] Créer 2 coachs distincts (Alice / Bob) avec 2 équipes distinctes
      (Skaven vs Lizardmen recommandé).
3. [ ] Ouvrir `/play` sur les 2 navigateurs.

## Création + acceptation

4. [ ] Alice clique **"Créer une partie"** → redirection vers
      `/waiting/<id>`.
5. [ ] Copier l'`<id>` et le coller dans le champ "ID de la partie" de Bob.
6. [ ] Bob clique **"Rejoindre"** → Bob est aussi sur
      `/waiting/<id>`.
7. [ ] Les deux coachs cliquent **"Accepter"** → redirection vers
      `/play/<id>`.

## Pré-match

8. [ ] La synthèse pré-match apparaît pour les deux joueurs
      (fan factor, weather, éventuels journeymen).
9. [ ] Si inducement selector présent : l'équipe avec moins de CTV
      sélectionne ses inducements ou clique **Skip**.
10. [ ] La phase passe à `setup`.

## Setup

11. [ ] L'équipe receveuse place ses 11 joueurs (drag & drop depuis
       le dugout) :
       - 3 joueurs minimum sur la Line of Scrimmage
       - max 2 joueurs par wide zone
       - bouton **"Prêt"** actif seulement quand les 11 joueurs sont sur
         le terrain.
12. [ ] Même chose pour l'équipe botteuse.
13. [ ] Déclenchement du kickoff → la balle est lancée, les événements
       de kickoff sont résolus.

## Drive 1 — tours 1 à 8 (mi-temps 1)

14. [ ] Chaque coach joue ses tours. Valider qu'à chaque tour :
       - [ ] seul le joueur actif peut bouger ses pions
       - [ ] les actions MOVE / BLOCK / PASS / BLITZ sont proposées
       - [ ] les jets de dés et leurs résultats sont visibles
       - [ ] les turnovers (échec dodge, fumble) terminent bien le tour
       - [ ] les blessures sont persistées dans le dugout
15. [ ] Après touchdown : reset → nouveau kickoff.
16. [ ] Fin du tour 8 → mi-temps → récupération des KO, nouveau setup.

## Drive 2 — tours 9 à 16 (mi-temps 2)

17. [ ] Même procédure que drive 1, cette fois avec les équipes inversées
       côté LoS.
18. [ ] Fin du tour 16 → écran de fin de match.

## Fin de match

19. [ ] Les deux coachs voient :
       - [ ] le score final
       - [ ] les SPP gagnés par joueur
       - [ ] le MVP
       - [ ] les blessures permanentes (niggling, -1, mort)
       - [ ] les gains (treasury)
       - [ ] le changement d'ELO

## Sanity checks UX

- [ ] Chat fonctionnel toute la partie (pas d'erreur console).
- [ ] Pas de duplication d'événements sur le plateau après reconnect.
- [ ] Le timer de tour (si activé) se remet à zéro à chaque switch.
- [ ] Les notifications sonores se déclenchent aux moments clés.

**À remplir en fin de passe :**

- Version / commit testé : ______________
- Durée réelle : ______________
- Bugs trouvés (lien issue) : ______________
