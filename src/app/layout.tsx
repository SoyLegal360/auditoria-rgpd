import type { Metadata } from "next";
import { Roboto, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Roboto solo para el wordmark "SoyLegal360" (resto: Georgia/Arial del sistema).
const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

// Monoespaciada para datos técnicos (dominio, puntuación) — aire legal-tech.
const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const SITE_URL = "https://auditoria-rgpd.vercel.app";
const OG_IMAGE = "/soylegal360_logo_color_horizontal.png";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Auditoría RGPD gratuita | SoyLegal360",
  description:
    "Analiza gratis si tu web cumple el RGPD: cookies, textos legales, seguridad y protección del correo. Informe inmediato con lo que debes corregir.",
  icons: {
    icon: "/favicon-32x32.png",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: "SoyLegal360",
    title: "Auditoría RGPD gratuita | SoyLegal360",
    description:
      "Analiza gratis si tu web cumple el RGPD en segundos. Cookies, textos legales, seguridad y correo.",
    url: SITE_URL,
    images: [{ url: OG_IMAGE, width: 2049, height: 1152 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Auditoría RGPD gratuita | SoyLegal360",
    description: "Analiza gratis si tu web cumple el RGPD en segundos.",
    images: [OG_IMAGE],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${roboto.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
