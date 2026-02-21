"use client";

import { I18nextProvider } from "react-i18next";
import { useEffect } from "react";
import i18n from "@/i18n";

const LOCALE_KEY = "deluge-locale";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const saved = localStorage.getItem(LOCALE_KEY);
    if (saved && i18n.language !== saved) {
      i18n.changeLanguage(saved);
    }
    const syncLang = () => {
      if (typeof document !== "undefined") {
        document.documentElement.lang = i18n.language;
      }
    };
    syncLang();
    i18n.on("languageChanged", syncLang);
    return () => i18n.off("languageChanged", syncLang);
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

export { LOCALE_KEY };
