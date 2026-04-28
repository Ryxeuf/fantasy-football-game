# Memoire incidents de deploy

## 2026-04-28 - Rollback inefficace sur `deploy.sh`

### Symptomes observes
- Le deploy a echoue puis a execute un rollback.
- Le rollback a cible le commit courant local (`PREVIOUS_COMMIT`) au lieu du dernier commit reellement en production.
- Resultat: rollback "reussi" dans les logs, mais vers un commit potentiellement non stable/non deploye.

### Cause racine
- `scripts/deploy.sh` utilisait `PREVIOUS_COMMIT=$(git rev-parse HEAD)` comme cible de rollback.
- Quand le repo local est deja en avance sur la prod (cas courant apres pull manuel/auto), `HEAD` local n'est pas la version en service.
- Le script disposait deja de `.last-deployed-commit`, mais cette reference n'etait pas utilisee pour le rollback.

### Correctif applique
- Le script calcule maintenant `ROLLBACK_COMMIT` a partir de `.last-deployed-commit` (fallback `PREVIOUS_COMMIT` si indisponible).
- Toutes les actions de rollback (`git reset`, logs, notifications Discord) utilisent desormais `ROLLBACK_COMMIT`.
- Le log de depart inclut explicitement la cible rollback pour audit.

### Prevention (checklist)
- Verifier que `.last-deployed-commit` est mis a jour uniquement apres un deploy completement healthy.
- En cas d'echec deploy, verifier dans `deploy.log` la ligne `rollback target`.
- Ne plus utiliser `HEAD` local comme source de verite pour rollback production.
