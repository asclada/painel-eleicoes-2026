/** Só aparece quando a Wikipédia falhou e o site está usando a cópia salva (pode estar desatualizada). */
export function SourceStatus({ source }: { source: "wikipedia" | "snapshot" }) {
  if (source === "wikipedia") return null;
  return (
    <div className="flex items-center gap-2 rounded-full border border-[#fbbf24]/40 bg-[#2a2310] px-3 py-1.5 text-xs text-[#fbbf24]" role="status">
      <span className="inline-block h-2 w-2 rounded-full bg-[#fbbf24]" aria-hidden />
      Não consegui ler as pesquisas agora: usando a cópia salva, que pode estar desatualizada
    </div>
  );
}
