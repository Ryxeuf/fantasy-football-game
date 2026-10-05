"use client";
import { LanguageProvider } from "../contexts/LanguageContext";
import { FeatureFlagProvider } from "../contexts/FeatureFlagContext";
import { NotificationsProvider } from "../contexts/NotificationsContext";
import { DiceThemeProvider } from "../contexts/DiceThemeContext";
import { CrownsProvider } from "../contexts/CrownsContext";
import { ReactNode } from "react";
import { Toaster } from "sonner";

export function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <FeatureFlagProvider>
        {/* Compteur de notifications non lues partagé par la cloche de
            l'en-tête, le menu utilisateur et la page /me/notifications. */}
        <NotificationsProvider>
          {/* Couronnes du coach (flag `crowns`) et thème de dés (flag
              `dice_themes`, dé original sinon — y compris pour le match en
              ligne, via le skin de `@bb/ui`). */}
          <CrownsProvider>
            <DiceThemeProvider>{children}</DiceThemeProvider>
          </CrownsProvider>
          <Toaster
            position="top-right"
            richColors
            closeButton
            expand={false}
            duration={4000}
          />
        </NotificationsProvider>
      </FeatureFlagProvider>
    </LanguageProvider>
  );
}

