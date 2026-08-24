/**
 * Puces du bloc « Informations importantes » de la page d'édition d'équipe.
 *
 * Extrait en fonction pure parce que le texte précédent était faux sur
 * plusieurs points : il annonçait des compétences non modifiables (le bouton
 * « + Compétence » en ajoute pourtant contre des SPP), un plafond de 11-16
 * joueurs écrit en dur (Sevens joue à 7-11) et passait sous silence le fait
 * que le staff a son propre bouton de sauvegarde.
 */

export interface ImportantNotesInput {
  /** Nombre minimum de joueurs à l'enregistrement (format de l'équipe). */
  readonly minPlayers: number;
  /** Nombre maximum de joueurs à l'enregistrement (format de l'équipe). */
  readonly maxPlayers: number;
  /** Budget de construction, en kpo (`Team.initialBudget`). */
  readonly initialBudgetK: number;
}

export function buildImportantNotes({
  minPlayers,
  maxPlayers,
  initialBudgetK,
}: ImportantNotesInput): readonly string[] {
  return [
    "Le nom et le numéro de chaque joueur se modifient ici : les numéros doivent être uniques et compris entre 1 et 99, et aucun joueur ne peut rester sans nom",
    "Les caractéristiques (MA, ST, AG, PA, AV) et les compétences ne se saisissent pas à la main : elles s'obtiennent en dépensant les SPP du joueur via le bouton « + Compétence »",
    `Vous pouvez ajouter/retirer des joueurs et descendre sous ${minPlayers} tant que l'équipe n'est pas engagée ; l'équipe est validée (${minPlayers}-${maxPlayers} joueurs, budget) au moment de l'enregistrement`,
    "Chaque poste a des limites min/max fixées par le roster",
    `Le total joueurs + staff + Star Players ne doit pas dépasser le budget initial de ${initialBudgetK.toLocaleString("fr-FR")}k po`,
    "Le staff (relances, cheerleaders, assistants, apothicaire, fans dévoués) se sauvegarde à part, avec le bouton « Sauvegarder » de son propre bloc",
  ];
}
