import type { Metadata, Viewport } from "next";
import { Golos_Text, Unbounded } from "next/font/google";
import "./globals.css";

const golos = Golos_Text({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-golos",
});

const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600"],
  variable: "--font-unbounded",
});

export const metadata: Metadata = {
  title: "Dear Money",
  description: "Накопления по методу конвертов",
  appleWebApp: {
    capable: true,
    title: "Dear Money",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#edf1ee",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={`${golos.variable} ${unbounded.variable}`}>
      <body>{children}</body>
    </html>
  );
}
