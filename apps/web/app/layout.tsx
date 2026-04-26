import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Cinzel_Decorative, Cinzel, Montserrat, Inter, Bebas_Neue } from "next/font/google";
import Footer from "./components/Footer";
import Header from "./components/Header";
import { ClientLayout } from "./components/ClientLayout";
import WebVitalsReporter from "./components/WebVitalsReporter";
import { buildWebmasterVerification } from "./lib/webmaster-verification";

const cinzelDecorative = Cinzel_Decorative({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-cinzel-decorative",
  display: "swap",
});

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-cinzel",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-montserrat",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bebas-neue",
  display: "swap",
});

// URL de base pour les métadonnées
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "Nuffle Arena — Gestionnaire d'équipes Blood Bowl (Saison 3, 2025)",
    template: "%s | Nuffle Arena",
  },
  description:
    "Nuffle Arena : gestionnaire d'équipes Blood Bowl 100% gratuit. 30 rosters officiels Saison 3, 60+ Star Players, 130+ compétences, export PDF et suivi de match sur table.",
  applicationName: "Nuffle Arena",
  category: "games",
  keywords: [
    "Blood Bowl",
    "Blood Bowl 2025",
    "Blood Bowl Saison 3",
    "Blood Bowl Season 3",
    "Fantasy Football",
    "Gestionnaire d'équipes",
    "Team manager",
    "Roster Blood Bowl",
    "Roster builder",
    "Star Players",
    "Nuffle Arena",
    "Jeu de plateau",
    "Tabletop",
    "Warhammer",
    "Games Workshop",
    "Skaven",
    "Orques",
    "Nains",
    "Hommes-Lézards",
    "Export PDF Blood Bowl",
    "Compétences Blood Bowl",
    "Coach Blood Bowl",
  ],
  authors: [{ name: "Nuffle Arena" }],
  creator: "Nuffle Arena",
  publisher: "Nuffle Arena",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: "/images/favicon-optimized.png",
    apple: "/images/favicon-optimized.png",
  },
  manifest: "/manifest.json",
  alternates: {
    canonical: baseUrl,
    languages: {
      "fr-FR": baseUrl,
      en: baseUrl,
      "x-default": baseUrl,
    },
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    alternateLocale: ["en_US"],
    url: baseUrl,
    siteName: "Nuffle Arena",
    title: "Nuffle Arena — Gestionnaire d'équipes Blood Bowl (Saison 3, 2025)",
    description:
      "30 rosters officiels, 60+ Star Players, 130+ compétences. Créez, exportez et suivez vos équipes Blood Bowl — 100% gratuit.",
    images: [
      {
        url: `${baseUrl}/images/logo.png`,
        width: 1200,
        height: 630,
        alt: "Nuffle Arena — Gestionnaire d'équipes Blood Bowl",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nuffle Arena — Gestionnaire d'équipes Blood Bowl",
    description:
      "Gestionnaire Blood Bowl gratuit : 30 rosters, 60+ Star Players, 130+ compétences, export PDF et suivi de match sur table.",
    images: [`${baseUrl}/images/logo.png`],
    creator: "@nufflearena",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  other: {
    // Geo signals pour le référencement local (GEO / regional SEO).
    // Le site cible en priorité la communauté francophone (France).
    "geo.region": "FR",
    "geo.placename": "France",
    "ICBM": "46.603354, 1.888334",
  },
  // Codes de vérification webmasters (Q.17 — Sprint 23).
  // Pilote depuis l'env public, valide via `buildWebmasterVerification`
  // (rejet des placeholders, chaines vides, espaces internes, > 200 chars).
  // Variables : NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  //            NEXT_PUBLIC_YANDEX_VERIFICATION,
  //            NEXT_PUBLIC_BING_SITE_VERIFICATION (devient meta msvalidate.01).
  verification: buildWebmasterVerification({
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION:
      process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    NEXT_PUBLIC_YANDEX_VERIFICATION:
      process.env.NEXT_PUBLIC_YANDEX_VERIFICATION,
    NEXT_PUBLIC_BING_SITE_VERIFICATION:
      process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION,
  }),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={`scroll-smooth ${cinzelDecorative.variable} ${cinzel.variable} ${montserrat.variable} ${inter.variable} ${bebasNeue.variable}`}>
      <head>
        {process.env.NEXT_PUBLIC_UMAMI_ENABLED === "true" && (
          <script
            defer
            src="https://umami.ryxeuf.fr/script.js"
            data-website-id="cda1e0dd-b79b-402d-947d-7cb02ffe13e3"
          />
        )}
      </head>
      <body className="min-h-screen bg-nuffle-ivory text-nuffle-anthracite flex flex-col font-body antialiased">
        {/* A11y: skip-link visible au focus clavier (Q.21). */}
        <a href="#main-content" className="skip-link">
          Aller au contenu principal
        </a>
        <WebVitalsReporter />
        <ClientLayout>
          <div className="flex-1 w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]">
            <div className="w-full p-4 sm:p-6">
              <Header />
              <main id="main-content">{children}</main>
            </div>
          </div>
          <Footer />
        </ClientLayout>
      </body>
    </html>
  );
}
