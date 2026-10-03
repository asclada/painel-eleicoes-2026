import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Nav } from "@/components/Nav";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Eleição 2026 · Simulação",
  description: "Pesquisas, previsões e apuração ao vivo da eleição presidencial de 2026 (uso pessoal).",
};

export const viewport: Viewport = { themeColor: "#0b1020" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-20 border-b border-line bg-[#0b1020]/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="text-lg font-semibold tracking-tight">Eleição 2026</span>
              <span className="text-xs text-muted">simulação · uso pessoal</span>
            </Link>
            <Nav />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
        <footer className="mx-auto w-full max-w-6xl px-4 pb-10 pt-4 text-xs leading-relaxed text-faint">
          Pesquisas retratam o momento em que foram feitas e não são previsão de resultado. Fontes: pesquisas registradas
          no TSE (via Wikipédia), resultados históricos do TSE (2018 e 2022) e apuração do TSE
          (resultados.tse.jus.br). Projeto pessoal, sem vínculo com nenhum instituto ou campanha.
        </footer>
      </body>
    </html>
  );
}
