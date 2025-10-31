import "./globals.css";
import type { ReactNode } from "react";
import AuthBar from "./AuthBar";
import Footer from "./components/Footer";

export const metadata = {
  title: "BlooBowl",
  description: "Jeu tour-par-tour web + mobile",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col">
        <div className="flex-1">
          <div className="max-w-5xl mx-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-8">
                <a href="/" className="text-lg font-semibold hover:underline">
                  BlooBowl
                </a>
                <nav className="flex items-center gap-6">
                  <a 
                    href="/star-players" 
                    className="text-sm font-medium text-neutral-700 hover:text-neutral-900 hover:underline transition-colors"
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
