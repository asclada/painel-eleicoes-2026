"use client";

import { useEffect, useRef, useState } from "react";
import { BY_KEY } from "@/lib/candidates";
import { chance, dec, int, pct } from "@/lib/format";
import type { Live2, TracePoint } from "@/lib/live2";
import { useFetchLoop } from "@/lib/useFetchLoop";
import { CandidateAvatar } from "./CandidateAvatar";
import { StatesPanel } from "./StatesPanel";

type Env = "oficial" | "demo";
export interface Ref2 {
  id: string;
  label: string;
  /** Lula, % dos válidos */
  lula: number;
}

const REFRESH_MS = 20_000;
const STORE_KEY = "apuracao2-trace-v1";

const who = (lula: number) => (lula >= 50 ? { k: "lula" as const, name: "Lula", v: lula, other: "Flávio", ov: 100 - lula } : { k: "flavio" as const, name: "Flávio", v: 100 - lula, other: "Lula", ov: lula });

function useSecondsAgo(lastOk: number | null) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return lastOk && now ? Math.max(0, Math.round((now - lastOk) / 1000)) : null;
}

/** Faixa fixa no topo ao rolar: o essencial numa linha. */
function LiveBar({ d }: { d: Live2 }) {
  const started = d.br.started;
  const l = d.br.shares.lula;
  const pr = d.projection;
  return (
    <div className="sticky top-0 z-10 -mx-4 border-b border-line bg-[#0b1020]/92 px-4 py-2 backdrop-blur md:top-[61px]">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="num flex items-center gap-2">
          <span style={{ color: BY_KEY.lula.color }}>Lula <strong className="text-fg">{started ? pct(l) : "—"}</strong></span>
          <span className="text-faint">×</span>
          <span style={{ color: BY_KEY.flavio.color }}><strong className="text-fg">{started ? pct(100 - l) : "—"}</strong> Flávio</span>
        </span>
        <span className="num text-xs text-muted">{pct(d.br.pctSections, d.br.pctSections % 1 === 0 ? 0 : 1)} apurado</span>
      </div>
      {pr.status !== "prior" && (
        <div className="num mt-0.5 text-xs text-muted">
          <span className="text-[#c4b5fd]">Projeção:</span> <span className="text-fg">{who(pr.lula).name} {pct(who(pr.lula).v)}</span> · chance {chance(Math.max(pr.pLula, 100 - pr.pLula))}
        </div>
      )}
    </div>
  );
}

function Scoreboard({ d, secondsAgo, err, env }: { d: Live2; secondsAgo: number | null; err: string | null; env: Env }) {
  const b = d.br;
  const rows = (["lula", "flavio"] as const)
    .map((k) => ({ k, c: b.candidates.find((x) => x.key === k) }))
    .sort((x, y) => (y.c?.votes ?? 0) - (x.c?.votes ?? 0));
  return (
    <section className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 className="whitespace-nowrap text-base font-semibold">Contagem · 2º turno</h2>
        <span className="text-xs text-muted">
          {env === "demo" ? "demonstração" : `TSE ${b.updatedAt}`}
          {secondsAgo !== null && env !== "demo" && ` · há ${secondsAgo}s`}
        </span>
      </div>

      {err && (
        <div className="mt-3 rounded-lg border border-[#f87171]/40 bg-[#3a1620] p-3 text-sm text-[#fca5a5]" role="alert">
          Não consegui ler o TSE agora ({err}). Tentando de novo a cada {REFRESH_MS / 1000}s; os números são da última leitura.
        </div>
      )}

      <ul className="mt-4 space-y-4">
        {rows.map(({ k, c }) => (
          <li key={k}>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2.5">
                <CandidateAvatar k={k} size={40} />
                <span>
                  <span className="block font-medium">{BY_KEY[k].name}</span>
                  <span className="block text-xs text-faint">{BY_KEY[k].party} · {int(c?.votes ?? 0)} votos</span>
                </span>
              </span>
              <span className="num text-3xl font-semibold">{b.started ? pct(b.shares[k], 2) : "—"}</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="relative mt-4 flex h-3 overflow-hidden rounded-full bg-[#1c2650]" role="presentation">
        {b.started && (
          <>
            <div className="transition-all duration-700" style={{ width: `${b.shares.lula}%`, background: BY_KEY.lula.color }} />
            <div className="transition-all duration-700" style={{ width: `${b.shares.flavio}%`, background: BY_KEY.flavio.color }} />
          </>
        )}
        <div className="absolute inset-y-0 left-1/2 w-0.5 bg-[#0b1020]" />
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted">Seções apuradas</span>
        <span className="num font-semibold">{pct(b.pctSections, b.pctSections % 1 === 0 ? 0 : 2)}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#1c2650]" role="progressbar" aria-valuenow={b.pctSections} aria-valuemin={0} aria-valuemax={100} aria-label="Seções apuradas">
        <div className="h-full rounded-full bg-[#cbd5e1] transition-all duration-700" style={{ width: `${b.pctSections}%` }} />
      </div>
      {b.started ? (
        <p className="mt-3 text-xs text-muted">
          Válidos: <strong className="num text-fg">{int(b.validVotes)}</strong> · brancos {int(b.blank)} · nulos {int(b.nulls)}
        </p>
      ) : (
        <p className="mt-3 rounded-lg border border-line bg-[#0f1630] p-3 text-sm text-muted">
          A apuração começa às 17h (Brasília) de domingo, 25/10. Esta tela lê o TSE sozinha a cada {REFRESH_MS / 1000} segundos.
        </p>
      )}
    </section>
  );
}

function TraceChart({ trace, truth }: { trace: TracePoint[]; truth?: number }) {
  const W = 360;
  const H = 190;
  const M = { l: 30, r: 10, t: 10, b: 24 };
  const vals = trace.flatMap((t) => [t.count, t.proj + 1.645 * t.sd, t.proj - 1.645 * t.sd]).concat(truth ?? 50, 50);
  const lo = Math.floor(Math.min(...vals) / 2) * 2;
  const hi = Math.ceil(Math.max(...vals) / 2) * 2;
  const x = (p: number) => M.l + (p / 100) * (W - M.l - M.r);
  const y = (v: number) => M.t + (1 - (v - lo) / (hi - lo || 1)) * (H - M.t - M.b);
  const line = (k: "count" | "proj") => trace.map((t, i) => `${i ? "L" : "M"}${x(t.pct).toFixed(1)},${y(t[k]).toFixed(1)}`).join(" ");
  const band =
    trace.map((t, i) => `${i ? "L" : "M"}${x(t.pct).toFixed(1)},${y(t.proj + 1.645 * t.sd).toFixed(1)}`).join(" ") +
    [...trace].reverse().map((t) => `L${x(t.pct).toFixed(1)},${y(t.proj - 1.645 * t.sd).toFixed(1)}`).join(" ") + "Z";
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += hi - lo > 12 ? 4 : 2) ticks.push(v);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Lula na contagem e na projeção, conforme a apuração avança">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke={v === 50 ? "#6b7799" : "#243059"} strokeDasharray={v === 50 ? "3 3" : undefined} />
            <text x={M.l - 5} y={y(v) + 3.5} textAnchor="end" fontSize={10} fill="#6b7799">{v}</text>
          </g>
        ))}
        {[0, 25, 50, 75, 100].map((p) => (
          <text key={p} x={x(p)} y={H - 6} textAnchor="middle" fontSize={10} fill="#6b7799">{p}%</text>
        ))}
        <path d={band} fill="#a78bfa" opacity={0.18} />
        {truth !== undefined && <line x1={M.l} x2={W - M.r} y1={y(truth)} y2={y(truth)} stroke="#34d399" strokeDasharray="5 4" />}
        <path d={line("count")} fill="none" stroke="#9aa6c7" strokeWidth={2} />
        <path d={line("proj")} fill="none" stroke="#a78bfa" strokeWidth={2.5} />
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 bg-[#a78bfa]" />Projeção (faixa = 90%)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 bg-[#9aa6c7]" />Contagem</span>
        {truth !== undefined && <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 border-t border-dashed border-[#34d399]" />Final da simulação</span>}
        <span>% de Lula · eixo de baixo: % apurado</span>
      </figcaption>
    </figure>
  );
}

function ProjectionCard({ d, trace }: { d: Live2; trace: TracePoint[] }) {
  const pr = d.projection;
  const w = who(pr.lula);
  const lead = pr.lula >= 50 ? pr.pLula : 100 - pr.pLula;
  const margin = 1.645 * pr.sd;
  return (
    <section className="card card-proj p-4 sm:p-5" aria-live="polite">
      <div className="flex items-center gap-2">
        <span className="rounded bg-[#a78bfa] px-2 py-0.5 text-[11px] font-bold text-[#0b1020]">PROJEÇÃO</span>
        <span className="text-xs text-muted">
          {pr.status === "prior" ? "antes da 1ª urna: média das pesquisas" : pr.status === "final" ? "apuração encerrada" : `com ${pct(pr.counted * 100, 0)} dos votos esperados`}
        </span>
      </div>

      {pr.status === "prior" ? (
        <p className="mt-3 text-base leading-relaxed">
          As pesquisas apontam <strong>{w.name} {pct(w.v)}</strong> × {w.other} {pct(w.ov)}. A partir das 17h a projeção passa a usar as urnas apuradas.
        </p>
      ) : (
        <p className="mt-3 text-base leading-relaxed">
          Se o ritmo continuar, <strong style={{ color: BY_KEY[w.k].color }}>{w.name}</strong> termina com <strong className="num">{pct(w.v)}</strong> e {w.other} com{" "}
          <span className="num">{pct(w.ov)}</span>
          {pr.status === "live" && <span className="text-muted"> (±{dec(margin)} p.p.)</span>}.
        </p>
      )}

      <div className="relative mt-3 h-3 overflow-hidden rounded-full bg-[#1c2650]" role="presentation">
        <div className="absolute inset-y-0 left-0" style={{ width: `${pr.lula}%`, background: BY_KEY.lula.color }} />
        <div className="absolute inset-y-0 right-0" style={{ width: `${100 - pr.lula}%`, background: BY_KEY.flavio.color }} />
        {pr.status !== "final" && (
          <div className="absolute inset-y-0 border-x border-white/70 bg-white/25" style={{ left: `${Math.max(0, pr.lula - margin)}%`, width: `${Math.min(100, 2 * margin)}%` }} />
        )}
        <div className="absolute inset-y-0 left-1/2 w-0.5 bg-[#0b1020]" />
      </div>
      <div className="num mt-1 flex justify-between text-xs">
        <span style={{ color: BY_KEY.lula.color }}>Lula {pct(pr.lula)}</span>
        <span style={{ color: BY_KEY.flavio.color }}>Flávio {pct(100 - pr.lula)}</span>
      </div>

      {pr.status !== "final" && (
        <p className="mt-3 text-sm">
          Chance de vencer: <strong style={{ color: BY_KEY[w.k].color }}>{w.name} {chance(lead)}</strong>
          <span className="text-muted"> · {w.other} {chance(100 - lead)}</span>
        </p>
      )}

      {trace.length > 1 && (
        <div className="mt-4">
          <TraceChart trace={trace} truth={d.demoTruth?.lula} />
        </div>
      )}

      <details className="mt-3 text-xs text-muted">
        <summary className="text-accent">Como a projeção é feita</summary>
        <p className="mt-2 leading-relaxed">
          Cada zona eleitoral das 190 cidades com mais de uma zona, e cada município nas demais, é comparada com o voto do mesmo lugar no 1º turno. A diferença
          medida no que já foi apurado é aplicada ao que falta contar, lugar por lugar. Por isso o Sul apurar antes do Nordeste, ou um bairro antes do outro,
          não engana a projeção. Com pouco apurado num estado, ele usa a tendência da região e do país; antes da 1ª urna, vale a média das pesquisas. A
          faixa cobre 90% dos casos numa simulação com 150 apurações inventadas.
        </p>
      </details>
    </section>
  );
}

function Compare({ d, refs }: { d: Live2; refs: Ref2[] }) {
  const pr = d.projection;
  if (pr.status === "prior") return null;
  const base = pr.lula;
  const label = pr.status === "final" ? "resultado" : "projeção";
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="text-base font-semibold">Pesquisas × {label}</h2>
      <p className="mt-1 text-sm text-muted">Quanto cada leitura das pesquisas dava para o Lula, e a diferença para a {label} de agora ({pct(base)}).</p>
      <ul className="mt-3 divide-y divide-line/60">
        {[...refs].sort((a, b) => Math.abs(a.lula - base) - Math.abs(b.lula - base)).map((r, i) => {
          const diff = r.lula - base;
          const a = Math.abs(diff);
          return (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>{r.label}{i === 0 && <span className="ml-1 text-[#34d399]">★</span>}</span>
              <span className="num">
                Lula {pct(r.lula)}
                <span className={`ml-2 text-xs ${a <= 1 ? "text-[#34d399]" : a <= 2.5 ? "text-[#fbbf24]" : "text-[#f87171]"}`}>
                  {diff > 0 ? "+" : diff < 0 ? "−" : ""}{dec(a)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ApuracaoLive2({ env, refs }: { env: Env; refs: Ref2[] }) {
  const [demoP, setDemoP] = useState(30);
  const url = `/api/apuracao/r2?env=${env}${env === "demo" ? `&p=${demoP}` : ""}`;
  const { data, err, lastOk } = useFetchLoop<Live2>(url, env === "demo" ? null : REFRESH_MS);
  const secondsAgo = useSecondsAgo(lastOk);
  const [trace, setTrace] = useState<TracePoint[]>(() => {
    if (typeof window === "undefined" || env === "demo") return [];
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]") as TracePoint[];
    } catch {
      return [];
    }
  });
  const lastPct = useRef(-1);

  // guarda um ponto do gráfico a cada avanço da apuração (fica no aparelho, sobrevive a recarregar a página)
  useEffect(() => {
    if (env === "demo" || !data?.br.started || data.projection.status === "prior") return;
    if (Math.abs(data.br.pctSections - lastPct.current) < 0.3) return;
    lastPct.current = data.br.pctSections;
    setTrace((prev) => {
      const next = [...prev.filter((p) => p.pct < data.br.pctSections), { pct: data.br.pctSections, count: data.br.shares.lula, proj: data.projection.lula, sd: data.projection.sd }].slice(-300);
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, [data, env]);

  const shownTrace = env === "demo" ? (data?.demoTrace ?? []) : trace;

  return (
    <div className="space-y-5">
      {env === "demo" && (
        <div className="card space-y-2 border-[#fbbf24]/40 p-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="rounded bg-[#fbbf24] px-2 py-0.5 text-xs font-bold text-[#0b1020]">DEMONSTRAÇÃO</span>
            <span className="text-muted">Apuração inventada, na ordem real em que os municípios fecharam no 1º turno.</span>
          </div>
          <label className="flex items-center gap-3 text-xs text-muted">
            <span className="shrink-0">% apurado: <strong className="num text-fg">{demoP}%</strong></span>
            <input type="range" min={0} max={100} value={demoP} onChange={(e) => setDemoP(Number(e.target.value))} className="w-full accent-[#a78bfa]" aria-label="Percentual apurado na demonstração" />
          </label>
          {data?.demoTruth && (
            <p className="text-xs text-faint">
              Resultado final sorteado nesta demonstração: Lula {pct(data.demoTruth.lula)} × Flávio {pct(100 - data.demoTruth.lula)} (para conferir a projeção).
            </p>
          )}
        </div>
      )}

      {!data ? (
        <div className="card p-5 text-sm text-muted">{err ? `Não consegui ler o TSE agora (${err}). Tentando de novo…` : "Carregando a apuração…"}</div>
      ) : (
        <>
          {data.br.started && <LiveBar d={data} />}
          <div className="grid items-start gap-5 lg:grid-cols-2">
            <Scoreboard d={data} secondsAgo={secondsAgo} err={err} env={env} />
            <ProjectionCard d={data} trace={shownTrace} />
          </div>
          <section className="card p-4 sm:p-5">
            <h2 className="text-base font-semibold">Estado a estado</h2>
            <p className="mb-4 mt-1 text-sm text-muted">Toque num estado ou abra uma região para ver quanto já foi apurado e quem lidera.</p>
            <StatesPanel counts={data.ufs} proj={data.projection.status === "live" ? data.projection.byUf : undefined} />
          </section>
          <Compare d={data} refs={refs} />
        </>
      )}
    </div>
  );
}
