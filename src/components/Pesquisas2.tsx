import { getEstimates2 } from "@/lib/estimates";
import { dec, dmy, int, pct } from "@/lib/format";
import { HALF_LIFE_DAYS, validShares, WINDOW_DAYS } from "@/lib/model";
import { BY_KEY } from "@/lib/candidates";
import { CandidateAvatar } from "./CandidateAvatar";
import { Gap, SharesCard } from "./SharesCard";
import { Trend } from "./Trend";
import { Method } from "./Method";
import { PageHeader } from "./PageHeader";
import { PollsStrip } from "./PollsStrip";

const KEYS = ["lula", "flavio"] as const;

/** Pesquisas de 2º turno (Lula x Flávio): mesma estrutura da tela do 1º turno. */
export async function Pesquisas2() {
  const e = await getEstimates2();
  const from = new Date(Date.parse(`${e.asOf}T12:00:00Z`) - WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  const names = e.reliable.map((r) => r.institute);
  const inB = new Set(names);
  const dots = e.polls.flatMap((p) => {
    const v = validShares(p);
    return v ? [{ end: p.end, v }] : [];
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pesquisas · 2º turno"
        subtitle={`Lula × Flávio Bolsonaro · votos válidos · pesquisas de 2º turno dos últimos ${WINDOW_DAYS} dias · eventual 2º turno em 25/10`}
        turno={2}
        basePath="/"
        source={e.source}
      />

      <PollsStrip />

      <div className="card p-3 text-sm text-muted">
        São pesquisas do tipo “se o 2º turno fosse hoje”, feitas antes de saber quem passa. Depois do 1º turno de domingo, as novas pesquisas passam a
        pesar mais automaticamente.
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SharesCard
          badge="A"
          title="Média de todas as pesquisas"
          subtitle={`${e.general.nPolls} pesquisas · ${e.general.nInstitutes} institutos`}
          shares={e.general.shares}
          keys={[...KEYS]}
          footer={
            <div className="space-y-1">
              <div><Gap shares={e.general.shares} /> · margem de erro média declarada ±{dec(e.general.avgMoe)} p.p.</div>
              <div>Pesquisa mais recente: {dmy(e.general.latest)}. Pesos: recência (cai à metade a cada {HALF_LIFE_DAYS} dias) e margem de erro.</div>
            </div>
          }
        />
        {e.certeiros ? (
          <SharesCard
            badge="B"
            title="Média dos institutos mais certeiros"
            subtitle={`${e.certeiros.nPolls} pesquisas · ${names.join(", ")}`}
            shares={e.certeiros.shares}
            keys={[...KEYS]}
            footer={
              <div className="space-y-1">
                <div><Gap shares={e.certeiros.shares} /> · margem de erro média declarada ±{dec(e.certeiros.avgMoe)} p.p.</div>
                <div>Só os {names.length} institutos ativos que mais chegaram perto do resultado do 2º turno de 2018 e 2022.</div>
              </div>
            }
          />
        ) : (
          <div className="card p-5 text-sm text-muted">Nenhum instituto com histórico de 2º turno publicou pesquisa nos últimos {WINDOW_DAYS} dias.</div>
        )}
      </div>

      <section className="card p-5">
        <h2 className="text-base font-semibold">Evolução da média</h2>
        <p className="mb-3 mt-1 text-sm text-muted">Lula e Flávio no 2º turno, em votos válidos, nos últimos {WINDOW_DAYS} dias.</p>
        <Trend general={e.trendGeneral} certeiros={e.trendCerteiros} dots={dots} from={from} to={e.asOf} />
      </section>

      <section className="card p-5">
        <h2 className="text-base font-semibold">Quem acertou mais no 2º turno de 2018 e 2022</h2>
        <p className="mb-3 mt-1 text-sm text-muted">
          Erro da última pesquisa de cada instituto antes do 2º turno, em votos válidos (pontos percentuais; menor é melhor). A nota mistura as duas
          eleições (2022 vale mais) e puxa para a média quem tem pouco histórico. São só duas disputas, então a nota é menos estável que a do 1º turno.
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
                      {inB.has(r.institute) ? (
                        <span className="rounded bg-[#1d3b2f] px-1.5 py-0.5 text-[#6ee7b7]">na média B</span>
                      ) : active ? (
                        <span className="text-muted">ativo, fora do top {names.length}</span>
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
      </section>

      <section className="card p-5">
        <h2 className="text-base font-semibold">Todas as pesquisas usadas</h2>
        <p className="mb-3 mt-1 text-sm text-muted">
          {e.general.rows.length} pesquisas de 2º turno nos últimos {WINDOW_DAYS} dias, em votos válidos, da mais recente para a mais antiga. “Peso” é a fatia de cada uma na média A.
        </p>
        <div className="scroll-x">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-faint">
                <th className="py-2 pr-3 font-medium">Instituto</th>
                <th className="py-2 pr-3 font-medium">Campo até</th>
                <th className="py-2 pr-3 text-right font-medium">Amostra</th>
                <th className="py-2 pr-3 text-right font-medium">Margem</th>
                {KEYS.map((k) => (
                  <th key={k} className="py-2 pr-3 text-right font-medium" style={{ color: BY_KEY[k].color }}>
                    <span className="inline-flex flex-col items-end gap-1"><CandidateAvatar k={k} size={22} />{BY_KEY[k].short}</span>
                  </th>
                ))}
                <th className="py-2 text-right font-medium">Peso</th>
              </tr>
            </thead>
            <tbody>
              {e.general.rows.map((r, i) => (
                <tr key={i} className="border-b border-line/50">
                  <td className="py-1.5 pr-3 font-medium">
                    {r.poll.institute}
                    {inB.has(r.poll.institute) && <span className="ml-1.5 text-[10px] text-[#6ee7b7]" title="faz parte da média B">●</span>}
                    {r.poll.origin === "manual" && <span className="ml-1.5 text-[10px] text-accent" title="lançada à mão">manual</span>}
                  </td>
                  <td className="py-1.5 pr-3 text-muted">{dmy(r.poll.end)}</td>
                  <td className="num py-1.5 pr-3 text-right text-muted">{r.poll.n ? int(r.poll.n) : "—"}</td>
                  <td className="num py-1.5 pr-3 text-right text-muted">{r.poll.moe ? `±${dec(r.poll.moe)}` : "—"}</td>
                  {KEYS.map((k) => (
                    <td key={k} className="num py-1.5 pr-3 text-right">{dec(r.valid[k])}</td>
                  ))}
                  <td className="num py-1.5 text-right text-muted">{pct(r.share * 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Method turno={2} />
    </div>
  );
}
