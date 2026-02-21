"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

export default function HomePage() {
  const { t: commonT } = useTranslation("common");
  const { t: homeT } = useTranslation("home");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="font-serif text-4xl text-primary mb-2">
        {commonT("app-name")}
      </h1>
      <p className="text-charcoal/80 mb-8 text-center max-w-md">
        {homeT("tagline")}
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href="/pray"
          className="rounded-lg bg-primary px-6 py-3 text-cream font-medium shadow-md hover:opacity-90 transition text-center"
        >
          {homeT("pray-for-someone")}
        </Link>
        <Link
          href="/pray/rosary"
          className="rounded-lg border-2 border-primary px-6 py-3 text-primary font-medium hover:bg-primary/5 transition text-center"
        >
          {homeT("guided-rosary")}
        </Link>
        <Link
          href="/map"
          className="rounded-lg border-2 border-primary px-6 py-3 text-primary font-medium hover:bg-primary/5 transition text-center"
        >
          {homeT("view-map")}
        </Link>
      </div>
    </main>
  );
}
