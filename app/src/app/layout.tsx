import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin", "cyrillic"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Liquidity Vault — Solana DeFi & Raydium CLMM Strategy",
  description:
    "Сквозной проект Liquidity Vault (Недели 8–14): депозит токенов, учёт долей через share-токены и концентрированная ликвидность в Raydium CLMM.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className={`${inter.variable} ${mono.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

