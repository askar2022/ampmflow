import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AMPM Flow · Student Transportation & Dismissal",
  description: "Safe arrivals. Organized dismissals.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} h-full antialiased`}>
      <body className={`${sans.className} min-h-full`}>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
