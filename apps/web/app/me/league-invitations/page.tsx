"use client";

import { PendingLeagueInvitations } from "../../leagues/_components/PendingLeagueInvitations";

// "Mes invitations" : liste des invitations de ligue pending reçues par
// l'utilisateur courant. Délègue au composant partagé `PendingLeagueInvitations`
// (réutilisé aussi dans /leagues), qui gère accepter (lien vers la page
// d'acceptation) et refuser (inline).

export default function MyInvitationsPage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-bold">Mes invitations de ligue</h1>
      <PendingLeagueInvitations showWhenEmpty title="Invitations reçues" />
    </main>
  );
}
