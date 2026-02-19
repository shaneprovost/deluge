"use client";

import { useTranslation } from "react-i18next";

export default function MapPage() {
  const { t } = useTranslation("map");

  return (
    <main className="min-h-screen p-8">
      <h1 className="font-serif text-2xl text-primary mb-4">{t("title")}</h1>
      <p className="text-charcoal/80">{t("placeholder")}</p>
    </main>
  );
}
