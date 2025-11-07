import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import Footer from "./components/Footer";
import Header from "./components/Header";
import { ClientLayout } from "./components/ClientLayout";

export const metadata: Metadata = {
  title: "Nuffle Arena",
  description: "Formez vos équipes. Défiez le destin. L'arène où le hasard devient divin.",
  icons: {
    icon: "/images/favicon.png",
    apple: "/images/favicon.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Cinzel:wght@400;600;700&family=Montserrat:wght@400;600;700&family=Inter:wght@400;500;600&family=Bebas+Neue&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-nuffle-ivory text-nuffle-anthracite flex flex-col font-body antialiased">
        <ClientLayout>
          <div className="flex-1 w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]">
            <div className="w-full p-6">
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
