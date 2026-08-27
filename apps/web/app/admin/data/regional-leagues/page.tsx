"use client";

import { TeamRuleCatalogueAdmin } from "../_components/TeamRuleCatalogueAdmin";

export default function AdminRegionalLeaguesPage() {
  return (
    <TeamRuleCatalogueAdmin
      title="🗺️ Ligues régionales"
      subtitle="Catalogue des Ligues proposées à la création d'une équipe et affichées sur les fiches de roster."
      endpoint="/admin/data/regional-leagues"
      testId="admin-regional-leagues"
    />
  );
}
