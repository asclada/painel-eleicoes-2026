import Link from "next/link";

/** Botão 1º turno / 2º turno. É um link comum (a troca é feita no servidor, com ?turno=2). */
export function TurnoToggle({ basePath, turno, keep }: { basePath: string; turno: 1 | 2; keep?: Record<string, string | undefined> }) {
  const href = (t: 1 | 2) => {
    const q = new URLSearchParams();
    if (t === 2) q.set("turno", "2");
    for (const [k, v] of Object.entries(keep ?? {})) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  return (
    <div className="flex gap-1 rounded-full border border-line bg-[#0f1630] p-1" role="group" aria-label="Turno">
      {([1, 2] as const).map((t) => (
        <Link
          key={t}
          href={href(t)}
          scroll={false}
          aria-current={t === turno ? "true" : undefined}
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${t === turno ? "bg-accent text-[#0b1020]" : "text-muted hover:text-fg"}`}
        >
          {t}º turno
        </Link>
      ))}
    </div>
  );
}
