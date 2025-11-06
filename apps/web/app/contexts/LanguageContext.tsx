"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { translations, type Language } from "../i18n/translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations.fr;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Toujours initialiser à "fr" pour éviter les erreurs d'hydratation
  // La langue sera mise à jour après le montage côté client
  const [language, setLanguageState] = useState<Language>("fr");

  useEffect(() => {
    // Après le montage, charger la langue depuis localStorage
    const stored = localStorage.getItem("language") as Language | null;
    if (stored === "fr" || stored === "en") {
      setLanguageState(stored);
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
    // Mettre à jour l'attribut lang du html
    if (typeof document !== "undefined") {
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

