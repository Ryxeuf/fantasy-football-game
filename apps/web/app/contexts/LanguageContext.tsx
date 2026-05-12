"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { translations, type Language } from "../i18n/translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations.fr | typeof translations.en;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Toujours initialiser à "fr" pour éviter les erreurs d'hydratation
  // La langue sera mise à jour après le montage côté client
  const [language, setLanguageState] = useState<Language>("fr");

  useEffect(() => {
    // Après le montage, charger la langue depuis localStorage en
    // priorite (choix explicite user), sinon depuis le cookie
    // `NEXT_LOCALE` (auto-detecte au middleware via Accept-Language —
    // Sprint R lot R.A.1).
    const stored = localStorage.getItem("language") as Language | null;
    if (stored === "fr" || stored === "en") {
      setLanguageState(stored);
      return;
    }
    if (typeof document !== "undefined") {
      const match = /(?:^|; )NEXT_LOCALE=([^;]+)/.exec(document.cookie);
      const cookie = match ? decodeURIComponent(match[1]) : null;
      if (cookie === "fr" || cookie === "en") {
        setLanguageState(cookie);
      }
    }
  }, []);

  useEffect(() => {
    // Mettre à jour l'attribut lang du html
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("language", lang);
    // Sprint R.A.1 — sync le cookie NEXT_LOCALE pour que le serveur
    // SSR/middleware voie la meme langue au prochain reload.
    if (typeof document !== "undefined") {
      const oneYear = 60 * 60 * 24 * 365;
      document.cookie = `NEXT_LOCALE=${encodeURIComponent(lang)}; Max-Age=${oneYear}; Path=/; SameSite=Lax`;
      document.documentElement.lang = lang;
    }
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: translations[language] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

