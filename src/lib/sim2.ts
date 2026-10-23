import { emptyShares } from "./candidates";
import { gauss, mulberry32 } from "./model";
import { BASE, type UfSnap } from "./projection";
import type { LiveCount } from "./types";
import { REGION_OF, REGIONS, type RegionKey } from "./ufs";

/**
 * Apuração de 2º turno inventada, para a demonstração e para testar a projeção. Parte do resultado real do
 * 1º turno de 2026 em cada município/zona, sorteia um resultado "verdadeiro" do 2º turno (com diferenças por
 * região, estado e lugar) e conta os votos na mesma ordem em que cada município fechou a apuração no 1º turno.
 */

interface SimUnit {
  uf: string;
  mun: string;
  zone: string | null;
  ts: number;
  /** válidos no 2º turno */
  v2: number;
  /** % de Lula (0-1) */
  share: number;
  /** as primeiras seções apuradas não representam o lugar inteiro: diferença inicial (0-1) que some até o fim */
  early: number;
  /** minuto (depois das 17h) em que começa e termina de apurar */
  t0: number;
  t1: number;
}

export interface World {
  units: SimUnit[];
  /** resultado final verdadeiro (% dos válidos) */
  truth: { lula: number; byUf: Record<string, number> };
}

export interface WorldOpts {
  /** fatia dos votos dos outros candidatos que vai para o Lula */
  transfer: number;
  /** quanto o Brasil inteiro se afasta disso (pontos para Lula) */
  swing: number;
  regionSd: number;
  ufSd: number;
  unitSd: number;
  /** diferença (pontos) entre as primeiras e as últimas seções apuradas de um mesmo lugar */
  earlySd: number;
  /** a mesma diferença, igual no país todo (ex.: seções urbanas apuram antes em todo lugar) */
  earlyCommon: number;
  /** swing não uniforme: Lula ganha (ou perde) mais onde foi fraco no 1º turno */
  tilt: number;
}

export const DEMO_OPTS: WorldOpts = { transfer: 0.42, swing: 0.4, regionSd: 1.2, ufSd: 1.2, unitSd: 2.5, earlySd: 3, earlyCommon: -1.5, tilt: -0.05 };

export function makeWorld(seed: number, o: WorldOpts = DEMO_OPTS): World {
  const rnd = mulberry32(seed);
  const g = () => gauss(rnd);
  const reg = Object.fromEntries(REGIONS.map((r) => [r.key, g() * o.regionSd])) as Record<RegionKey, number>;
  const units: SimUnit[] = [];
  const finishes = Object.values(BASE.ufs).flatMap((u) => u.mun.map((m) => m[7]).filter((x) => x >= 0)).sort((a, b) => a - b);
  const medianFinish = finishes[finishes.length >> 1] ?? 150;
  const byUfL: Record<string, number> = {};
  const byUfV: Record<string, number> = {};
  let L = 0;
  let V = 0;
  for (const [uf, bu] of Object.entries(BASE.ufs)) {
    const ufEff = g() * o.ufSd + reg[REGION_OF[uf] ?? "EXT"] + o.swing;
    const turnout = 0.98 + g() * 0.02;
    const add = (mun: string, zone: string | null, ts: number, v: number, l: number, f: number, finish: number) => {
      if (v <= 0) return;
      const b = (l + o.transfer * (v - l - f)) / v;
      const share = Math.min(0.97, Math.max(0.03, b + (ufEff + g() * o.unitSd) / 100 + o.tilt * (b - 0.5)));
      const v2 = Math.round(v * turnout * (1 + g() * 0.02));
      const t1 = Math.max(20, finish);
      units.push({ uf, mun, zone, ts, v2, share, early: (o.earlyCommon + g() * o.earlySd) / 100, t0: rnd() * 0.3 * t1, t1 });
      byUfL[uf] = (byUfL[uf] ?? 0) + v2 * share;
      byUfV[uf] = (byUfV[uf] ?? 0) + v2;
      L += v2 * share;
      V += v2;
    };
    for (const [cd, ts, , , v, l, f, fin] of bu.mun) {
      const finish = fin >= 0 ? fin : medianFinish;
      const zr = bu.zones[cd];
      if (zr) for (const [z, zts, , , zv, zl, zf] of zr) add(cd, z, zts, zv, zl, zf, finish * (0.75 + 0.5 * rnd()));
      else add(cd, null, ts, v, l, f, finish);
    }
  }
  const byUf = Object.fromEntries(Object.keys(byUfV).map((u) => [u, (byUfL[u] / byUfV[u]) * 100]));
  return { units, truth: { lula: (L / V) * 100, byUf } };
}

const progress = (u: SimUnit, t: number) => Math.min(1, Math.max(0, (t - u.t0) / (u.t1 - u.t0)));

function liveCount(lula: number, flavio: number, st: number, ts: number): LiveCount {
  const valid = lula + flavio;
  const shares = emptyShares();
  shares.lula = valid > 0 ? (lula / valid) * 100 : 0;
  shares.flavio = valid > 0 ? (flavio / valid) * 100 : 0;
  const candidates = [
    { number: "13", name: "LULA", party: "PT", votes: lula, pct: shares.lula, status: "", key: "lula" as const },
    { number: "22", name: "FLÁVIO BOLSONARO", party: "PL", votes: flavio, pct: shares.flavio, status: "", key: "flavio" as const },
  ].sort((a, b) => b.votes - a.votes || (a.key === "flavio" ? -1 : 1));
  return {
    env: "demo", updatedAt: "DEMONSTRAÇÃO", started: valid > 0, pctSections: ts > 0 ? (st / ts) * 100 : 0,
    sections: { counted: st, total: ts }, validVotes: valid, blank: Math.round(valid * 0.02), nulls: Math.round(valid * 0.035),
    candidates, shares,
  };
}

/** Como estaria a apuração `t` minutos depois das 17h. */
export function snapshotAt(w: World, t: number) {
  const snap: Record<string, UfSnap> = {};
  const acc: Record<string, { l: number; f: number; st: number; ts: number }> = {};
  const munProg: Record<string, Record<string, [number, number]>> = {};
  let bl = 0;
  let bf = 0;
  let bst = 0;
  let bts = 0;
  for (const u of w.units) {
    const st = Math.floor(progress(u, t) * u.ts);
    const frac = u.ts > 0 ? st / u.ts : 0;
    const sh = Math.min(0.99, Math.max(0.01, u.share + u.early * (1 - frac)));
    const l = Math.round(frac * u.v2 * sh);
    const f = Math.round(frac * u.v2 * (1 - sh));
    const a = (acc[u.uf] ??= { l: 0, f: 0, st: 0, ts: 0 });
    a.l += l;
    a.f += f;
    a.st += st;
    a.ts += u.ts;
    const mp = (munProg[u.uf] ??= {});
    const prev = mp[u.mun] ?? [0, 0];
    mp[u.mun] = [prev[0] + st, prev[1] + u.ts];
    const s = (snap[u.uf] ??= { count: null, mun: null, zones: {} });
    if (u.zone) s.zones[`${u.mun}-${u.zone}`] = { st, ts: u.ts, lula: l, flavio: f };
    bl += l;
    bf += f;
    bst += st;
    bts += u.ts;
  }
  const ufs: Record<string, LiveCount> = {};
  for (const [uf, a] of Object.entries(acc)) {
    ufs[uf] = liveCount(a.l, a.f, a.st, a.ts);
    snap[uf].count = ufs[uf];
    snap[uf].mun = munProg[uf];
  }
  return { br: liveCount(bl, bf, bst, bts), ufs, snap };
}

/** Minuto em que a apuração nacional chega a `p`% das seções. */
export function timeForPct(w: World, p: number) {
  if (p <= 0) return 0;
  const total = w.units.reduce((x, u) => x + u.ts, 0);
  const at = (t: number) => w.units.reduce((x, u) => x + Math.floor(progress(u, t) * u.ts), 0) / total;
  let lo = 0;
  let hi = Math.max(...w.units.map((u) => u.t1)) + 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid) * 100 < p) lo = mid;
    else hi = mid;
  }
  return hi;
}
