"use client";
import { LanguageProvider } from "../contexts/LanguageContext";
import { FeatureFlagProvider } from "../contexts/FeatureFlagContext";
import { NotificationsProvider } from "../contexts/NotificationsContext";
import { ReactNode } from "react";
import { Toaster } from "sonner";

export function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <FeatureFlagProvider>
        {/* Compteur de notifications non lues partagé par la cloche de
            l'en-tête, le menu utilisateur et la page /me/notifications. */}
        <NotificationsProvider>
          {children}
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

