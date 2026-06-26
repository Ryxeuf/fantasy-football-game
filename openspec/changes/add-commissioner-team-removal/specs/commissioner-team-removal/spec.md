# commissioner-team-removal (delta)

Capability : la suppression *dure* d'une équipe ou d'un joueur par le
**commissaire** d'une ligue, autorisée uniquement avant le démarrage et tant
que l'équipe n'a participé à aucun match. Surface serveur (`apps/server`) avec
une UI commissaire (`apps/web`). Distincte du retrait coach (soft `withdrawn`)
et de l'édition ex-post (mutation in-place).

## ADDED Requirements

### Requirement: Suppression d'une équipe par le commissaire
Le commissaire d'une ligue DOIT pouvoir supprimer définitivement une équipe
d'une de ses saisons (suppression du `LeagueParticipant`), tant que la saison
n'a pas démarré (statut `draft` ou `scheduled`) ET que l'équipe n'a participé à
aucun match. Seul le commissaire de la ligue DOIT être autorisé. Chaque
suppression DOIT être journalisée.

#### Scenario: Suppression avant le démarrage
- WHEN le commissaire supprime une équipe d'une saison en `draft` ou `scheduled`
  et que cette équipe n'a participé à aucun match
- THEN le participant DOIT être supprimé de la saison
- AND l'action DOIT être journalisée (`AuditLog`)

#### Scenario: Refus après démarrage
- WHEN le commissaire tente de supprimer une équipe d'une saison `in_progress`
  ou `completed`
- THEN la suppression DOIT être refusée (`season_started`, HTTP 409)
- AND le participant NE DOIT PAS être supprimé

#### Scenario: Refus si l'équipe a déjà joué
- WHEN le commissaire tente de supprimer une équipe ayant au moins un pairing
  engagé (`in_progress`, `played`, `forfeit_home` ou `forfeit_away`) dans la ligue
- THEN la suppression DOIT être refusée (`team_has_played`, HTTP 409)

#### Scenario: Équipe non inscrite
- WHEN le commissaire vise une équipe qui n'est pas inscrite sur la saison ciblée
- THEN la suppression DOIT être refusée (`team_not_in_league`, HTTP 404)

### Requirement: Suppression d'un joueur par le commissaire
Le commissaire DOIT pouvoir supprimer définitivement un joueur (`TeamPlayer`)
du roster d'une équipe inscrite dans sa ligue, tant que l'équipe n'a participé à
aucun match dans la ligue. Le joueur DOIT appartenir à l'équipe ciblée. Chaque
suppression DOIT être journalisée.

#### Scenario: Suppression d'un joueur pré-saison
- WHEN le commissaire supprime un joueur d'une équipe dont aucune participation
  à un match n'existe dans la ligue
- THEN le joueur DOIT être supprimé du roster
- AND l'action DOIT être journalisée (`AuditLog`)

#### Scenario: Refus si l'équipe a déjà joué
- WHEN le commissaire tente de supprimer un joueur d'une équipe ayant déjà
  participé à un match dans la ligue
- THEN la suppression DOIT être refusée (`team_has_played`, HTTP 409)

#### Scenario: Joueur étranger à l'équipe
- WHEN le joueur ciblé n'appartient pas à l'équipe indiquée
- THEN la suppression DOIT être refusée (`player_not_in_team`, HTTP 409)

#### Scenario: Joueur introuvable
- WHEN le joueur ciblé n'existe pas
- THEN la suppression DOIT être refusée (`player_not_found`, HTTP 404)

### Requirement: Autorisation réservée au commissaire
Les deux suppressions DOIVENT être réservées au commissaire (créateur) de la
ligue ciblée. Tout autre utilisateur DOIT être refusé (HTTP 403), et une ligue
inexistante DOIT renvoyer HTTP 404.

#### Scenario: Utilisateur non commissaire
- WHEN un utilisateur qui n'est pas le commissaire de la ligue tente une
  suppression d'équipe ou de joueur
- THEN la requête DOIT être refusée (HTTP 403)
- AND aucune suppression NE DOIT être effectuée

### Requirement: Définition de la participation à un match
Une équipe est réputée avoir participé à un match dès qu'il existe, dans une
saison de la ligue, un pairing la concernant dont le statut est `in_progress`,
`played`, `forfeit_home` ou `forfeit_away`. Un pairing `scheduled` ou
`cancelled` NE DOIT PAS être considéré comme une participation.

#### Scenario: Pairing planifié non bloquant
- WHEN une équipe n'a que des pairings `scheduled` (ou `cancelled`) dans la ligue
- THEN elle est réputée n'avoir participé à aucun match
- AND sa suppression (sous réserve des autres gardes) DOIT rester possible

#### Scenario: Forfait compte comme participation
- WHEN une équipe a un pairing `forfeit_home` ou `forfeit_away` dans la ligue
- THEN elle est réputée avoir participé à un match
- AND sa suppression DOIT être refusée
