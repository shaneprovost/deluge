import type { Metadata } from "next";
import { Poppins, Lora } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/components/I18nProvider";
import { Header } from "@/components/Header";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-lora",
});

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
      <body className={`${poppins.variable} ${lora.variable} font-sans`}>
        <I18nProvider>
          <Header />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
