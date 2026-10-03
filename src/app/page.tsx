import { CANDIDATES } from "@/lib/candidates";
import { getEstimates } from "@/lib/estimates";
import { dec, dmy, int, pct } from "@/lib/format";
import { HALF_LIFE_DAYS, validShares, WINDOW_DAYS } from "@/lib/model";
import { Gap, SharesCard } from "@/components/SharesCard";
import { Trend } from "@/components/Trend";
import { PageHeader } from "@/components/PageHeader";
import { PollsStrip } from "@/components/PollsStrip";
import { Pesquisas2 } from "@/components/Pesquisas2";
import { Method } from "@/components/Method";
import { CandidateAvatar } from "@/components/CandidateAvatar";

// renderiza a cada acesso; a leitura da Wikipédia tem cache próprio de 5 min em memória (src/lib/polls.ts)
export const dynamic = "force-dynamic";

export default async function PesquisasPage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  if ((Array.isArray(sp.turno) ? sp.turno[0] : sp.turno) === "2") return <Pesquisas2 />;
  const e = await getEstimates();
  const dots = e.polls.flatMap((p) => {
    const v = validShares(p);
    return v ? [{ end: p.end, v }] : [];
  });
  const from = new Date(Date.parse(`${e.asOf}T12:00:00Z`) - WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  const reliableNames = e.reliable.map((r) => r.institute);
  const inWindow = e.general.rows;
  const certeirosIds = new Set(reliableNames);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pesquisas · 1º turno"
        subtitle={`Votos válidos (sem brancos, nulos e indecisos) · pesquisas nacionais dos últimos ${WINDOW_DAYS} dias · votação em 04/10`}
        turno={1}
        basePath="/"
        source={e.source}
      />

      <PollsStrip />

      <div className="grid gap-4 md:grid-cols-2">
        <SharesCard
          badge="A"
          title="Média de todas as pesquisas"
          subtitle={`${e.general.nPolls} pesquisas · ${e.general.nInstitutes} institutos`}
          shares={e.general.shares}
          footer={
            <div className="space-y-1">
              <div><Gap shares={e.general.shares} /> · margem de erro média declarada ±{dec(e.general.avgMoe)} p.p.</div>
              <div>Pesquisa mais recente: {dmy(e.general.latest)}. Pesos: recência (cai à metade a cada {HALF_LIFE_DAYS} dias) e margem de erro.</div>
            </div>
          }
        />
        <SharesCard
          badge="B"
          title="Média dos institutos mais certeiros"
          subtitle={`${e.certeiros.nPolls} pesquisas · ${reliableNames.join(", ")}`}
          shares={e.certeiros.shares}
          footer={
            <div className="space-y-1">
              <div><Gap shares={e.certeiros.shares} /> · margem de erro média declarada ±{dec(e.certeiros.avgMoe)} p.p.</div>
              <div>Só os {reliableNames.length} institutos ativos que mais chegaram perto do resultado real em 2018 e 2022, com mais peso para quem errou menos.</div>
            </div>
          }
        />
      </div>

      <section className="card p-5">
        <h2 className="text-base font-semibold">Evolução da média</h2>
        <p className="mb-3 mt-1 text-sm text-muted">Lula e Flávio em votos válidos, nos últimos {WINDOW_DAYS} dias.</p>
        <Trend general={e.trendGeneral} certeiros={e.trendCerteiros} dots={dots} from={from} to={e.asOf} />
      </section>

      <section className="card p-5">
        <h2 className="text-base font-semibold">Quem acertou mais em 2018 e 2022</h2>
        <p className="mb-3 mt-1 text-sm text-muted">
          Erro médio da última pesquisa de cada instituto antes do 1º turno, em votos válidos (pontos percentuais; menor é melhor). Os dois mais votados
          pesam o dobro. A nota mistura as duas eleições (2022 vale mais) e puxa para a média quem tem pouco histórico.
        </p>
        <div className="scroll-x">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-faint">
                <th className="py-2 pr-3 font-medium">#</th>
                <th className="py-2 pr-3 font-medium">Instituto</th>
                <th className="py-2 pr-3 text-right font-medium">Erro 2022</th>
                <th className="py-2 pr-3 text-right font-medium">Erro 2018</th>
                <th className="py-2 pr-3 text-right font-medium">Nota</th>
                <th className="py-2 text-left font-medium">Em 2026</th>
              </tr>
            </thead>
            <tbody>
              {e.track.institutes.map((r, i) => {
                const y22 = r.years.find((y) => y.year === 2022);
                const y18 = r.years.find((y) => y.year === 2018);
                const active = e.general.rows.some((x) => x.poll.institute === r.institute);
                return (
                  <tr key={r.institute} className="border-b border-line/50">
                    <td className="py-2 pr-3 text-faint">{i + 1}</td>
                    <td className="py-2 pr-3 font-medium">{r.institute}</td>
                    <td className="num py-2 pr-3 text-right">{y22 ? dec(y22.err) : "—"}</td>
                    <td className="num py-2 pr-3 text-right">{y18 ? dec(y18.err) : "—"}</td>
                    <td className="num py-2 pr-3 text-right font-semibold">{dec(r.score)}</td>
                    <td className="py-2 text-xs">
                      {certeirosIds.has(r.institute) ? (
                        <span className="rounded bg-[#1d3b2f] px-1.5 py-0.5 text-[#6ee7b7]">na média B</span>
                      ) : active ? (
                        <span className="text-muted">ativo, fora do top {reliableNames.length}</span>
                      ) : (
                        <span className="text-faint">sem pesquisa recente</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-faint">
          Institutos novos em 2026 (Palver, Indexa, Gerp, DataTrends, Vox Brasil, Alfa e outros) não têm histórico em 2018/2022 e só entram na média A.
          O Ibope de 2018 foi contado como Ipec (a equipe migrou).
        </p>
      </section>

      <section className="card p-5">
        <h2 className="text-base font-semibold">Todas as pesquisas usadas</h2>
        <p className="mb-3 mt-1 text-sm text-muted">
          {inWindow.length} pesquisas nos últimos {WINDOW_DAYS} dias, em votos válidos, da mais recente para a mais antiga. “Peso” é a fatia de cada uma na média A.
        </p>
        <div className="scroll-x">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-faint">
                <th className="py-2 pr-3 font-medium">Instituto</th>
                <th className="py-2 pr-3 font-medium">Campo até</th>
                <th className="py-2 pr-3 text-right font-medium">Amostra</th>
                <th className="py-2 pr-3 text-right font-medium">Margem</th>
                {CANDIDATES.map((c) => (
                  <th key={c.key} className="py-2 pr-3 text-right font-medium" style={{ color: c.color }}>
                    <span className="inline-flex flex-col items-end gap-1"><CandidateAvatar k={c.key} size={22} />{c.short}</span>
                  </th>
                ))}
                <th className="py-2 text-right font-medium">Peso</th>
              </tr>
            </thead>
            <tbody>
              {inWindow.map((r, i) => (
                <tr key={i} className="border-b border-line/50">
                  <td className="py-1.5 pr-3 font-medium">
                    {r.poll.institute}
                    {certeirosIds.has(r.poll.institute) && <span className="ml-1.5 text-[10px] text-[#6ee7b7]" title="faz parte da média B">●</span>}
                    {r.poll.origin === "manual" && <span className="ml-1.5 text-[10px] text-accent" title="lançada à mão">manual</span>}
                  </td>
                  <td className="py-1.5 pr-3 text-muted">{dmy(r.poll.end)}</td>
                  <td className="num py-1.5 pr-3 text-right text-muted">{r.poll.n ? int(r.poll.n) : "—"}</td>
                  <td className="num py-1.5 pr-3 text-right text-muted">{r.poll.moe ? `±${dec(r.poll.moe)}` : "—"}</td>
                  {CANDIDATES.map((c) => (
                    <td key={c.key} className="num py-1.5 pr-3 text-right">{dec(r.valid[c.key])}</td>
                  ))}
                  <td className="num py-1.5 text-right text-muted">{pct(r.share * 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Method />
    </div>
  );
}
