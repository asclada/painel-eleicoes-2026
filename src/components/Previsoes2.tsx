import { CORRECTIONS, DEFAULT_CORRECTION, getEstimates2 } from "@/lib/estimates";
import { BY_KEY } from "@/lib/candidates";
import { chance, dec, pct, signed } from "@/lib/format";
import type { Forecast2 } from "@/lib/model";
import Link from "next/link";
import { CandidateAvatar } from "./CandidateAvatar";
import { Method } from "./Method";
import { PageHeader } from "./PageHeader";
import { PollsStrip } from "./PollsStrip";

const SCALE_MIN = 40;
const SCALE_MAX = 60;

function Side({ k, value, lo, hi }: { k: "lula" | "flavio"; value: number; lo: number; hi: number }) {
  const c = BY_KEY[k];
  const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100))}%`;
  return (
    <div>
      <div className="flex items-center gap-3">
        <CandidateAvatar k={k} size={40} />
        <div>
          <div className="text-sm font-medium">{c.short}</div>
          <div className="num text-3xl font-semibold leading-none" style={{ color: c.color }}>{pct(value)}</div>
        </div>
      </div>
      <div className="relative mt-3 h-2 rounded-full bg-[#1c2650]" role="presentation">
        <div className="absolute top-0 h-full rounded-full opacity-40" style={{ left: pos(lo), width: `calc(${pos(hi)} - ${pos(lo)})`, background: c.color }} />
        <div className="absolute top-[-2px] h-3 w-[3px] rounded-sm" style={{ left: `calc(${pos(value)} - 1px)`, background: c.color }} />
        <div className="absolute top-[-4px] h-4 w-px bg-white/30" style={{ left: pos(50) }} title="50%" />
      </div>
      <div className="mt-1 text-[11px] text-faint">entre {dec(lo)}% e {dec(hi)}%</div>
    </div>
  );
}

function Card({ badge, title, subtitle, fc, corrPct }: { badge: string; title: string; subtitle: string; fc: Forecast2; corrPct: number }) {
  const fav = fc.pLula >= 50 ? "lula" : "flavio";
  return (
    <section className="card flex flex-col p-5">
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-[#243059] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-accent">{badge}</span>
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>

      <div className="mt-5">
        <div className="flex items-baseline justify-between text-xs text-muted">
          <span>Chance de vencer o 2º turno</span>
          <span>{BY_KEY[fav].short} favorito</span>
        </div>
        <div className="mt-1.5 flex h-7 overflow-hidden rounded-lg text-xs font-semibold text-[#0b1020]" role="img" aria-label={`Lula ${dec(fc.pLula, 0)}%, Flávio ${dec(fc.pFlavio, 0)}%`}>
          <div className="flex items-center pl-2" style={{ width: `${fc.pLula}%`, background: BY_KEY.lula.color }}>Lula {chance(fc.pLula)}</div>
          <div className="flex items-center justify-end pr-2" style={{ width: `${fc.pFlavio}%`, background: BY_KEY.flavio.color }}>{chance(fc.pFlavio)} Flávio</div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-line bg-[#0f1630] p-3 text-sm">
        <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-faint">De onde vem</div>
        <table className="w-full">
          <thead>
            <tr className="text-xs text-faint">
              <th className="py-1 text-left font-medium" />
              <th className="py-1 text-right font-medium">Média das pesquisas</th>
              <th className="py-1 text-right font-medium">Ajuste ({corrPct}% do viés)</th>
              <th className="py-1 text-right font-medium">Previsão</th>
            </tr>
          </thead>
          <tbody>
            {(["lula", "flavio"] as const).map((k) => {
              const base = k === "lula" ? fc.base : 100 - fc.base;
              const now = k === "lula" ? fc.lula : fc.flavio;
              return (
                <tr key={k}>
                  <td className="py-1" style={{ color: BY_KEY[k].color }}>{BY_KEY[k].short}</td>
                  <td className="num py-1 text-right">{pct(base)}</td>
                  <td className="num py-1 text-right text-muted">{signed(now - base)}</td>
                  <td className="num py-1 text-right font-semibold">{pct(now)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3 className="mb-3 mt-6 text-xs font-medium uppercase tracking-wide text-faint">Votos válidos projetados · faixa de 90%</h3>
      <div className="grid gap-5 sm:grid-cols-2">
        <Side k="lula" value={fc.lula} lo={fc.lo} hi={fc.hi} />
        <Side k="flavio" value={fc.flavio} lo={100 - fc.hi} hi={100 - fc.lo} />
      </div>
      <p className="mt-5 border-t border-line pt-3 text-xs text-muted">
        {corrPct === 0 ? "Sem correção do viés histórico." : `Com ${corrPct}% do viés histórico das pesquisas somado.`} Margem total de ±{dec(fc.sd * 1.645)} p.p. (90%). A linha clara marca os 50%.
      </p>
    </section>
  );
}

export async function Previsoes2({ corrPct }: { corrPct: number }) {
  const e = await getEstimates2(corrPct);
  const names = e.reliable.map((r) => r.institute).join(", ");
  const keep = corrPct === DEFAULT_CORRECTION ? undefined : { corr: String(corrPct) };
  return (
    <div className="space-y-6">
      <PageHeader
        title="Previsões · 2º turno"
        subtitle={`Lula × Flávio Bolsonaro · eventual 2º turno em 25/10 · votos válidos · ${e.general.nPolls} pesquisas dos últimos 90 dias`}
        turno={2}
        basePath="/previsoes"
        keep={keep}
        source={e.source}
      />

      <PollsStrip />

      <div className="card flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
        <div className="max-w-xl text-muted">
          <strong className="text-fg">Correção do viés histórico.</strong> No 2º turno de 2018 e 2022 o candidato do PT teve, em média, {signed(e.track.bias.pt)} p.p.
          em relação à última pesquisa (2022: {signed(e.track.byYear.find((y) => y.year === 2022)?.ptBias ?? 0)}; 2018:{" "}
          {signed(e.track.byYear.find((y) => y.year === 2018)?.ptBias ?? 0)}). Os dois sinais são diferentes, então o ajuste é pequeno e incerto.
        </div>
        <div className="flex gap-1 rounded-full border border-line bg-[#0f1630] p-1" role="group" aria-label="Correção do viés histórico">
          {CORRECTIONS.map((c) => (
            <Link
              key={c}
              href={`/previsoes?turno=2${c === DEFAULT_CORRECTION ? "" : `&corr=${c}`}`}
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
        <Card badge="A" title="Previsão com todas as pesquisas" subtitle={`Média de ${e.general.nPolls} pesquisas de ${e.general.nInstitutes} institutos`} fc={e.fcGeneral} corrPct={corrPct} />
        {e.fcCerteiros && e.certeiros ? (
          <Card badge="B" title="Previsão com os institutos mais certeiros" subtitle={`${e.certeiros.nPolls} pesquisas de ${names}`} fc={e.fcCerteiros} corrPct={corrPct} />
        ) : (
          <div className="card p-5 text-sm text-muted">Nenhum instituto com histórico de 2º turno publicou pesquisa nos últimos 90 dias.</div>
        )}
      </div>

      <Method turno={2} />
    </div>
  );
}
