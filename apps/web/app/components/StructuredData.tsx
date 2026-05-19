import Script from "next/script";
import { safeJsonLd } from "../lib/safe-json-ld";

interface StructuredDataProps {
  data: Record<string, any>;
}

/**
 * Composant pour ajouter des données structurées JSON-LD à une page.
 * Audit round 9 : `safeJsonLd` echappe `<`, `>`, `&`, U+2028/U+2029
 * pour eviter un XSS via `</script>` breakout sur des champs user-
 * controlled.
 */
export default function StructuredData({ data }: StructuredDataProps) {
  return (
    <Script
      id="structured-data"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  );
}

