import type { Metadata } from "next";
import { JetBrains_Mono, Onest } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

// Both families include cyrillic-ext, so Kazakh names (Ә, Қ, Ң, Ө, Ұ, Ү, І…) render in-font.
const sans = Onest({ subsets: ["latin", "cyrillic", "cyrillic-ext"], variable: "--font-onest" });
const mono = JetBrains_Mono({ subsets: ["latin", "cyrillic"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  title: { default: "SDU Registration Assistant", template: "%s · SDU Registration" },
  description: "Plan, validate and register your Suleyman Demirel University courses.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
