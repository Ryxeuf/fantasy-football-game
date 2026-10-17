"use client";

import { useParams } from "next/navigation";
import PendingValidationsView from "../../../components/competition/PendingValidationsView";

// Lot H — Page "Matchs a valider" du commissaire (cible du deep-link
// de la notification push). Même vue que celle d'une coupe.
export default function PendingValidationsPage() {
  const params = useParams<{ id: string }>();
  return (
    <PendingValidationsView competition="league" competitionId={params?.id ?? ""} />
  );
}
