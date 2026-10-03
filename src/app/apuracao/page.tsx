import { getEstimates } from "@/lib/estimates";
import type { LiveSource } from "@/lib/compare";
import { ApuracaoLive } from "@/components/ApuracaoLive";
import { SourceStatus } from "@/components/SourceStatus";

export const dynamic = "force-dynamic";

export default async function ApuracaoPage({ searchParams }: PageProps<"/apuracao">) {
  const sp = await searchParams;
  const q = Array.isArray(sp.env) ? sp.env[0] : sp.env;
  const env = q === "demo" || q === "simulado" ? q : "oficial";
  const e = await getEstimates();

  const sources: LiveSource[] = [
    { id: "polls-a" as const, label: "Pesquisas · todas", short: "Pesquisas A", shares: e.general.shares },
    { id: "polls-b" as const, label: "Pesquisas · certeiras", short: "Pesquisas B", shares: e.certeiros.shares },
    { id: "fc-a" as const, label: "Previsão · todas", short: "Previsão A", shares: e.fcGeneral.mean, band: { lo: e.fcGeneral.lo, hi: e.fcGeneral.hi } },
    { id: "fc-b" as const, label: "Previsão · certeiras", short: "Previsão B", shares: e.fcCerteiros.mean, band: { lo: e.fcCerteiros.lo, hi: e.fcCerteiros.hi } },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight">
            <span className="live-dot inline-block h-3 w-3 rounded-full bg-[#f87171]" aria-hidden />
            Apuração ao vivo
          </h1>
          <p className="mt-1 text-sm text-muted">Domingo, 04/10, a partir das 17h (Brasília) · dados oficiais do TSE · atualiza sozinho</p>
        </div>
        <SourceStatus source={e.source} />
      </div>
      <ApuracaoLive env={env} sources={sources} />
    </div>
  );
}
