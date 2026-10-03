"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BY_KEY, CAND_KEYS } from "@/lib/candidates";
import { mae, SERIES_COLORS, type LiveSource } from "@/lib/compare";
import { dec, int, pct } from "@/lib/format";
import type { CandKey, LiveCount, Shares } from "@/lib/types";
import { useFetchLoop } from "@/lib/useFetchLoop";
import { BrazilMap, type UfCounts } from "./BrazilMap";
import { CandidateAvatar } from "./CandidateAvatar";
import { UfTable } from "./UfTable";

type Env = "oficial" | "simulado" | "demo";
interface Trace {
  pct: number;
  mae: Record<string, number>;
}

const REFRESH_MS = 20_000;
const UF_REFRESH_MS = 30_000;
const STORE_KEY = "apuracao-trace-v1";

function closeness(diff: number) {
  const a = Math.abs(diff);
  return a <= 1 ? "text-[#34d399]" : a <= 2.5 ? "text-[#fbbf24]" : "text-[#f87171]";
}

export function ApuracaoLive({ env, sources }: { env: Env; sources: LiveSource[] }) {
  const [demoP, setDemoP] = useState(35);
  const demoQ = env === "demo" ? `&p=${demoP}` : "";
  const { data, err, lastOk } = useFetchLoop<LiveCount>(`/api/apuracao?env=${env}${demoQ}`, env === "demo" ? null : REFRESH_MS);
  const { data: ufs } = useFetchLoop<UfCounts>(`/api/apuracao/uf?env=${env}${demoQ}`, env === "demo" ? null : UF_REFRESH_MS);
  const [trace, setTrace] = useState<Trace[]>(() => {
    if (typeof window === "undefined" || env === "demo") return [];
    try {
      return JSON.parse(localStorage.getItem(`${STORE_KEY}-${env}`) ?? "[]") as Trace[];
    } catch {
      return [];
    }
  });
  const lastPct = useRef(-1);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const compare = useMemo(() => {
    if (!data?.started) return null;
    return sources.map((s) => ({ ...s, mae: mae(s.shares, data.shares) }));
  }, [data, sources]);

  // registra um ponto do gráfico de erro a cada avanço de apuração
  useEffect(() => {
    if (!data?.started || !compare || env === "demo") return;
    if (Math.abs(data.pctSections - lastPct.current) < 0.5) return;
    lastPct.current = data.pctSections;
    setTrace((prev) => {
      const next = [...prev, { pct: data.pctSections, mae: Object.fromEntries(compare.map((c) => [c.id, c.mae])) }].slice(-200);
      try {
        localStorage.setItem(`${STORE_KEY}-${env}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, [data, compare, env]);

  const best = compare ? [...compare].sort((a, b) => a.mae - b.mae)[0] : null;
  const shown = env === "demo" ? buildDemoTrace(sources, demoP) : trace;
  const secondsAgo = lastOk && now ? Math.max(0, Math.round((now - lastOk) / 1000)) : null;

  return (
    <div className="space-y-6">
      {env !== "oficial" && (
        <div className="card flex flex-wrap items-center gap-3 border-[#fbbf24]/40 p-3 text-sm">
          <span className="rounded bg-[#fbbf24] px-2 py-0.5 text-xs font-bold text-[#0b1020]">{env === "demo" ? "DEMONSTRAÇÃO" : "ENSAIO DO TSE"}</span>
          <span className="text-muted">
            {env === "demo"
              ? "Números inventados só para testar a tela. Não são da eleição."
              : "Dados do ambiente de simulado do TSE, com candidatos fictícios. Serve para testar a conexão."}
          </span>
          {env === "demo" && (
            <label className="ml-auto flex items-center gap-3 text-xs text-muted">
              % apurado: <strong className="num text-fg">{demoP}%</strong>
              <input type="range" min={0} max={100} value={demoP} onChange={(e) => setDemoP(Number(e.target.value))} className="w-40 accent-[#a78bfa]" aria-label="Percentual apurado na demonstração" />
            </label>
          )}
        </div>
      )}

      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Contagem · 1º turno</h2>
            <p className="mt-0.5 text-xs text-muted">
              {data ? `TSE · atualizado ${data.updatedAt}` : "Carregando…"}
              {secondsAgo !== null && env !== "demo" && ` · lido há ${secondsAgo}s`}
            </p>
          </div>
          <div className="text-right">
            <div className="num text-3xl font-semibold">{data ? pct(data.pctSections, data.pctSections % 1 === 0 ? 0 : 2) : "—"}</div>
            <div className="text-xs text-muted">das seções apuradas</div>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#1c2650]" role="progressbar" aria-valuenow={data?.pctSections ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label="Seções apuradas">
          <div className="h-full rounded-full bg-[#a78bfa] transition-all duration-700" style={{ width: `${data?.pctSections ?? 0}%` }} />
        </div>

        {err && (
          <div className="mt-4 rounded-lg border border-[#f87171]/40 bg-[#3a1620] p-3 text-sm text-[#fca5a5]" role="alert">
            Não consegui ler o TSE agora ({err}). Tentando de novo a cada {REFRESH_MS / 1000}s.
            {data && " Os números abaixo são da última leitura."}
          </div>
        )}

        {data && !data.started && !err && (
          <div className="mt-4 rounded-lg border border-line bg-[#0f1630] p-3 text-sm text-muted">
            A apuração começa às 17h (Brasília). Enquanto isso, nada é contado. Esta tela lê o TSE sozinha a cada {REFRESH_MS / 1000} segundos.
          </div>
        )}

        {data && (
          <ul className="mt-5 grid gap-x-8 gap-y-3 md:grid-cols-2">
            {data.candidates
              .filter((c) => c.key !== "demais" || data.env !== "oficial" || c.votes > 0)
              .slice(0, 8)
              .map((c, i) => {
                const color = BY_KEY[c.key].color;
                const tracked = c.key !== "demais";
                return (
                  <li key={`${c.number}${c.name}`}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2 text-sm">
                        <CandidateAvatar k={c.key} size={i < 2 ? 34 : 26} />
                        <span className={`truncate ${i < 2 ? "font-medium" : "text-muted"}`}>{tracked ? BY_KEY[c.key].short : c.name}</span>
                        <span className="text-xs text-faint">{c.party}</span>
                      </span>
                      <span className={`num ${i < 2 ? "text-2xl font-semibold" : "text-base text-muted"}`}>{pct(c.pct, 2)}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#1c2650]" role="presentation">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (c.pct / 55) * 100)}%`, background: color }} />
                    </div>
                    <div className="mt-0.5 text-[11px] text-faint">{int(c.votes)} votos</div>
                  </li>
                );
              })}
          </ul>
        )}

        {data?.started && (
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-1 border-t border-line pt-3 text-xs text-muted">
            <span>Votos válidos: <strong className="text-fg">{int(data.validVotes)}</strong></span>
            <span>Brancos: {int(data.blank)}</span>
            <span>Nulos: {int(data.nulls)}</span>
            {(() => {
              const d = data.shares.lula - data.shares.flavio;
              return <span>{d >= 0 ? "Lula" : "Flávio"} na frente por <strong className="text-fg">{dec(Math.abs(d), 2)} p.p.</strong></span>;
            })()}
          </div>
        )}
      </section>

      <section className="card p-5">
        <h2 className="text-base font-semibold">Estado a estado</h2>
        <p className="mb-4 mt-1 text-sm text-muted">Quem está na frente em cada estado, conforme as urnas entram. Atualiza a cada {UF_REFRESH_MS / 1000} segundos.</p>
        {!ufs ? (
          <p className="rounded-lg border border-line bg-[#0f1630] p-3 text-sm text-muted">Carregando os estados…</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <BrazilMap counts={ufs} />
            <UfTable counts={ufs} />
          </div>
        )}
      </section>

      <section className="card p-5">
        <h2 className="text-base font-semibold">Contagem × pesquisas × previsões</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          Em votos válidos. Cada leitura mostra o que apontava e a diferença para a contagem de agora (verde: até 1 p.p.; amarelo: até 2,5; vermelho: mais).
        </p>
        {!data?.started || !compare ? (
          <p className="rounded-lg border border-line bg-[#0f1630] p-3 text-sm text-muted">A comparação aparece assim que as primeiras urnas forem apuradas.</p>
        ) : (
          <>
            <div className="space-y-3 sm:hidden">
              {[...compare].sort((a, b) => a.mae - b.mae).map((s) => (
                <div key={s.id} className="rounded-xl border border-line bg-[#0f1630] p-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium" style={{ color: SERIES_COLORS[s.id] }}>{s.label}</span>
                    <span className={`num text-sm font-semibold ${s.id === best?.id ? "text-[#34d399]" : ""}`}>
                      {dec(s.mae, 2)} p.p. {s.id === best?.id && "★"}
                    </span>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    {CAND_KEYS.map((k: CandKey) => {
                      const diff = s.shares[k] - data.shares[k];
                      const inBand = s.band ? data.shares[k] >= s.band.lo[k] && data.shares[k] <= s.band.hi[k] : null;
                      return (
                        <div key={k} className="flex items-baseline justify-between gap-2">
                          <dt className="flex items-center gap-1.5 text-muted">
                            <CandidateAvatar k={k} size={18} />
                            {BY_KEY[k].short}
                          </dt>
                          <dd className="num">
                            {dec(s.shares[k])}
                            <span className={`ml-1 text-xs ${closeness(diff)}`}>{diff > 0 ? "+" : diff < 0 ? "−" : ""}{dec(Math.abs(diff))}</span>
                            {inBand !== null && <span className={`ml-0.5 text-xs ${inBand ? "text-[#34d399]" : "text-[#f87171]"}`}>{inBand ? "✓" : "✗"}</span>}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              ))}
            </div>
            <div className="scroll-x hidden sm:block">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-line text-xs text-faint">
                    <th className="py-2 pr-3 text-left font-medium">Candidato</th>
                    <th className="py-2 pr-3 text-right font-medium">Contagem</th>
                    {compare.map((s) => (
                      <th key={s.id} className="py-2 pr-3 text-right font-medium" style={{ color: SERIES_COLORS[s.id] }}>{s.short}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CAND_KEYS.map((k: CandKey) => (
                    <tr key={k} className="border-b border-line/50">
                      <td className="py-2 pr-3">
                        <span className="flex items-center gap-2">
                          <CandidateAvatar k={k} size={22} />
                          {BY_KEY[k].short}
                        </span>
                      </td>
                      <td className="num py-2 pr-3 text-right font-semibold">{pct(data.shares[k])}</td>
                      {compare.map((s) => {
                        const diff = s.shares[k] - data.shares[k];
                        const inBand = s.band ? data.shares[k] >= s.band.lo[k] && data.shares[k] <= s.band.hi[k] : null;
                        return (
                          <td key={s.id} className="num py-2 pr-3 text-right">
                            {dec(s.shares[k])}
                            <span className={`ml-1.5 text-xs ${closeness(diff)}`}>{diff > 0 ? "+" : diff < 0 ? "−" : ""}{dec(Math.abs(diff))}</span>
                            {inBand !== null && (
                              <span className={`ml-1 text-xs ${inBand ? "text-[#34d399]" : "text-[#f87171]"}`} title={inBand ? "dentro da faixa de 90% da previsão" : "fora da faixa de 90% da previsão"}>
                                {inBand ? "✓" : "✗"}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr>
                    <td className="py-2.5 pr-3 font-medium">Erro médio</td>
                    <td />
                    {compare.map((s) => (
                      <td key={s.id} className={`num py-2.5 pr-3 text-right font-semibold ${s.id === best?.id ? "text-[#34d399]" : ""}`}>
                        {dec(s.mae, 2)} p.p.
                        {s.id === best?.id && <span className="ml-1">★</span>}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-faint">
              ★ = leitura mais próxima da contagem agora. ✓ / ✗ = a contagem está dentro / fora da faixa de 90% da previsão. No começo a contagem não representa o país inteiro (cada região apura num ritmo), então o erro costuma
              mudar bastante ao longo da noite.
            </p>

            <h3 className="mb-2 mt-6 text-sm font-medium">Quem está mais perto, agora</h3>
            <ul className="space-y-2">
              {[...compare].sort((a, b) => a.mae - b.mae).map((s, i) => (
                <li key={s.id} className="flex items-center gap-3 text-sm">
                  <span className="w-44 shrink-0 text-muted sm:w-56">{i + 1}º · {s.label}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#1c2650]">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (s.mae / 6) * 100)}%`, background: SERIES_COLORS[s.id] }} />
                  </div>
                  <span className="num w-20 text-right">{dec(s.mae, 2)} p.p.</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {compare && shown.length > 1 && (
        <section className="card p-5">
          <h2 className="text-base font-semibold">Erro ao longo da apuração</h2>
          <p className="mb-3 mt-1 text-sm text-muted">Erro médio de cada leitura contra a contagem, conforme as seções vão sendo apuradas. Quanto mais baixo, melhor.</p>
          <ErrorChart trace={shown} sources={sources} />
        </section>
      )}
    </div>
  );
}

function buildDemoTrace(sources: LiveSource[], upTo: number): Trace[] {
  // só para a demonstração: recalcula a curva localmente a partir da mesma função do servidor
  const out: Trace[] = [];
  for (let p = 2; p <= upTo; p += 3) {
    const live = demoShares(p);
    out.push({ pct: p, mae: Object.fromEntries(sources.map((s) => [s.id, mae(s.shares, live)])) });
  }
  return out;
}

function demoShares(p: number): Shares {
  const FINAL: Shares = { lula: 43.8, flavio: 41.6, caiado: 4.1, cury: 3.4, renan: 4.5, zema: 1.1, demais: 1.5 };
  const EARLY: Shares = { lula: -4.5, flavio: 4.0, caiado: 0.4, cury: 0.1, renan: 0.2, zema: 0, demais: -0.2 };
  const decay = (1 - p / 100) ** 2;
  const s = { ...FINAL };
  let tot = 0;
  for (const k of CAND_KEYS) {
    s[k] = Math.max(0.05, FINAL[k] + EARLY[k] * decay);
    tot += s[k];
  }
  for (const k of CAND_KEYS) s[k] = (s[k] / tot) * 100;
  return s;
}

function ErrorChart({ trace, sources }: { trace: Trace[]; sources: LiveSource[] }) {
  const W = 600;
  const H = 260;
  const M = { l: 40, r: 14, t: 12, b: 28 };
  const maxY = Math.max(2, Math.ceil(Math.max(...trace.flatMap((t) => Object.values(t.mae)))));
  const x = (p: number) => M.l + (p / 100) * (W - M.l - M.r);
  const y = (v: number) => M.t + (1 - v / maxY) * (H - M.t - M.b);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Erro médio de cada leitura ao longo da apuração">
        {Array.from({ length: maxY + 1 }, (_, v) => v).map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="#243059" />
            <text x={M.l - 8} y={y(v) + 4} textAnchor="end" fontSize={13} fill="#6b7799">{v}</text>
          </g>
        ))}
        {[0, 25, 50, 75, 100].map((p) => (
          <text key={p} x={x(p)} y={H - 8} textAnchor="middle" fontSize={13} fill="#6b7799">{p}%</text>
        ))}
        {sources.map((s) => (
          <path
            key={s.id}
            d={trace.map((t, i) => `${i ? "L" : "M"}${x(t.pct).toFixed(1)},${y(t.mae[s.id] ?? 0).toFixed(1)}`).join(" ")}
            fill="none"
            stroke={SERIES_COLORS[s.id]}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
        ))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        {sources.map((s) => (
          <span key={s.id} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: SERIES_COLORS[s.id] }} />
            {s.label}
          </span>
        ))}
        <span>Eixo horizontal: % das seções apuradas</span>
      </figcaption>
    </figure>
  );
}
