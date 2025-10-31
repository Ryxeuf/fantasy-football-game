import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import AuthBar from "./AuthBar";
import Footer from "./components/Footer";
import Logo from "./components/Logo";

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
        <div className="flex-1">
          <div className="max-w-5xl mx-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-8">
                <Logo variant="compact" showText={true} />
                <nav className="flex items-center gap-6">
                  <a 
                    href="/skills" 
                    className="text-sm font-subtitle font-semibold text-nuffle-bronze hover:text-nuffle-gold hover:underline transition-colors"
                  >
                    📚 Compétences
                  </a>
                  <a 
                    href="/star-players" 
                    className="text-sm font-subtitle font-semibold text-nuffle-bronze hover:text-nuffle-gold hover:underline transition-colors"
                  >
                    ⭐ Star Players
                  </a>
                </nav>
              </div>
              <AuthBar />
            </div>
            {children}
          </div>
        </div>
        <Footer />
      </body>
    </html>
  );
}
