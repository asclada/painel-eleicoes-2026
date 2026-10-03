import { BY_NUMBER, CAND_KEYS, emptyShares } from "./candidates";
import type { CandKey, LiveCandidate, LiveCount, Shares } from "./types";
import { UF_CODES } from "./ufs";

/**
 * Arquivos públicos de resultado do TSE (presidente, Brasil). O arquivo "-u.json" já existe antes da
 * eleição (com votos zerados) e é atualizado durante a apuração. O ambiente "simulado" é o ensaio oficial
 * do TSE: serve para testar a leitura, mas os candidatos dele são fictícios.
 */
export const TSE_URLS = {
  oficial: "https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-c0001-e006257-u.json",
  simulado: "https://resultados-sim.tse.jus.br/simulado/simulado2026/ele2026/21270/dados/br/br-c0001-e021270-u.json",
} as const;

interface RawCand {
  n: string;
  nmu: string;
  vap: string;
  pvapn?: string;
  pvap: string;
  st: string;
}
interface RawFile {
  dg: string;
  hg: string;
  s?: { pstn?: string; pst?: string };
  v?: { vv?: string; vb?: string; vn?: string; tvn?: string };
  carg: { agr: { par: { sg: string; cand: RawCand[] }[] }[] }[];
}

const toNum = (s: string | undefined) => {
  if (!s) return 0;
  const v = parseFloat(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(v) ? v : 0;
};

export function normalizeTse(raw: RawFile, env: "oficial" | "simulado"): LiveCount {
  const candidates: LiveCandidate[] = [];
  for (const agr of raw.carg[0]?.agr ?? []) {
    for (const par of agr.par ?? []) {
      for (const c of par.cand ?? []) {
        candidates.push({
          number: c.n,
          name: c.nmu,
          party: par.sg,
          votes: toNum(c.vap),
          pct: toNum(c.pvapn ?? c.pvap),
          status: c.st ?? "",
          key: env === "oficial" ? (BY_NUMBER[c.n] ?? "demais") : "demais",
        });
      }
    }
  }
  // empate (ex.: antes da 1ª urna): mantém a ordem de exibição do site
  candidates.sort((a, b) => b.votes - a.votes || CAND_KEYS.indexOf(a.key) - CAND_KEYS.indexOf(b.key));
  const validVotes = toNum(raw.v?.vv);
  const shares = emptyShares();
  const sumVotes = candidates.reduce((a, c) => a + c.votes, 0);
  for (const c of candidates) shares[c.key] += sumVotes > 0 ? (c.votes / sumVotes) * 100 : 0;
  return {
    env,
    updatedAt: `${raw.dg} ${raw.hg}`,
    started: sumVotes > 0,
    pctSections: toNum(raw.s?.pstn ?? raw.s?.pst),
    validVotes,
    blank: toNum(raw.v?.vb),
    nulls: toNum(raw.v?.vn ?? raw.v?.tvn),
    candidates,
    shares,
  };
}

async function fetchJson(url: string): Promise<RawFile> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; eleicoes-2026-simulacao/1.0)", Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`TSE respondeu HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  // o TSE serve em UTF-8 às vezes e ISO-8859-1 outras: tenta UTF-8 e cai para latin1
  let txt = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  if (txt.includes("�")) txt = new TextDecoder("iso-8859-1").decode(buf);
  return JSON.parse(txt.replace(/^﻿/, "")) as RawFile;
}

export async function fetchTse(env: "oficial" | "simulado"): Promise<LiveCount> {
  return normalizeTse(await fetchJson(TSE_URLS[env]), env);
}

const ufUrl = (env: "oficial" | "simulado", uf: string) =>
  env === "oficial"
    ? `https://resultados.tse.jus.br/oficial/ele2026/6257/dados/${uf}/${uf}-c0001-e006257-u.json`
    : `https://resultados-sim.tse.jus.br/simulado/simulado2026/ele2026/21270/dados/${uf}/${uf}-c0001-e021270-u.json`;

const ufMemo: Partial<Record<"oficial" | "simulado", { at: number; data: Record<string, LiveCount | null> }>> = {};
const UF_TTL_MS = 15_000;

/** Contagem de cada estado (e exterior). Guarda 15 s em memória para vários acessos não multiplicarem as chamadas ao TSE. */
export async function fetchAllUfs(env: "oficial" | "simulado"): Promise<Record<string, LiveCount | null>> {
  const hit = ufMemo[env];
  if (hit && Date.now() - hit.at < UF_TTL_MS) return hit.data;
  const entries = await Promise.all(
    UF_CODES.map(async (uf) => {
      try {
        return [uf, normalizeTse(await fetchJson(ufUrl(env, uf)), env)] as const;
      } catch {
        return [uf, null] as const;
      }
    }),
  );
  const data = Object.fromEntries(entries);
  if (Object.values(data).some((v) => v)) ufMemo[env] = { at: Date.now(), data };
  return data;
}

// ---------------------------------------------------------------------------------------------
// Modo demonstração: simula uma apuração (sem relação com a eleição real) só para testar a tela.
// ---------------------------------------------------------------------------------------------
const DEMO_FINAL: Shares = { lula: 43.8, flavio: 41.6, caiado: 4.1, cury: 3.4, renan: 4.5, zema: 1.1, demais: 1.5 };
// no começo da contagem costuma aparecer mais voto de certas regiões; aqui, vantagem inicial do Flávio
const DEMO_EARLY: Shares = { lula: -4.5, flavio: 4.0, caiado: 0.4, cury: 0.1, renan: 0.2, zema: 0, demais: -0.2 };

export function demoCount(pct: number): LiveCount {
  const p = Math.min(100, Math.max(0, pct));
  const decay = (1 - p / 100) ** 2;
  const shares = emptyShares();
  let tot = 0;
  for (const k of CAND_KEYS) {
    shares[k] = Math.max(0.05, DEMO_FINAL[k] + DEMO_EARLY[k] * decay);
    tot += shares[k];
  }
  for (const k of CAND_KEYS) shares[k] = (shares[k] / tot) * 100;
  const validVotes = Math.round((p / 100) * 118_000_000);
  const info: Record<CandKey, { number: string; name: string; party: string }> = {
    lula: { number: "13", name: "LULA", party: "PT" },
    flavio: { number: "22", name: "FLÁVIO BOLSONARO", party: "PL" },
    caiado: { number: "55", name: "RONALDO CAIADO", party: "PSD" },
    cury: { number: "70", name: "ESCRITOR AUGUSTO CURY", party: "AVANTE" },
    renan: { number: "14", name: "RENAN SANTOS", party: "MISSÃO" },
    zema: { number: "30", name: "ZEMA", party: "NOVO" },
    demais: { number: "", name: "DEMAIS", party: "" },
  };
  const candidates = CAND_KEYS.map((key) => ({
    ...info[key], key, votes: Math.round((shares[key] / 100) * validVotes), pct: shares[key], status: "",
  })).sort((a, b) => b.votes - a.votes);
  return {
    env: "demo", updatedAt: "DEMONSTRAÇÃO", started: p > 0, pctSections: p, validVotes,
    blank: Math.round(validVotes * 0.045), nulls: Math.round(validVotes * 0.05), candidates, shares,
  };
}

// Margem inventada (Lula menos Flávio, em pontos) por estado, só para a demonstração.
const DEMO_MARGIN: Record<string, number> = {
  sp: -6, mg: 1, rj: -9, ba: 32, pr: -17, rs: -8, pe: 28, ce: 33, pa: 8, sc: -26, ma: 34, go: -12, pb: 24, es: -10,
  am: 3, pi: 40, rn: 22, mt: -22, al: 14, df: -14, ms: -13, se: 24, ro: -28, to: -2, ac: -26, ap: -2, rr: -34, zz: 2,
};

export function demoUfCounts(pct: number): Record<string, LiveCount> {
  const out: Record<string, LiveCount> = {};
  UF_CODES.forEach((code, i) => {
    const p = Math.min(100, Math.max(0, pct * (0.75 + ((i * 37) % 50) / 100)));
    const m = DEMO_MARGIN[code] ?? 0;
    const shares = emptyShares();
    shares.lula = 44 + m / 2;
    shares.flavio = 44 - m / 2;
    shares.caiado = 3.5;
    shares.cury = 2.5;
    shares.renan = 3;
    shares.zema = 1;
    shares.demais = 1;
    const tot = CAND_KEYS.reduce((a, k) => a + shares[k], 0);
    for (const k of CAND_KEYS) shares[k] = (shares[k] / tot) * 100;
    const base = demoCount(p);
    const weight = code === "sp" ? 0.22 : code === "zz" ? 0.01 : 0.03;
    const valid = Math.round(base.validVotes * weight);
    const candidates = base.candidates
      .map((c) => ({ ...c, pct: shares[c.key], votes: Math.round((shares[c.key] / 100) * valid) }))
      .sort((a, b) => b.votes - a.votes);
    out[code] = { ...base, shares, validVotes: valid, candidates, started: p > 0, pctSections: Math.round(p) };
  });
  return out;
}
