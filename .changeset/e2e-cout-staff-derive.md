---
"@bb/web": patch
---

Builder d'équipe : le mapping du catalogue de rosters ne perdait plus les options de Ligue régionale (liste blanche explicite qui oubliait `regionalLeagueOptions`, d'où un sélecteur invisible dans le builder alors que l'API renvoyait bien le champ).
