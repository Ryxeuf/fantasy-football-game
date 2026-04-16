import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Soutenir Nuffle Arena - Dons & Transparence",
  description:
    "Soutenez Nuffle Arena, votre plateforme gratuite de Blood Bowl en ligne. Dons via Ko-fi, transparence financière et FAQ.",
  keywords: [
    "soutenir",
    "don",
    "ko-fi",
    "nuffle arena",
    "blood bowl",
    "gratuit",
    "communauté",
  ],
  openGraph: {
    title: "Soutenir Nuffle Arena",
    description:
      "Nuffle Arena est 100 % gratuit. Aidez-nous à couvrir les frais de serveurs et à continuer le développement.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Soutenir Nuffle Arena",
    description:
      "Nuffle Arena est 100 % gratuit. Aidez-nous à couvrir les frais de serveurs et à continuer le développement.",
  },
};

export default function SupportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
