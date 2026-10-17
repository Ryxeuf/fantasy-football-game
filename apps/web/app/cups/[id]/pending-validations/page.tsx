"use client";

import { useParams } from "next/navigation";
import PendingValidationsView from "../../../components/competition/PendingValidationsView";

// « Matchs à valider » d'une coupe : cible de la notification du commissaire
// quand les deux coachs d'une rencontre ont soumis leur feuille.
export default function CupPendingValidationsPage() {
  const params = useParams<{ id: string }>();
  return <PendingValidationsView competition="cup" competitionId={params?.id ?? ""} />;
}
