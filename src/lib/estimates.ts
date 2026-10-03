import { getPolls, getPolls2 } from "./polls";
import { aggregate, forecast, forecast2, pickReliable, todayBR, trackRecord, trendSeries, TOP_RELIABLE } from "./model";

export const CORRECTIONS = [0, 20, 50] as const;
export const DEFAULT_CORRECTION = 20;

/** Tudo que as telas precisam, calculado no servidor a partir das pesquisas mais recentes. */
const memo1 = new Map<string, Promise<Estimates>>();
const memo2 = new Map<string, Promise<Estimates2>>();

/** Contas do 1º turno; refeitas só quando alguma pesquisa muda (ou vira o dia). */
export async function getEstimates(corrPct: number = DEFAULT_CORRECTION): Promise<Estimates> {
  const r = await getPolls();
  const key = `${r.version}|${todayBR()}|${corrPct}`;
  let hit = memo1.get(key);
  if (!hit) {
    if (memo1.size > 6) memo1.clear();
    hit = compute1(r, corrPct);
    memo1.set(key, hit);
  }
  return hit;
}

async function compute1(r: Awaited<ReturnType<typeof getPolls>>, corrPct: number) {
  const { polls, source, fetchedAt, manualCount, pending } = r;
  const asOf = todayBR();
  const corr = corrPct / 100;
  const track = trackRecord();
  const reliable = pickReliable(polls, track, asOf, TOP_RELIABLE);
  const instWeight = (i: string) => reliable.weight.get(i) ?? 0;

  const general = aggregate(polls, { asOf });
  const certeiros = aggregate(polls, { asOf, only: reliable.only, instWeight });
  if (!general || !certeiros) throw new Error("Sem pesquisas suficientes na janela de 90 dias.");

  return {
    asOf,
    source,
    fetchedAt,
    manualCount,
    pending,
    totalPolls: polls.length,
    track,
    reliable: reliable.chosen,
    corrPct,
    general,
    certeiros,
    fcGeneral: forecast(general, track, corr, 11),
    fcCerteiros: forecast(certeiros, track, corr, 13),
    trendGeneral: trendSeries(polls, asOf),
    trendCerteiros: trendSeries(polls, asOf, 90, 2, reliable.only, instWeight),
    polls,
  };
}

export type Estimates = Awaited<ReturnType<typeof compute1>>;

/** 2º turno (Lula x Flávio): mesma receita do 1º turno, com histórico de 2018 e 2022. */
export async function getEstimates2(corrPct: number = DEFAULT_CORRECTION): Promise<Estimates2> {
  const r = await getPolls2();
  const key = `${r.version}|${todayBR()}|${corrPct}`;
  let hit = memo2.get(key);
  if (!hit) {
    if (memo2.size > 6) memo2.clear();
    hit = compute2(r, corrPct);
    memo2.set(key, hit);
  }
  return hit;
}

async function compute2(r: Awaited<ReturnType<typeof getPolls2>>, corrPct: number) {
  const { polls, source, fetchedAt, manualCount } = r;
  const asOf = todayBR();
  const corr = corrPct / 100;
  const track = trackRecord(2);
  const reliable = pickReliable(polls, track, asOf, TOP_RELIABLE);
  const instWeight = (i: string) => reliable.weight.get(i) ?? 0;
  const general = aggregate(polls, { asOf });
  const certeiros = aggregate(polls, { asOf, only: reliable.only, instWeight });
  if (!general) throw new Error("Sem pesquisas de 2º turno suficientes na janela de 90 dias.");
  return {
    asOf, source, fetchedAt, manualCount, totalPolls: polls.length, track, reliable: reliable.chosen, corrPct,
    general, certeiros,
    fcGeneral: forecast2(general, track, corr),
    fcCerteiros: certeiros ? forecast2(certeiros, track, corr) : null,
    trendGeneral: trendSeries(polls, asOf),
    trendCerteiros: trendSeries(polls, asOf, 90, 2, reliable.only, instWeight),
    polls,
  };
}

export type Estimates2 = Awaited<ReturnType<typeof compute2>>;
