/** Aparece na hora ao trocar de tela, enquanto o servidor monta a página. */
export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Carregando">
      <div className="space-y-2">
        <div className="h-7 w-64 rounded-lg bg-[#18214a]" />
        <div className="h-4 w-96 max-w-full rounded bg-[#131b36]" />
      </div>
      <div className="h-16 rounded-2xl border border-line bg-[#131b36]" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-96 rounded-2xl border border-line bg-[#131b36]" />
        <div className="h-96 rounded-2xl border border-line bg-[#131b36]" />
      </div>
      <div className="h-72 rounded-2xl border border-line bg-[#131b36]" />
    </div>
  );
}
