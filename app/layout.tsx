import type { Metadata } from "next";
import { Anton, Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import site from "@/content/site.json";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Display face for big headings — bold, condensed, confident.
const anton = Anton({
  variable: "--font-anton",
  weight: "400",
  subsets: ["latin"],
});

// Elegant serif accent — reserved for scripture.
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://tfmchelsea.org";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${site.name} | ${site.church.city}`,
    template: `%s | ${site.shortName}`,
  },
  description:
    "Throughly Furnished Ministries — a ministry of Faith Baptist Church in Chelsea, Michigan — prepares believers for missionary work and Christian service through Biblical studies, practical skills, and ministry participation.",
  openGraph: {
    siteName: site.name,
    type: "website",
    locale: "en_US",
    images: ["/images/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${anton.variable} ${playfair.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
