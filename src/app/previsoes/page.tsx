import Link from "next/link";
import { CORRECTIONS, DEFAULT_CORRECTION, getEstimates } from "@/lib/estimates";
import { dec } from "@/lib/format";
import { ForecastCard } from "@/components/ForecastCard";
import { Method } from "@/components/Method";
import { PageHeader } from "@/components/PageHeader";
import { PollsStrip } from "@/components/PollsStrip";
import { Previsoes2 } from "@/components/Previsoes2";

export const dynamic = "force-dynamic";

export default async function PrevisoesPage({ searchParams }: PageProps<"/previsoes">) {
  const sp = await searchParams;
  const raw = Number(Array.isArray(sp.corr) ? sp.corr[0] : sp.corr);
  const corrPct = (CORRECTIONS as readonly number[]).includes(raw) ? raw : DEFAULT_CORRECTION;
  if ((Array.isArray(sp.turno) ? sp.turno[0] : sp.turno) === "2") return <Previsoes2 corrPct={corrPct} />;
  const e = await getEstimates(corrPct);
  const reliableNames = e.reliable.map((r) => r.institute).join(", ");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Previsões · 1º turno"
        subtitle={`Votação em 04/10 · votos válidos · ${e.general.nPolls} pesquisas dos últimos 90 dias`}
        turno={1}
        basePath="/previsoes"
        keep={corrPct === DEFAULT_CORRECTION ? undefined : { corr: String(corrPct) }}
        source={e.source}
      />

      <PollsStrip />

      <div className="card flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
        <div className="max-w-xl text-muted">
          <strong className="text-fg">Correção do viés histórico.</strong> Em 2018 e 2022 as pesquisas ficaram, em média, {dec(e.track.bias.pt)} p.p. abaixo do
          resultado final de Lula/Haddad e {dec(e.track.bias.bolso)} p.p. abaixo de Bolsonaro. Você pode somar uma parte disso à previsão.
        </div>
        <div className="flex gap-1 rounded-full border border-line bg-[#0f1630] p-1" role="group" aria-label="Correção do viés histórico">
          {CORRECTIONS.map((c) => (
            <Link
              key={c}
              href={c === DEFAULT_CORRECTION ? "/previsoes" : `/previsoes?corr=${c}`}
              scroll={false}
              aria-current={c === corrPct ? "true" : undefined}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium ${c === corrPct ? "bg-accent text-[#0b1020]" : "text-muted hover:text-fg"}`}
            >
              {c === 0 ? "Nenhuma" : `${c}%`}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ForecastCard
          badge="A"
          title="Previsão com todas as pesquisas"
          subtitle={`Média de ${e.general.nPolls} pesquisas de ${e.general.nInstitutes} institutos`}
          fc={e.fcGeneral}
          base={e.general.shares}
          corrPct={corrPct}
        />
        <ForecastCard
          badge="B"
          title="Previsão com os institutos mais certeiros"
          subtitle={`${e.certeiros.nPolls} pesquisas de ${reliableNames}`}
          fc={e.fcCerteiros}
          base={e.certeiros.shares}
          corrPct={corrPct}
        />
      </div>

      <Method />
    </div>
  );
}
