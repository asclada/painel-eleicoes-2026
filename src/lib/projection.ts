import base from "../../data/base-r1.json";
import type { LiveCount } from "./types";
import { REGION_OF, REGIONS, type RegionKey } from "./ufs";

/**
 * Projeção do resultado final do 2º turno durante a apuração.
 *
 * Ideia: cada pedaço do país (zona eleitoral nas 190 cidades com mais de uma zona; município no resto) tem um
 * "ponto de partida", que é o voto dele no 1º turno de 2026. O que já foi apurado no 2º turno é comparado com o
 * que se esperaria daquele mesmo pedaço; essa diferença ("swing") é aplicada ao que ainda falta contar.
 * Assim, contar primeiro o Sul ou primeiro os bairros mais ricos de uma capital não engana a projeção.
 *
 * Com pouco apurado num lugar, o swing dele é puxado para o do nível de cima (zona → estado → região → Brasil),
 * e o do Brasil começa na média das pesquisas. Tudo em fração do voto válido de Lula + Flávio.
 */

type MunRow = [string, number, number, number, number, number, number, number];
type ZoneRow = [string, number, number, number, number, number, number];
interface BaseFile {
  national: { valid: number; lula: number; flavio: number };
  ufs: Record<string, { mun: MunRow[]; zones: Record<string, ZoneRow[]> }>;
}
export const BASE = base as unknown as BaseFile;

/** O que se sabe de uma zona eleitoral agora. */
export interface ZoneSnap {
  st: number;
  ts: number;
  lula: number;
  flavio: number;
}

/** Tudo que a projeção precisa de uma UF num momento da apuração. */
export interface UfSnap {
  count: LiveCount | null;
  /** seções apuradas / total por município (arquivo "ab" do TSE); null se não deu para ler */
  mun: Record<string, [number, number]> | null;
  /** zonas das cidades grandes, chave `${município}-${zona}` */
  zones: Record<string, ZoneSnap>;
}

export interface Projection {
  /** % dos válidos ao fim da apuração */
  lula: number;
  flavio: number;
  /** desvio da projeção (pontos) */
  sd: number;
  pLula: number;
  /** fração (0-1) dos votos esperados que já foi apurada */
  counted: number;
  byUf: Record<string, { lula: number; counted: number }>;
  /** "prior" = nada apurado ainda (só pesquisas); "live" = apurando; "final" = tudo contado */
  status: "prior" | "live" | "final";
}

// Quanto cada nível confia nos próprios dados: com essa fração apurada, o dado vale tanto quanto o nível de cima.
const K_NAT = 0.03;
const K_REG = 0.05;
const K_UF = 0.08;
const K_ZONE = 0.1;
// Quanto uma região / um estado costuma se afastar do swing do nível de cima (em fração; 0,02 = 2 pontos).
const TAU_REG = 0.015;
const TAU_UF = 0.02;
/**
 * Dentro de cada zona/município, as primeiras seções apuradas podem não representar o lugar inteiro (as urbanas
 * costumam chegar antes). Se isso acontecer igual no país todo, não se cancela: incerteza extra que some conforme
 * os lugares terminam de apurar. Calibrado numa simulação pessimista (viés comum de ~2,5 pontos).
 */
const EARLY_SD = 0.02;

interface Unit {
  /** válidos no 1º turno */
  v: number;
  /** % esperado para Lula (0-1) antes de olhar o 2º turno */
  b: number;
  /** fração apurada */
  f: number;
  zone?: { lula: number; flavio: number };
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

function normCdf(x: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

/** Fatia dos votos dos outros candidatos do 1º turno que vai para o Lula, para que o Brasil inteiro bata com as pesquisas. */
export function transferFromPolls(priorLula: number) {
  const n = BASE.national;
  const others = n.valid - n.lula - n.flavio;
  return clamp(((priorLula / 100) * n.valid - n.lula) / others, 0.1, 0.9);
}

const shrink = (own: number | null, w: number, parent: number, k: number) => (own === null ? parent : (w * own + k * parent) / (w + k));

/**
 * @param snap  o que já foi apurado, por UF
 * @param prior média das pesquisas para Lula (% dos válidos) e o desvio da previsão (pontos)
 */
export function project(snap: Record<string, UfSnap>, prior: { lula: number; sd: number }): Projection {
  const a = transferFromPolls(prior.lula);
  const ufCodes = Object.keys(BASE.ufs);

  // 1) monta as unidades e mede o swing do que já foi apurado em cada UF
  interface UfWork {
    code: string;
    region: RegionKey;
    units: Unit[];
    mUnits: Unit[];
    zUnits: Unit[];
    V: number;
    counted: { lula: number; flavio: number };
    expCounted: number; // válidos do 1º turno na parte apurada
    fM: number; // fração apurada da parte "municípios" (sem as zonas das cidades grandes)
    sM: number | null;
    wM: number;
    zObs: { s: number; w: number }[];
    f: number;
  }
  const work: UfWork[] = [];
  for (const code of ufCodes) {
    const bu = BASE.ufs[code];
    const s = snap[code];
    const ufFrac = s?.count ? clamp((s.count.sections?.total ? s.count.sections.counted / s.count.sections.total : s.count.pctSections / 100), 0, 1) : 0;
    const mUnits: Unit[] = [];
    const zUnits: Unit[] = [];
    for (const [cd, , , , v, l, fl] of bu.mun) {
      const zr = bu.zones[cd];
      if (zr) {
        for (const [z, , , , zv, zl, zf] of zr) {
          const zs = s?.zones[`${cd}-${z}`];
          const f = zs && zs.ts > 0 ? zs.st / zs.ts : 0;
          zUnits.push({ v: zv, b: zv > 0 ? (zl + a * (zv - zl - zf)) / zv : 0.5, f, zone: zs ? { lula: zs.lula, flavio: zs.flavio } : undefined });
        }
      } else {
        const p = s?.mun?.[cd];
        // sem o arquivo de andamento, supõe que o município está no mesmo ritmo da UF
        const f = p ? (p[1] > 0 ? p[0] / p[1] : 0) : ufFrac;
        mUnits.push({ v, b: v > 0 ? (l + a * (v - l - fl)) / v : 0.5, f });
      }
    }
    const units = [...mUnits, ...zUnits];
    const V = units.reduce((x, u) => x + u.v, 0);
    const counted = { lula: s?.count?.candidates.find((c) => c.key === "lula")?.votes ?? 0, flavio: s?.count?.candidates.find((c) => c.key === "flavio")?.votes ?? 0 };

    // zonas com voto lido: swing de cada uma
    const zObs: { s: number; w: number }[] = [];
    let zl = 0;
    let zf = 0;
    for (const u of zUnits) {
      if (u.zone && u.zone.lula + u.zone.flavio > 0 && u.f > 0) {
        zObs.push({ s: u.zone.lula / (u.zone.lula + u.zone.flavio) - u.b, w: u.f * u.v });
        zl += u.zone.lula;
        zf += u.zone.flavio;
      }
    }
    // resto da UF (municípios com uma zona só): total da UF menos as zonas lidas
    const ml = Math.max(0, counted.lula - zl);
    const mf = Math.max(0, counted.flavio - zf);
    const wM = mUnits.reduce((x, u) => x + u.f * u.v, 0);
    const vM = mUnits.reduce((x, u) => x + u.v, 0);
    const eM = wM > 0 ? mUnits.reduce((x, u) => x + u.f * u.v * u.b, 0) / wM : 0;
    const sM = wM > 0 && ml + mf > 0 ? ml / (ml + mf) - eM : null;
    const expCounted = units.reduce((x, u) => x + u.f * u.v, 0);
    work.push({
      code, region: REGION_OF[code] ?? "EXT", units, mUnits, zUnits, V, counted, expCounted,
      fM: vM > 0 ? wM / vM : 0, sM, wM, zObs, f: V > 0 ? expCounted / V : 0,
    });
  }

  // 2) swing em cada nível, do Brasil para baixo
  const totalV = work.reduce((x, w) => x + w.V, 0);
  const obsOf = (ws: UfWork[]) => {
    let sw = 0;
    let ww = 0;
    for (const w of ws) {
      if (w.sM !== null) {
        sw += w.sM * w.wM;
        ww += w.wM;
      }
      for (const z of w.zObs) {
        sw += z.s * z.w;
        ww += z.w;
      }
    }
    return ww > 0 ? sw / ww : null;
  };
  const F = work.reduce((x, w) => x + w.expCounted, 0) / totalV;
  const sNatObs = obsOf(work);
  const S = sNatObs === null ? 0 : (F * sNatObs) / (F + K_NAT);

  // comparecimento: válidos do 2º turno / válidos do 1º turno, na parte apurada
  const turnout = (ws: UfWork[]) => {
    const exp = ws.reduce((x, w) => x + w.expCounted, 0);
    const got = ws.reduce((x, w) => x + w.counted.lula + w.counted.flavio, 0);
    return exp > 0 && got > 0 ? got / exp : null;
  };
  const tNatObs = turnout(work);
  const T = tNatObs === null ? 1 : shrink(tNatObs, F, 1, K_NAT);

  const regionSwing = new Map<RegionKey, { s: number; f: number }>();
  for (const r of REGIONS) {
    const ws = work.filter((w) => w.region === r.key);
    const v = ws.reduce((x, w) => x + w.V, 0);
    const f = v > 0 ? ws.reduce((x, w) => x + w.expCounted, 0) / v : 0;
    regionSwing.set(r.key, { s: shrink(obsOf(ws), f, S, K_REG), f });
  }

  // 3) projeta o que falta em cada unidade
  const byUf: Projection["byUf"] = {};
  let natL = 0;
  let natV = 0;
  const remShareUf = new Map<string, number>();
  const ufSigma = new Map<string, number>();
  for (const w of work) {
    const R = regionSwing.get(w.region)!.s;
    const U = shrink(obsOf([w]), w.f, R, K_UF);
    const mSwing = shrink(w.sM, w.fM, U, K_UF);
    const t = shrink(turnout([w]), w.f, T, K_UF);
    let remL = 0;
    let remV = 0;
    for (const u of w.mUnits) {
      const rv = (1 - u.f) * u.v * t;
      remV += rv;
      remL += rv * clamp(u.b + mSwing, 0.01, 0.99);
    }
    for (const u of w.zUnits) {
      const own = u.zone && u.zone.lula + u.zone.flavio > 0 && u.f > 0 ? u.zone.lula / (u.zone.lula + u.zone.flavio) - u.b : null;
      const zs = shrink(own, u.f, U, K_ZONE);
      const rv = (1 - u.f) * u.v * t;
      remV += rv;
      remL += rv * clamp(u.b + zs, 0.01, 0.99);
    }
    const L = w.counted.lula + remL;
    const V = w.counted.lula + w.counted.flavio + remV;
    byUf[w.code] = { lula: V > 0 ? (L / V) * 100 : 50, counted: w.f };
    natL += L;
    natV += V;
    remShareUf.set(w.code, remV);
    ufSigma.set(w.code, TAU_UF * Math.sqrt(K_UF / (w.f + K_UF)));
  }
  const lula = natV > 0 ? (natL / natV) * 100 : prior.lula;

  // 4) incerteza: erro comum do Brasil + de cada região + de cada estado, só sobre o que falta contar
  const rem = (code: string) => (remShareUf.get(code) ?? 0) / natV;
  const remAll = work.reduce((x, w) => x + rem(w.code), 0);
  const sigmaS = (prior.sd / 100) * Math.sqrt(K_NAT / (F + K_NAT));
  let var_ = (remAll * sigmaS) ** 2 + (remAll * EARLY_SD) ** 2;
  for (const r of REGIONS) {
    const rr = r.ufs.reduce((x, u) => x + rem(u), 0);
    const f = regionSwing.get(r.key)!.f;
    var_ += (rr * TAU_REG * Math.sqrt(K_REG / (f + K_REG))) ** 2;
  }
  for (const w of work) var_ += (rem(w.code) * ufSigma.get(w.code)!) ** 2;
  const sd = Math.sqrt(var_) * 100;
  const status: Projection["status"] = F <= 0 ? "prior" : remAll < 1e-4 ? "final" : "live";
  const pLula = status === "prior" ? normCdf((prior.lula - 50) / prior.sd) * 100 : sd < 1e-6 ? (lula > 50 ? 100 : 0) : normCdf((lula - 50) / sd) * 100;

  return {
    lula: status === "prior" ? prior.lula : lula,
    flavio: 100 - (status === "prior" ? prior.lula : lula),
    sd: status === "prior" ? prior.sd : sd,
    pLula,
    counted: F,
    byUf,
    status,
  };
}
