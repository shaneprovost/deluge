"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function Header() {
  const pathname = usePathname();
  const { t } = useTranslation("common");
  const isHome = pathname === "/";

  return (
    <header className="sticky top-0 z-10 bg-cream/95 backdrop-blur-sm border-b border-charcoal/10 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          {!isHome ? (
            <Link
              href="/"
              className="font-serif text-xl text-primary hover:opacity-80 transition flex items-center gap-2"
              aria-label="Home"
            >
              <span className="text-lg">←</span>
              <span>{t("app-name")}</span>
            </Link>
          ) : (
            <h1 className="font-serif text-xl text-primary">{t("app-name")}</h1>
          )}
        </div>
        <LanguageSwitcher />
      </div>
    </header>
  );
}
