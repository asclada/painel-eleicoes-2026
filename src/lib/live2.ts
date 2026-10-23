import { getEstimates2 } from "./estimates";
import { BASE, project, type Projection, type UfSnap, type ZoneSnap } from "./projection";
import { makeWorld, snapshotAt, timeForPct, type World } from "./sim2";
import { abUrl, fetchAllUfs, fetchJson, fetchTse, tseUrl, type Turno } from "./tse";
import type { LiveCount } from "./types";

/** Tudo que a tela da apuração do 2º turno recebe numa leitura. */
export interface Live2 {
  br: LiveCount;
  ufs: Record<string, LiveCount | null>;
  projection: Projection;
  /** média das pesquisas usada antes da 1ª urna (Previsão A) */
  prior: { lula: number; sd: number };
  /** só na demonstração: o resultado final sorteado */
  demoTruth?: { lula: number; byUf: Record<string, number> };
  /** só na demonstração: como contagem e projeção andaram até aqui */
  demoTrace?: TracePoint[];
}

/** Um ponto do gráfico "contagem × projeção" (Lula, % dos válidos). */
export interface TracePoint {
  pct: number;
  count: number;
  proj: number;
  sd: number;
}

async function getPrior() {
  try {
    const e = await getEstimates2();
    return { lula: e.fcGeneral.lula, sd: e.fcGeneral.sd };
  } catch {
    return { lula: 49, sd: 2.1 };
  }
}

// ---------------------------------------------------------------------------------------------
// Demonstração: sempre a mesma apuração inventada, parada no % pedido
// ---------------------------------------------------------------------------------------------
const DEMO_SEED = 2026;
let demoWorld: World | null = null;
let demoTrace: { key: string; points: TracePoint[] } | null = null;

export async function demoLive2(p: number): Promise<Live2> {
  demoWorld ??= makeWorld(DEMO_SEED);
  const w = demoWorld;
  const prior = await getPrior();
  const at = (pc: number) => {
    const s = snapshotAt(w, timeForPct(w, Math.min(100, Math.max(0, pc))));
    return { s, pr: project(s.snap, prior) };
  };
  const key = `${prior.lula}|${prior.sd}`;
  if (demoTrace?.key !== key) {
    const points: TracePoint[] = [];
    for (let pc = 1; pc <= 100; pc += pc < 10 ? 1 : 3) {
      const { s, pr } = at(pc);
      points.push({ pct: s.br.pctSections, count: s.br.shares.lula, proj: pr.lula, sd: pr.sd });
    }
    demoTrace = { key, points };
  }
  const { s, pr } = at(p);
  return { br: s.br, ufs: s.ufs, projection: pr, prior, demoTruth: w.truth, demoTrace: demoTrace.points.filter((x) => x.pct <= p + 0.01) };
}

// ---------------------------------------------------------------------------------------------
// TSE de verdade
// ---------------------------------------------------------------------------------------------
interface RawAb {
  abr: { tpabr: string; cdabr: string; s: { st: string; ts: string } }[];
}
interface RawZone {
  s: { st: string; ts: string };
  carg: { agr: { par: { cand: { n: string; vap: string }[] }[] }[] }[];
}

const n = (s: string | undefined) => parseInt(s ?? "0", 10) || 0;

/** Andamento por município de cada UF (último bom guardado; UF já 100% apurada não é lida de novo). */
const abMemo = new Map<string, Record<string, [number, number]>>();
/** Zonas das cidades grandes (zona já 100% apurada não é lida de novo). */
const zoneMemo = new Map<string, ZoneSnap>();

const ZONE_JOBS = Object.entries(BASE.ufs).flatMap(([uf, u]) =>
  Object.entries(u.zones).flatMap(([mun, rows]) => rows.map(([z]) => ({ uf, mun, z, key: `${uf}|${mun}-${z}` }))),
);

/** Roda `fn` em `items` com no máximo `limit` ao mesmo tempo. */
async function pool<T>(items: T[], limit: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

async function readAb(ufs: Record<string, LiveCount | null>, turno: Turno) {
  await pool(Object.keys(BASE.ufs), 8, async (uf) => {
    const c = ufs[uf];
    if (!c?.started || (abMemo.has(uf) && c.pctSections >= 100)) return;
    try {
      const raw = await fetchJson<RawAb>(abUrl(turno, uf));
      const mun: Record<string, [number, number]> = {};
      for (const a of raw.abr) if (a.tpabr === "mun") mun[a.cdabr] = [n(a.s.st), n(a.s.ts)];
      abMemo.set(uf, mun);
    } catch {
      // fica com a última leitura boa
    }
  });
}

async function readZones(ufs: Record<string, LiveCount | null>, turno: Turno) {
  const todo = ZONE_JOBS.filter((j) => {
    const prev = zoneMemo.get(j.key);
    return ufs[j.uf]?.started && !(prev && prev.ts > 0 && prev.st >= prev.ts);
  });
  await pool(todo, 24, async (j) => {
    try {
      const raw = await fetchJson<RawZone>(tseUrl("oficial", turno, j.uf, `${j.uf}${j.mun}-z${j.z}`));
      let lula = 0;
      let flavio = 0;
      for (const agr of raw.carg[0]?.agr ?? [])
        for (const par of agr.par ?? [])
          for (const c of par.cand ?? []) {
            if (c.n === "13") lula = n(c.vap);
            else if (c.n === "22") flavio = n(c.vap);
          }
      zoneMemo.set(j.key, { st: n(raw.s.st), ts: n(raw.s.ts), lula, flavio });
    } catch {
      // fica com a última leitura boa
    }
  });
}

let memo: { at: number; data: Live2 } | null = null;
let inflight: Promise<Live2> | null = null;
const TTL_MS = 15_000;
/** Mais velho que isso, espera a leitura nova em vez de mostrar a guardada. */
const MAX_STALE_MS = 90_000;

/** `turno` = 1 só para testar a leitura com os arquivos (já completos) do 1º turno. */
export async function readLive(turno: Turno = 2): Promise<Live2> {
  const [br, ufs, prior] = await Promise.all([fetchTse("oficial", turno), fetchAllUfs("oficial", turno), getPrior()]);
  if (br.started) await Promise.all([readAb(ufs, turno), readZones(ufs, turno)]);
  const snap: Record<string, UfSnap> = {};
  for (const uf of Object.keys(BASE.ufs)) snap[uf] = { count: ufs[uf] ?? null, mun: abMemo.get(uf) ?? null, zones: {} };
  for (const [key, z] of zoneMemo) {
    const [uf, k] = key.split("|");
    snap[uf].zones[k] = z;
  }
  return { br, ufs, projection: project(snap, prior), prior };
}

/**
 * Leitura do 2º turno, guardada 15 s: várias pessoas olhando ao mesmo tempo não multiplicam as chamadas ao TSE.
 * Ler tudo (zonas + andamento por município) leva alguns segundos, então quem chega recebe na hora a última
 * leitura e a nova é feita depois da resposta (`background`, que a rota liga ao `after` do Next).
 */
export async function getLive2(background: (work: () => Promise<unknown>) => void): Promise<Live2> {
  const age = memo ? Date.now() - memo.at : Infinity;
  if (memo && age < TTL_MS) return memo.data;
  inflight ??= readLive()
    .then((data) => {
      memo = { at: Date.now(), data };
      return data;
    })
    .finally(() => (inflight = null));
  if (memo && age < MAX_STALE_MS) {
    const p = inflight;
    background(() => p.catch(() => undefined));
    return memo.data;
  }
  return inflight;
}
