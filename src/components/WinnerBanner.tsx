import Link from "next/link";
import { CandidateAvatar } from "./CandidateAvatar";

/** Faixa do resultado do 2º turno (25/10/2026). Os números ficam na apuração, que lê o TSE. */
export function WinnerBanner() {
  return (
    <section
      className="border-b border-[#ef4d52]/40 bg-gradient-to-br from-[#7f1d1d] via-[#b91c1c] to-[#ef4d52] text-white"
      aria-label="Resultado da eleição"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 text-center sm:flex-row sm:gap-8 sm:py-10 sm:text-left">
        <span className="rounded-full ring-4 ring-white/80">
          <CandidateAvatar k="lula" size={112} />
        </span>
        <div className="flex-1">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">2º turno · 25 de outubro de 2026</div>
          <h2 className="mt-2 text-4xl font-black leading-none tracking-tight sm:text-6xl">Lula reeleito</h2>
          <p className="mt-2 text-lg font-medium text-white/90 sm:text-2xl">Presidente do Brasil</p>
          <Link
            href="/apuracao"
            className="mt-4 inline-block rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium hover:bg-white/25"
          >
            Ver o resultado da apuração →
          </Link>
        </div>
      </div>
    </section>
  );
}
