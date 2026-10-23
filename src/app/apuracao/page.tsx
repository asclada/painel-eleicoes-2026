import { getEstimates, getEstimates2 } from "@/lib/estimates";
import type { LiveSource } from "@/lib/compare";
import { ApuracaoLive } from "@/components/ApuracaoLive";
import { ApuracaoLive2, type Ref2 } from "@/components/ApuracaoLive2";
import { TurnoToggle } from "@/components/TurnoToggle";

export const dynamic = "force-dynamic";

export default async function ApuracaoPage({ searchParams }: PageProps<"/apuracao">) {
  const sp = await searchParams;
  const q = Array.isArray(sp.env) ? sp.env[0] : sp.env;
  const turno = (Array.isArray(sp.turno) ? sp.turno[0] : sp.turno) === "1" ? 1 : 2;
  const env = q === "demo" || (q === "simulado" && turno === 1) ? q : "oficial";

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight">
          {turno === 2 && <span className="live-dot inline-block h-3 w-3 rounded-full bg-[#f87171]" aria-hidden />}
          {turno === 2 ? "Apuração ao vivo" : "Resultado do 1º turno"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {turno === 2
            ? "Domingo, 25/10, a partir das 17h (Brasília) · dados oficiais do TSE · atualiza sozinho"
            : "Domingo, 04/10 · resultado oficial do TSE, com o que pesquisas e previsões apontavam"}
        </p>
      </div>
      <TurnoToggle basePath="/apuracao" turno={turno} keep={{ env: env === "oficial" ? undefined : env }} />
    </div>
  );

  if (turno === 2) {
    const e = await getEstimates2();
    const refs: Ref2[] = [
      { id: "polls-a", label: "Pesquisas · todas", lula: e.general.shares.lula },
      ...(e.certeiros ? [{ id: "polls-b", label: "Pesquisas · certeiras", lula: e.certeiros.shares.lula }] : []),
      { id: "fc-a", label: "Previsão · todas", lula: e.fcGeneral.lula },
      ...(e.fcCerteiros ? [{ id: "fc-b", label: "Previsão · certeiras", lula: e.fcCerteiros.lula }] : []),
    ];
    return (
      <div className="space-y-5">
        {header}
        <ApuracaoLive2 env={env === "demo" ? "demo" : "oficial"} refs={refs} />
      </div>
    );
  }

  const e = await getEstimates();
  const sources: LiveSource[] = [
    { id: "polls-a" as const, label: "Pesquisas · todas", short: "Pesquisas A", shares: e.general.shares },
    { id: "polls-b" as const, label: "Pesquisas · certeiras", short: "Pesquisas B", shares: e.certeiros.shares },
    { id: "fc-a" as const, label: "Previsão · todas", short: "Previsão A", shares: e.fcGeneral.mean, band: { lo: e.fcGeneral.lo, hi: e.fcGeneral.hi } },
    { id: "fc-b" as const, label: "Previsão · certeiras", short: "Previsão B", shares: e.fcCerteiros.mean, band: { lo: e.fcCerteiros.lo, hi: e.fcCerteiros.hi } },
  ];
  return (
    <div className="space-y-6">
      {header}
      <ApuracaoLive env={env} sources={sources} />
    </div>
  );
}
