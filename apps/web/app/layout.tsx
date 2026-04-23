import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import Script from "next/script";
import { Cinzel_Decorative, Cinzel, Montserrat, Inter, Bebas_Neue } from "next/font/google";
import Footer from "./components/Footer";
import Header from "./components/Header";
import { ClientLayout } from "./components/ClientLayout";

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
    default: "Nuffle Arena - Gestionnaire d'équipes Blood Bowl",
    template: "%s | Nuffle Arena",
  },
  description: "Formez vos équipes Blood Bowl. Défiez le destin. L'arène où le hasard devient divin. Créez et gérez vos équipes, explorez les rosters officiels et les Star Players.",
  keywords: [
    "Blood Bowl",
    "Fantasy Football",
    "Gestionnaire d'équipes",
    "Roster",
    "Star Players",
    "Nuffle Arena",
    "Jeu de plateau",
    "Warhammer",
    "Games Workshop",
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
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: baseUrl,
    siteName: "Nuffle Arena",
    title: "Nuffle Arena - Gestionnaire d'équipes Blood Bowl",
    description: "Formez vos équipes Blood Bowl. Défiez le destin. L'arène où le hasard devient divin.",
    images: [
      {
        url: `${baseUrl}/images/logo.png`,
        width: 1200,
        height: 630,
        alt: "Nuffle Arena - Gestionnaire d'équipes Blood Bowl",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nuffle Arena - Gestionnaire d'équipes Blood Bowl",
    description: "Formez vos équipes Blood Bowl. Défiez le destin. L'arène où le hasard devient divin.",
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
  verification: {
    // Ajoutez vos codes de vérification ici si nécessaire
    // google: "votre-code-google",
    // yandex: "votre-code-yandex",
    // bing: "votre-code-bing",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={`scroll-smooth ${cinzelDecorative.variable} ${cinzel.variable} ${montserrat.variable} ${inter.variable} ${bebasNeue.variable}`}>
      <body className="min-h-screen bg-nuffle-ivory text-nuffle-anthracite flex flex-col font-body antialiased">
        {process.env.NEXT_PUBLIC_UMAMI_ENABLED === "true" && (
          <Script
            src="https://umami.ryxeuf.fr/script.js"
            data-website-id="cda1e0dd-b79b-402d-947d-7cb02ffe13e3"
            strategy="afterInteractive"
            defer
          />
        )}
        <ClientLayout>
          <div className="flex-1 w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]">
            <div className="w-full p-4 sm:p-6">
              <Header />
              {children}
            </div>
          </div>
          <Footer />
        </ClientLayout>
      </body>
    </html>
  );
}
