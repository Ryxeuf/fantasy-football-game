/**
 * Image Open Graph de la fiche d'équipe du coach.
 *
 * Même gate que `layout.tsx` : la carte n'est enrichie (logo, nom, fluff)
 * QUE si l'équipe a activé le partage public. Sinon on rend la carte
 * générique du site — un lien privé collé dans un salon ne doit pas révéler
 * le roster de son propriétaire.
 *
 * Le fichier est nécessaire ici : Next.js REMPLACE l'`openGraph` du parent
 * au niveau d'un segment qui le déclare (`resolveOpenGraph`), donc le
 * layout ci-contre perdrait l'image racine s'il ne trouvait pas la sienne.
 */
import { ImageResponse } from "next/og";
import {
  buildRosterShareOgContent,
  buildSiteOgContent,
} from "../../../lib/og-image-content";
import { OgImageTemplate } from "../../../lib/og-image-template";
import { resolveTeamOgLogo } from "../../../lib/og-team-logo";
import { loadSiteOgLogo } from "../../../lib/og-site-logo";
import { prettifySlug } from "../../../lib/roster-display";
import { fetchTeamSharePreview } from "../../../lib/team-share-preview";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr"
).replace(/\/$/, "");

export const runtime = "nodejs";
export const revalidate = 600;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { id: string } }) {
  const preview = await fetchTeamSharePreview(params.id);

  if (!preview) {
    const logoUrl = await loadSiteOgLogo();
    return new ImageResponse(
      (
        <OgImageTemplate
          content={buildSiteOgContent({ logoUrl: logoUrl ?? undefined })}
          canonicalUrl={SITE_URL.replace(/^https?:\/\//, "")}
        />
      ),
      size,
    );
  }

  const content = buildRosterShareOgContent({
    teamName: preview.name,
    raceName: prettifySlug(preview.roster) || "Blood Bowl",
    teamValue: preview.teamValue,
    playerCount: preview.playerCount,
    starPlayerNames: preview.starPlayerNames.map((slug) => prettifySlug(slug)),
    ruleset: preview.ruleset,
    description: preview.description,
    logo: resolveTeamOgLogo({
      logoUrl: preview.logoUrl,
      roster: preview.roster,
      assetBase: SITE_URL,
    }),
  });

  return new ImageResponse(
    (
      <OgImageTemplate
        content={content}
        canonicalUrl={
          preview.shareToken
            ? `${SITE_URL}/r/${preview.shareToken}`
            : SITE_URL.replace(/^https?:\/\//, "")
        }
      />
    ),
    size,
  );
}
