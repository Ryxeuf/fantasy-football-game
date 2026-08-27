"use client";

import { TeamRuleCatalogueAdmin } from "../_components/TeamRuleCatalogueAdmin";

export default function AdminSpecialRulesPage() {
  return (
    <TeamRuleCatalogueAdmin
      title="🛡️ Règles spéciales d'équipe"
      subtitle="Libellés et descriptions servis par la base aux fiches de roster, aux fiches d'équipe et au commissaire."
      endpoint="/admin/data/special-rules"
      testId="admin-special-rules"
    />
  );
}
