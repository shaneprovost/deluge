import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/components/I18nProvider";
import { Header } from "@/components/Header";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Deluge – Pray for the Faithful Departed",
  description:
    "Offer prayers for deceased clergy and religious of the Atlanta Archdiocese.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <I18nProvider>
          <Header />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
