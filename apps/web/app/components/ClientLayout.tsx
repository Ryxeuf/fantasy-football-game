"use client";
import { LanguageProvider } from "../contexts/LanguageContext";
import { FeatureFlagProvider } from "../contexts/FeatureFlagContext";
import { ReactNode } from "react";

export function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <FeatureFlagProvider>{children}</FeatureFlagProvider>
    </LanguageProvider>
  );
}

