"use client";

import { useTranslation } from "react-i18next";
import { LOCALE_KEY } from "./I18nProvider";

const LOCALES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
] as const;

export function LanguageSwitcher() {
  const { i18n } = useTranslation("common");

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as "en" | "es" | "pt";
    localStorage.setItem(LOCALE_KEY, value);
    i18n.changeLanguage(value);
    if (typeof document !== "undefined") {
      document.documentElement.lang = value;
    }
  };

  return (
    <select
      value={i18n.language}
      onChange={handleChange}
      className="rounded border border-charcoal/20 bg-cream/50 px-3 py-1.5 text-sm text-charcoal focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      aria-label="Select language"
    >
      {LOCALES.map(({ code, label }) => (
        <option key={code} value={code}>
          {label}
        </option>
      ))}
    </select>
  );
}
