import history from "../../data/history.json";
import { CAND_KEYS, emptyShares } from "./candidates";
import type { Aggregate, CandKey, Forecast, Poll, Shares, WeightedPoll } from "./types";

export const WINDOW_DAYS = 90;
export const HALF_LIFE_DAYS = 7;
export const TOP_RELIABLE = 6;

const DAY = 86_400_000;
const t = (d: string) => Date.parse(`${d}T12:00:00Z`);

/** Data de hoje em Brasília (yyyy-mm-dd). */
export function todayBR(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}

/** Converte a pesquisa (em % do total de entrevistados) para votos válidos: fora branco/nulo/indecisos. */
export function validShares(p: Poll): Shares | null {
  if (p.lula === null || p.flavio === null) return null;
  const raw: Shares = {
    lula: p.lula, flavio: p.flavio, caiado: p.caiado ?? 0, cury: p.cury ?? 0, renan: p.renan ?? 0,
    zema: p.zema ?? 0, demais: (p.demais ?? 0) + (p.outros ?? 0),
  };
  const total = CAND_KEYS.reduce((a, k) => a + raw[k], 0);
  if (total <= 0) return null;
  const out = emptyShares();
  for (const k of CAND_KEYS) out[k] = (raw[k] / total) * 100;
  return out;
}

/** Margem de erro usada no peso: a declarada; sem ela, a estimada pelo tamanho da amostra. */
export function effectiveMoe(p: Poll): number {
  if (p.moe && p.moe > 0) return p.moe;
  if (p.n && p.n > 0) return 98 / Math.sqrt(p.n);
  return 2.2;
}

export interface AggregateOpts {
  asOf: string; // yyyy-mm-dd
  windowDays?: number;
  halfLifeDays?: number;
  /** multiplicador por instituto (ex.: histórico de acertos) */
  instWeight?: (institute: string) => number;
  only?: Set<string>;
}

/**
 * Média ponderada em votos válidos. Peso de cada pesquisa:
 *   recência (meia-vida de 7 dias) × margem de erro (menor margem pesa mais, limitado a 0,5×–2×)
 *   ÷ √(nº de pesquisas do mesmo instituto na janela) × multiplicador do instituto.
 */
export function aggregate(polls: Poll[], o: AggregateOpts): Aggregate | null {
  const windowDays = o.windowDays ?? WINDOW_DAYS;
  const half = o.halfLifeDays ?? HALF_LIFE_DAYS;
  const asOfT = t(o.asOf);
  const eligible = polls.filter((p) => {
    const age = (asOfT - t(p.end)) / DAY;
    return age >= -0.01 && age <= windowDays && (!o.only || o.only.has(p.institute)) && validShares(p);
  });
  if (!eligible.length) return null;

  const count = new Map<string, number>();
  for (const p of eligible) count.set(p.institute, (count.get(p.institute) ?? 0) + 1);

  const rows: WeightedPoll[] = eligible.map((poll) => {
    const age = Math.max(0, (asOfT - t(poll.end)) / DAY);
    const recency = 0.5 ** (age / half);
    const moe = Math.min(2, Math.max(0.5, (2 / effectiveMoe(poll)) ** 2));
    const weight = recency * moe * (1 / Math.sqrt(count.get(poll.institute)!)) * (o.instWeight?.(poll.institute) ?? 1);
    return { poll, valid: validShares(poll)!, weight, share: 0 };
  });
  const W = rows.reduce((a, r) => a + r.weight, 0);
  rows.forEach((r) => (r.share = r.weight / W));
  rows.sort((a, b) => (a.poll.end < b.poll.end ? 1 : a.poll.end > b.poll.end ? -1 : b.weight - a.weight));

  const shares = emptyShares();
  for (const r of rows) for (const k of CAND_KEYS) shares[k] += r.valid[k] * r.share;

  // dispersão entre institutos (média de cada instituto, ponderada)
  const byInst = new Map<string, { w: number; s: Shares }>();
  for (const r of rows) {
    const e = byInst.get(r.poll.institute) ?? { w: 0, s: emptyShares() };
    for (const k of CAND_KEYS) e.s[k] += r.valid[k] * r.weight;
    e.w += r.weight;
    byInst.set(r.poll.institute, e);
  }
  const sdHouse = emptyShares();
  for (const k of CAND_KEYS) {
    let acc = 0;
    for (const e of byInst.values()) acc += e.w * (e.s[k] / e.w - shares[k]) ** 2;
    sdHouse[k] = Math.sqrt(acc / W);
  }
  const avgMoe = rows.reduce((a, r) => a + effectiveMoe(r.poll) * r.share, 0);
  const latest = rows.reduce((a, r) => (r.poll.end > a ? r.poll.end : a), "");
  return { shares, nPolls: rows.length, nInstitutes: byInst.size, sdHouse, avgMoe, latest, rows };
}

// ---------------------------------------------------------------------------------------------
// Histórico: quem chegou mais perto do resultado em 2018 e 2022
// ---------------------------------------------------------------------------------------------
interface HistPoll {
  institute: string;
  end: string;
  nominalTotal: number;
  [k: string]: string | number | null;
}

const ELECTIONS = [
  { year: 2022, weight: 2, cands: ["Lula", "Bolsonaro", "Ciro", "Tebet"], pt: "Lula", bolso: "Bolsonaro" },
  { year: 2018, weight: 1, cands: ["Bolsonaro", "Haddad", "Ciro", "Alckmin"], pt: "Haddad", bolso: "Bolsonaro" },
] as const;

interface ElectionCfg {
  year: number;
  weight: number;
  cands: readonly string[];
  pt: string;
  bolso: string;
}

// 2º turno: só dois candidatos; o erro de um é o espelho do outro
const ELECTIONS2: readonly ElectionCfg[] = [
  { year: 2022, weight: 2, cands: ["Lula", "Bolsonaro"], pt: "Lula", bolso: "Bolsonaro" },
  { year: 2018, weight: 1, cands: ["Haddad", "Bolsonaro"], pt: "Haddad", bolso: "Bolsonaro" },
];

export interface YearRecord {
  year: number;
  pollDate: string;
  /** erro médio absoluto (pontos) nos 4 mais votados, em votos válidos; os 2 primeiros pesam o dobro */
  err: number;
  /** quanto o candidato "de esquerda" teve a mais (+) ou a menos (−) que a pesquisa */
  ptErr: number;
  bolsoErr: number;
}

export interface InstituteRecord {
  institute: string;
  years: YearRecord[];
  /** nota final: erro médio ajustado (menor = mais certeiro) */
  score: number;
}

export interface TrackRecord {
  institutes: InstituteRecord[];
  /** viés médio histórico: quanto o candidato teve a mais que a pesquisa (pontos). Positivo = subestimado. */
  bias: { pt: number; bolso: number };
  /** erro típico do conjunto de pesquisas por lado, em pontos, descontada a correção `f` aplicada */
  sigma: (f: number) => { pt: number; bolso: number };
  byYear: { year: number; ptBias: number; bolsoBias: number }[];
}

export function trackRecord(round: 1 | 2 = 1): TrackRecord {
  const elections: readonly ElectionCfg[] = round === 1 ? ELECTIONS : ELECTIONS2;
  const results = (round === 1 ? history.results : history.results2) as Record<string, Record<string, number>>;
  const pollsByYear = (round === 1 ? history.elections : history.round2) as unknown as Record<string, HistPoll[]>;
  const perInst = new Map<string, YearRecord[]>();
  const byYear: TrackRecord["byYear"] = [];
  for (const el of elections) {
    const actual = results[String(el.year)];
    const polls = pollsByYear[String(el.year)];
    const latest = new Map<string, HistPoll>();
    for (const p of polls) {
      const cur = latest.get(p.institute);
      if (!cur || p.end >= cur.end) latest.set(p.institute, p);
    }
    let ptSum = 0;
    let bolsoSum = 0;
    for (const [inst, p] of latest) {
      const valid = (c: string) => (((p[c] as number) ?? 0) / p.nominalTotal) * 100;
      // erro médio nos 4 mais votados; os 2 primeiros (que decidem quem lidera e quem vai ao 2º turno) pesam o dobro
      const w = round === 1 ? [2, 2, 1, 1] : [1, 1];
      const ranked = [...el.cands].sort((a, b) => actual[b] - actual[a]);
      const err = ranked.reduce((a, c, i) => a + w[i] * Math.abs(valid(c) - actual[c]), 0) / w.reduce((a, b) => a + b, 0);
      const ptErr = actual[el.pt] - valid(el.pt);
      const bolsoErr = actual[el.bolso] - valid(el.bolso);
      ptSum += ptErr;
      bolsoSum += bolsoErr;
      const list = perInst.get(inst) ?? [];
      list.push({ year: el.year, pollDate: p.end, err, ptErr, bolsoErr });
      perInst.set(inst, list);
    }
    byYear.push({ year: el.year, ptBias: ptSum / latest.size, bolsoBias: bolsoSum / latest.size });
  }

  const wOf = (y: number) => elections.find((e) => e.year === y)!.weight;
  const all = [...perInst.values()].flat();
  const mu = all.reduce((a, r) => a + r.err * wOf(r.year), 0) / all.reduce((a, r) => a + wOf(r.year), 0);
  const K = 1; // peso do "palpite" médio: institutos com pouco histórico puxam para a média geral
  const institutes: InstituteRecord[] = [...perInst.entries()]
    .map(([institute, years]) => {
      const wSum = years.reduce((a, r) => a + wOf(r.year), 0);
      const score = (years.reduce((a, r) => a + r.err * wOf(r.year), 0) + K * mu) / (wSum + K);
      return { institute, years: years.sort((a, b) => b.year - a.year), score };
    })
    .sort((a, b) => a.score - b.score);

  const wTot = elections.reduce((a, e) => a + e.weight, 0);
  const bias = {
    pt: byYear.reduce((a, y) => a + y.ptBias * wOf(y.year), 0) / wTot,
    bolso: byYear.reduce((a, y) => a + y.bolsoBias * wOf(y.year), 0) / wTot,
  };
  const sigma = (f: number) => {
    const rms = (side: "ptBias" | "bolsoBias", b: number) =>
      Math.sqrt(byYear.reduce((a, y) => a + wOf(y.year) * (y[side] - f * b) ** 2, 0) / wTot);
    const floor = round === 1 ? 2 : 1.5;
    return { pt: Math.max(floor, rms("ptBias", bias.pt)), bolso: Math.max(floor, rms("bolsoBias", bias.bolso)) };
  };
  return { institutes, bias, sigma, byYear };
}

/** Os institutos "certeiros" que estão ativos na janela atual: melhor nota histórica, até `topN`. */
export function pickReliable(polls: Poll[], track: TrackRecord, asOf: string, topN = TOP_RELIABLE) {
  const asOfT = t(asOf);
  const active = new Set(
    polls.filter((p) => (asOfT - t(p.end)) / DAY <= WINDOW_DAYS && (asOfT - t(p.end)) / DAY >= -0.01).map((p) => p.institute),
  );
  const chosen = track.institutes.filter((i) => active.has(i.institute)).slice(0, topN);
  const inv = chosen.map((c) => 1 / c.score ** 2);
  const mean = inv.reduce((a, b) => a + b, 0) / (inv.length || 1);
  const weight = new Map(chosen.map((c, i) => [c.institute, inv[i] / mean]));
  return { chosen, only: new Set(chosen.map((c) => c.institute)), weight };
}

// ---------------------------------------------------------------------------------------------
// Previsão: média -> (correção opcional do viés histórico) -> incerteza -> 20 mil simulações
// ---------------------------------------------------------------------------------------------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rnd: () => number) {
  const u = Math.max(rnd(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
}

export const SIMS = 20_000;

export function forecast(agg: Aggregate, track: TrackRecord, corr: number, seed = 7): Forecast {
  const adj: Shares = { ...agg.shares };
  adj.lula = Math.max(0, adj.lula + corr * track.bias.pt);
  adj.flavio = Math.max(0, adj.flavio + corr * track.bias.bolso);
  const tot = CAND_KEYS.reduce((a, k) => a + adj[k], 0);
  for (const k of CAND_KEYS) adj[k] = (adj[k] / tot) * 100;

  const sg = track.sigma(corr);
  const sd = emptyShares();
  for (const k of CAND_KEYS) {
    const hist = k === "lula" ? sg.pt : k === "flavio" ? sg.bolso : 0.5 + 0.18 * adj[k];
    sd[k] = Math.sqrt(hist ** 2 + agg.sdHouse[k] ** 2);
  }

  const rnd = mulberry32(seed);
  const rho = -0.25; // quando um dos líderes é subestimado, o outro tende a ser superestimado
  const draws: Record<CandKey, Float32Array> = Object.fromEntries(CAND_KEYS.map((k) => [k, new Float32Array(SIMS)])) as never;
  const lead = { lula: 0, flavio: 0, outro: 0 };
  const win = emptyShares();
  const runoff = emptyShares();
  const named = CAND_KEYS.filter((k) => k !== "demais");
  const v = emptyShares();
  for (let i = 0; i < SIMS; i++) {
    const z1 = gauss(rnd);
    const z2 = gauss(rnd);
    const z: Shares = emptyShares();
    for (const k of CAND_KEYS) z[k] = gauss(rnd);
    z.lula = z1;
    z.flavio = rho * z1 + Math.sqrt(1 - rho * rho) * z2;
    let s = 0;
    for (const k of CAND_KEYS) {
      v[k] = Math.max(0, adj[k] + sd[k] * z[k]);
      s += v[k];
    }
    for (const k of CAND_KEYS) {
      v[k] = (v[k] / s) * 100;
      draws[k][i] = v[k];
    }
    const order = [...named].sort((a, b) => v[b] - v[a]);
    if (order[0] === "lula") lead.lula++;
    else if (order[0] === "flavio") lead.flavio++;
    else lead.outro++;
    runoff[order[0]]++;
    runoff[order[1]]++;
    for (const k of named) if (v[k] > 50) win[k]++;
  }
  const q = (k: CandKey, p: number) => {
    const a = Float32Array.from(draws[k]).sort();
    return a[Math.min(SIMS - 1, Math.floor(p * SIMS))];
  };
  const lo = emptyShares();
  const hi = emptyShares();
  for (const k of CAND_KEYS) {
    lo[k] = q(k, 0.05);
    hi[k] = q(k, 0.95);
    win[k] = (win[k] / SIMS) * 100;
    runoff[k] = (runoff[k] / SIMS) * 100;
  }
  const anyWin = CAND_KEYS.reduce((a, k) => a + win[k], 0);
  return {
    mean: adj, lo, hi,
    pLead: { lula: (lead.lula / SIMS) * 100, flavio: (lead.flavio / SIMS) * 100, outro: (lead.outro / SIMS) * 100 },
    pWinFirstRound: win, pRunoff: runoff, pSecondRound: Math.max(0, 100 - anyWin),
  };
}

/** Série da média ao longo do tempo (para o gráfico). */
export function trendSeries(polls: Poll[], asOf: string, days = WINDOW_DAYS, step = 2, only?: Set<string>, instWeight?: (i: string) => number) {
  const out: { date: string; shares: Shares }[] = [];
  const end = t(asOf);
  for (let d = days; d >= 0; d -= step) {
    const date = new Date(end - d * DAY).toISOString().slice(0, 10);
    const a = aggregate(polls, { asOf: date, windowDays: 45, only, instWeight });
    if (a) out.push({ date, shares: a.shares });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// 2º turno (dois candidatos): a incerteza é uma curva normal em torno da média de Lula
// ---------------------------------------------------------------------------------------------
export interface Forecast2 {
  /** média das pesquisas, antes do ajuste */
  base: number;
  lula: number;
  flavio: number;
  lo: number;
  hi: number;
  sd: number;
  pLula: number;
  pFlavio: number;
}

function normCdf(x: number) {
  const tt = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * tt * (0.3193815 + tt * (-0.3565638 + tt * (1.781478 + tt * (-1.821256 + tt * 1.330274))));
  return x > 0 ? 1 - p : p;
}

export function forecast2(agg: Aggregate, track: TrackRecord, corr: number): Forecast2 {
  const base = agg.shares.lula;
  const lula = Math.min(99, Math.max(1, base + corr * track.bias.pt));
  const sd = Math.sqrt(track.sigma(corr).pt ** 2 + agg.sdHouse.lula ** 2);
  const pLula = normCdf((lula - 50) / sd) * 100;
  return { base, lula, flavio: 100 - lula, lo: lula - 1.645 * sd, hi: lula + 1.645 * sd, sd, pLula, pFlavio: 100 - pLula };
}
