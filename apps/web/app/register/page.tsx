"use client";
import { useLanguage } from "../contexts/LanguageContext";

export default function RegisterPage() {
  const { t } = useLanguage();

  return (
    <div className="w-full p-4 sm:p-6 flex justify-center min-h-[60vh]">
      <div className="max-w-md w-full text-center">
        <div className="mb-6 text-6xl">🚧</div>
        <h1 className="text-xl sm:text-2xl font-bold mb-4">{t.register.preAlphaTitle}</h1>
        <p className="text-gray-600 text-sm sm:text-base mb-6">
          {t.register.preAlphaMessage}
        </p>
        <a
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm sm:text-base"
          href="/login"
        >
          {t.login.title}
        </a>
      </div>
    </div>
  );
}
