/**
 * Annonce qu'une équipe est supprimée, donc en lecture seule. Le serveur
 * refuse toute écriture (`rejectDeletedTeamWrite`) ; ce bandeau explique
 * pourquoi la fiche n'offre plus aucune modification.
 */

interface DeletedTeamBannerProps {
  readonly teamId: string;
  readonly deletedAt: string;
  /** Seul un admin peut restaurer une équipe, depuis la console. */
  readonly isAdmin: boolean;
}

function formatDeletionDate(deletedAt: string): string | null {
  const date = new Date(deletedAt);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString("fr-FR");
}

export default function DeletedTeamBanner({
  teamId,
  deletedAt,
  isAdmin,
}: DeletedTeamBannerProps) {
  const date = formatDeletionDate(deletedAt);
  return (
    <div
      role="status"
      data-testid="team-deleted-banner"
      className="bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded"
    >
      <div className="font-semibold">
        🗑️ Équipe supprimée{date ? ` le ${date}` : ""}
      </div>
      <div className="text-sm mt-1">
        Cette fiche est en lecture seule : l&apos;équipe ne peut plus être
        modifiée.
        {isAdmin ? (
          <>
            {" "}
            <a
              data-testid="team-deleted-restore-link"
              href={`/admin/teams/${teamId}`}
              className="font-medium underline"
            >
              La restaurer depuis la console
            </a>
          </>
        ) : null}
      </div>
    </div>
  );
}
