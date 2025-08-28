import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "BlooBowl",
  description: "Jeu tour-par-tour web + mobile",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-neutral-50 text-neutral-900">
        <div className="max-w-5xl mx-auto p-6">{children}</div>
      </body>
    </html>
  );
}
