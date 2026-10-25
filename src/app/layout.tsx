import type { Metadata, Viewport } from "next";
import { Cinzel, Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const display = Cinzel({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-display" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: { default: "AU Scrims", template: "%s · AU Scrims" },
  description: "Agenda, re-agenda y ranking de scrims para equipos de League of Legends.",
};

export const viewport: Viewport = { themeColor: "#010A13" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${sans.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{
            classNames: {
              toast: "!bg-void-900 !border !border-gold-500/50 !text-gold-50 !font-sans",
              description: "!text-stone-300",
              success: "!border-hex-200/50",
              error: "!border-blood/60",
            },
          }}
        />
      </body>
    </html>
  );
}
