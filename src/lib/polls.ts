import * as cheerio from "cheerio";
import snapshot from "../../data/polls2026.json";
import manual from "../../data/manual-polls.json";
import snapshot2 from "../../data/polls2026_r2.json";
import manual2 from "../../data/manual-polls-r2.json";
import { todayBR } from "./model";
import type { Poll } from "./types";

/**
 * Pesquisas de 1º turno de 2026. Fonte principal: tabela da Wikipédia (que cita os registros do TSE),
 * lida no servidor a cada ~5 min. Se a leitura falhar, usa o último retrato salvo em data/polls2026.json.
 * Pesquisas que ainda não entraram na Wikipédia podem ser adicionadas em data/manual-polls.json.
 */
const WIKI_API = "https://pt.wikipedia.org/w/api.php";
const WIKI_PAGE = "Pesquisas_de_opinião_para_a_eleição_presidencial_no_Brasil_em_2026";
const WIKI_HEADERS = { "User-Agent": "eleicoes-2026-simulacao/1.0 (projeto pessoal, poucas requisições)" };

export const POLLS_REVALIDATE_SECONDS = 90;

const MONTHS: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

const ALIASES: [string, string][] = [
  ["datafolha", "Datafolha"], ["ipec", "Ipec"], ["ibope", "Ipec"], ["quaest", "Quaest"],
  ["atlas", "AtlasIntel"], ["parana", "Paraná Pesquisas"], ["poderdata", "PoderData"],
  ["datapoder", "PoderData"], ["real time", "Real Time Big Data"], ["mda", "CNT/MDA"],
  ["verita", "Veritá"], ["futura", "Futura"], ["gerp", "Gerp"], ["ideia", "Ideia"],
  ["nexus", "Nexus"], ["fsb", "Nexus"], ["ipespe", "Ipespe"], ["brasmarket", "Brasmarket"],
  ["vox populi", "Vox Populi"], ["vox", "Vox Brasil"], ["palver", "Palver"], ["indexa", "Indexa"],
  ["alfa", "Alfa Inteligência"], ["datatrends", "DataTrends"], ["data trends", "DataTrends"],
  ["american analytics", "American Analytics"], ["times", "American Analytics"],
  ["equilibrio", "Equilíbrio Brasil"], ["meio", "Ideia"], ["vetor", "Vetor/Arrow"],
  ["arrow", "Vetor/Arrow"],
];

export function strip(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function instName(raw: string): string {
  const cleaned = raw.replace(/BR-\d+\/\d{4}/g, "").trim();
  const key = strip(cleaned.toLowerCase());
  for (const [frag, name] of ALIASES) if (key.includes(frag)) return name;
  const parts = cleaned.split("/");
  return (parts[parts.length - 1] || cleaned).trim();
}

function num(raw: string): number | null {
  const s = raw.replace(/ /g, " ").trim();
  if (!s || /^[-—–]$/.test(s) || s === "N/A") return null;
  if (s.startsWith("<")) return 0.5;
  const m = s.match(/(\d[\d\s.]*(?:,\d+)?)/);
  if (!m) return null;
  let r = m[1].trim().replace(/\s/g, "");
  if (r.includes(",")) r = r.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(r)) r = r.replace(/\./g, "");
  const v = parseFloat(r);
  return Number.isNaN(v) ? null : v;
}

const iso = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null; // dia inexistente
  return dt.toISOString().slice(0, 10);
};

export function parseDates(raw: string, year: number): { start: string; end: string } | null {
  const s = strip(raw.toLowerCase()).replace(/(?:19|20)[0-9]{2}/g, " ");
  const toks: { d: number; m: number | null }[] = [];
  for (const mt of s.matchAll(/([0-9]{1,2})(?:\s*de)?\s*(?:([a-z]{3,9}))?/g)) {
    const d = parseInt(mt[1], 10);
    if (d < 1 || d > 31) continue;
    toks.push({ d, m: mt[2] ? (MONTHS[mt[2].slice(0, 3)] ?? null) : null });
  }
  if (!toks.length) return null;
  const endMonth = [...toks].reverse().find((t) => t.m)?.m;
  if (!endMonth) return null;
  const end = iso(year, endMonth, toks[toks.length - 1].d);
  let startMonth = toks[0].m ?? endMonth;
  let start = iso(year, startMonth, toks[0].d);
  if (!end || !start) return null;
  if (start > end) {
    startMonth = Math.max(startMonth - 1, 1);
    start = iso(year, startMonth, toks[0].d);
    if (!start) return null;
  }
  return { start, end };
}

/** Expande rowspan/colspan de uma tabela HTML numa matriz de textos. */
function expandGrid($: cheerio.CheerioAPI, el: Parameters<cheerio.CheerioAPI>[0]): string[][] {
  const clean = (t: string) => t.replace(/\s+/g, " ").trim();
  const grid: string[][] = [];
  const pend: Record<number, { left: number; v: string }> = {};
  $(el)
    .find("tr")
    .each((_, tr) => {
      const row: string[] = [];
      let ci = 0;
      const fill = () => {
        while (pend[ci] && pend[ci].left > 0) {
          row.push(pend[ci].v);
          pend[ci].left -= 1;
          ci += 1;
        }
      };
      $(tr)
        .children("td, th")
        .each((__, c) => {
          fill();
          const rs = parseInt($(c).attr("rowspan") || "1", 10) || 1;
          const cs = parseInt($(c).attr("colspan") || "1", 10) || 1;
          const v = clean($(c).text());
          for (let k = 0; k < cs; k++) {
            row.push(v);
            if (rs > 1) pend[ci] = { left: rs - 1, v };
            ci += 1;
          }
        });
      fill();
      grid.push(row);
    });
  return grid;
}

/** Lula x Flávio no 2º turno: só a tabela da seção "2026" é baixada. */
function parseRound2(html: string): Poll[] {
  const $ = cheerio.load(html);
  $("sup, style, .mw-editsection").remove();
  $("br").replaceWith(" ");
  const polls: Poll[] = [];
  const seen = new Set<string>();
  $("table.wikitable").each((_, el) => {
    const grid = expandGrid($, el);
    const hdr = grid.find((r) => r.some((c) => strip(c.toLowerCase()).startsWith("lula")));
    if (!hdr || grid.length < 20) return;
    const iL = hdr.findIndex((c) => strip(c.toLowerCase()).startsWith("lula"));
    const iF = hdr.findIndex((c) => strip(c.toLowerCase()).startsWith("flavio"));
    const iI = hdr.findIndex((c) => strip(c.toLowerCase()).startsWith("indecis"));
    if (iL < 0 || iF < 0) return;
    for (const r of grid) {
      if (r.length !== hdr.length || r[0].startsWith("Contratante") || new Set(r.slice(0, 4)).size === 1) continue;
      const lula = num(r[iL]);
      const flavio = num(r[iF]);
      const d = parseDates(r[1], 2026);
      if (lula === null || flavio === null || !d) continue;
      const institute = instName(r[0]);
      const n = num(r[2]);
      const key = `${institute}|${d.end}|${n ?? 0}`;
      if (seen.has(key)) continue;
      seen.add(key);
      polls.push({
        institute, start: d.start, end: d.end, n: n ? Math.round(n) : null, moe: num(r[3]), lula, flavio,
        cury: null, caiado: null, renan: null, zema: null, demais: null, outros: null,
        indecisos: iI >= 0 ? num(r[iI]) : null, origin: "wikipedia",
      });
    }
  });
  return polls;
}

const MONTH_HEADINGS = new Set([
  "outubro", "setembro", "agosto", "julho", "junho", "maio", "abril", "marco", "janeiro - fevereiro",
]);

export interface Pending {
  institute: string;
  end: string;
}

function parseWikipedia(html: string, sectionOnly: boolean): { polls: Poll[]; pending: Pending[] } {
  const $ = cheerio.load(html);
  $("sup, style, .mw-editsection").remove();
  $("br").replaceWith(" ");
  const polls: Poll[] = [];
  const pending: Pending[] = [];
  const seen = new Set<string>();
  // quando só a seção "2026" do 1º turno é baixada, o contexto de h2/h3 já é conhecido
  const cur = sectionOnly ? { h2: "primeiro turno", h3: "2026", h4: "" } : { h2: "", h3: "", h4: "" };
  const clean = (t: string) => t.replace(/\s+/g, " ").trim();

  $("h2, h3, h4, table.wikitable").each((_, el) => {
    const tag = el.tagName.toLowerCase();
    if (tag === "h2" || tag === "h3" || tag === "h4") {
      const t = strip(clean($(el).text()).toLowerCase());
      if (tag === "h2" && !sectionOnly) Object.assign(cur, { h2: t, h3: "", h4: "" });
      if (tag === "h3" && !sectionOnly) Object.assign(cur, { h3: t, h4: "" });
      if (tag === "h4") cur.h4 = t;
      return;
    }
    if (cur.h2 !== "primeiro turno" || cur.h3 !== "2026" || !MONTH_HEADINGS.has(cur.h4)) return;

    const grid = expandGrid($, el);

    const hdr = grid.find((r) => r.some((c) => strip(c.toLowerCase()).startsWith("lula")));
    if (!hdr) return;
    const col: Record<string, number> = {};
    const demaisCols: number[] = [];
    hdr.forEach((c, i) => {
      const k = strip(c.toLowerCase());
      if (k.startsWith("lula")) col.lula = i;
      else if (k.startsWith("flavio")) col.flavio = i;
      else if (k.startsWith("cury")) col.cury = i;
      else if (k.startsWith("caiado")) col.caiado = i;
      else if (k.startsWith("renan")) col.renan = i;
      else if (k.startsWith("zema")) col.zema = i;
      else if (k.startsWith("outros")) col.outros = i;
      else if (k.startsWith("indecis")) col.indecisos = i;
      else if (/^(samara|grassi|clariana|dias|costa|pimenta|avalanche)/.test(k)) demaisCols.push(i);
    });

    for (const r of grid) {
      if (r.length !== hdr.length || r[0].startsWith("Contratante") || new Set(r.slice(0, 4)).size === 1) continue;
      const lula = num(r[col.lula]);
      const flavio = num(r[col.flavio]);
      if (lula === null || flavio === null) {
        // linha já anunciada na Wikipédia, mas sem resultado publicado ainda
        if (strip(r[col.lula].toLowerCase()).includes("ainda nao divulgado")) {
          const dp = parseDates(r[1], 2026);
          if (dp) pending.push({ institute: instName(r[0]), end: dp.end });
        }
        continue;
      }
      const d = parseDates(r[1], 2026);
      if (!d) continue;
      const get = (k: string) => (k in col ? num(r[col[k]]) : null);
      const institute = instName(r[0]);
      const n = num(r[2]);
      const key = `${institute}|${d.end}|${n ?? 0}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const demais = demaisCols.reduce((a, i) => a + (num(r[i]) ?? 0), 0);
      polls.push({
        institute, start: d.start, end: d.end, n: n ? Math.round(n) : null, moe: num(r[3]),
        lula, flavio, cury: get("cury"), caiado: get("caiado"), renan: get("renan"), zema: get("zema"),
        demais: Math.round(demais * 100) / 100, outros: get("outros"), indecisos: get("indecisos"),
        origin: "wikipedia",
      });
    }
  });
  return { polls, pending };
}

export interface PollsResult {
  polls: Poll[];
  source: "wikipedia" | "snapshot";
  fetchedAt: string;
  manualCount: number;
  /** pesquisas anunciadas dos últimos dias cujo resultado ainda não saiu */
  pending: Pending[];
  /** muda quando alguma pesquisa muda: serve de chave para guardar contas já feitas */
  version: string;
}

interface WikiFetch {
  polls: Poll[];
  pending: Pending[];
  polls2: Poll[] | null;
  at: number;
  key: string;
}

let parsed: WikiFetch | null = null; // última leitura boa, já interpretada
let checkedAt = 0;
let inflight: Promise<WikiFetch> | null = null;

type Section = { index: string; line: string; toclevel: number };

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 7) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return `${s.length}:${h >>> 0}`;
}

/**
 * GET com o cache de dados do Next (compartilhado entre as instâncias da Vercel): devolve na hora a última cópia e
 * atualiza em segundo plano a cada POLLS_REVALIDATE_SECONDS. Assim nenhuma visita espera a Wikipédia (que leva ~4 s).
 */
async function cachedGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: WIKI_HEADERS, next: { revalidate: POLLS_REVALIDATE_SECONDS } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** Baixa só as seções necessárias (a página inteira tem ~2,7 MB). */
async function fetchWikipedia(): Promise<WikiFetch> {
  const q = (o: Record<string, string>) =>
    `${WIKI_API}?${new URLSearchParams({ action: "parse", page: WIKI_PAGE, format: "json", formatversion: "2", ...o })}`;
  const sections = (await cachedGet<{ parse: { sections: Section[] } }>(q({ prop: "sections" }))).parse.sections;
  const text = async (index: string) =>
    (await cachedGet<{ parse?: { text?: string } }>(q({ prop: "text", section: index }))).parse?.text ?? "";

  const first = sections.findIndex((s) => strip(s.line.toLowerCase()) === "primeiro turno" && s.toclevel === 1);
  const sec1 = sections.slice(first + 1).find((s) => s.line === "2026" && s.toclevel === 2);
  if (first < 0 || !sec1) throw new Error("seção 2026 do 1º turno não encontrada");

  // 2º turno (Lula x Flávio): se não achar, segue só com o 1º turno
  const second = sections.findIndex((s) => strip(s.line.toLowerCase()) === "segundo turno" && s.toclevel === 1);
  const lf = second >= 0 ? sections.findIndex((s, i) => i > second && s.toclevel === 2 && s.line.startsWith("Lula e Fl")) : -1;
  const sec2 = lf >= 0 ? sections.slice(lf + 1).find((s) => s.line === "2026" && s.toclevel === 3) : undefined;

  const [html1, html2] = await Promise.all([text(sec1.index), sec2 ? text(sec2.index).catch(() => "") : Promise.resolve("")]);
  const key = `${hash(html1)}|${hash(html2)}`;
  if (parsed && parsed.key === key) return parsed; // a Wikipédia não mudou: não precisa interpretar de novo

  const { polls, pending } = parseWikipedia(html1, true);
  if (polls.length < 40) throw new Error(`só ${polls.length} pesquisas lidas`);
  const polls2 = html2 ? parseRound2(html2) : [];
  return { polls, pending, polls2: polls2.length >= 20 ? polls2 : null, at: Date.now(), key };
}

const COLD_WAIT_MS = 8_000;

async function loadWiki(): Promise<{ data: WikiFetch | null }> {
  if (parsed && Date.now() - checkedAt < 15_000) return { data: parsed };
  inflight ??= fetchWikipedia()
    .then((v) => {
      parsed = v;
      checkedAt = Date.now();
      return v;
    })
    .finally(() => (inflight = null));
  inflight.catch(() => undefined); // evita aviso de erro não tratado se ela falhar depois do tempo de espera
  try {
    // com algo em memória, espera pouco; sem nada (primeira carga a frio), espera até COLD_WAIT_MS e depois usa a cópia salva
    // (a leitura continua em segundo plano e a próxima visita já pega o dado novo)
    const waitMs = parsed ? 1_500 : COLD_WAIT_MS;
    await Promise.race([inflight, new Promise((resolve) => setTimeout(resolve, waitMs))]);
  } catch (e) {
    console.warn("[polls] Wikipédia falhou:", e instanceof Error ? e.message : e);
  }
  return { data: parsed }; // última leitura boa (se houver)
}

function mergeManual(base: Poll[], manualList: Poll[]) {
  const manualPolls = manualList.map((p) => ({ ...p, origin: "manual" as const }));
  // a lançada à mão substitui a da Wikipédia do mesmo instituto e dia, mesmo que a amostra divirja
  const replaced = new Set(manualPolls.map((p) => `${p.institute}|${p.end}`));
  const merged = [...base.filter((p) => !replaced.has(`${p.institute}|${p.end}`)), ...manualPolls].sort((a, b) =>
    a.end < b.end ? 1 : a.end > b.end ? -1 : a.institute.localeCompare(b.institute),
  );
  return { merged, manualCount: manualPolls.length };
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);
export function addDays(iso: string, n: number) {
  return ymd(new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000));
}

/** Dia em que a pesquisa foi divulgada: o informado à mão ou, na Wikipédia, o dia seguinte ao fim do campo (nunca depois de hoje). */
export function publishedOf(p: Poll, today = todayBR()) {
  const d = p.published ?? addDays(p.end, 1);
  return d > today ? today : d;
}

export async function getPolls(): Promise<PollsResult> {
  const { data } = await loadWiki();
  const source: PollsResult["source"] = data ? "wikipedia" : "snapshot";
  const polls = data ? data.polls : (snapshot.polls as Poll[]).map((p) => ({ ...p, origin: "snapshot" as const }));
  const { merged, manualCount } = mergeManual(polls, manual as Poll[]);
  const have = new Set(merged.map((p) => `${p.institute}|${p.end}`));
  // só as anunciadas dos últimos 2 dias: as mais antigas já saíram e a Wikipédia só não preencheu
  const cutoff = addDays(todayBR(), -2);
  // some se o instituto já tem pesquisa até 1 dia antes da anunciada (costuma ser a mesma, só repetida na tabela)
  const covered = (x: Pending) => merged.some((p) => p.institute === x.institute && p.end >= addDays(x.end, -1));
  const pending = (data?.pending ?? []).filter((x) => !have.has(`${x.institute}|${x.end}`) && !covered(x) && x.end >= cutoff);
  const version = hash(merged.map((p) => `${p.institute}${p.end}${p.n}${p.lula}${p.flavio}${p.cury}${p.caiado}${p.renan}${p.zema}`).join());
  return { polls: merged, source, fetchedAt: new Date(data?.at ?? Date.now()).toISOString(), manualCount, pending, version };
}

export interface Polls2Result {
  polls: Poll[];
  source: "wikipedia" | "snapshot";
  fetchedAt: string;
  manualCount: number;
  version: string;
}

function fillRound2(p: Partial<Poll>): Poll {
  return {
    institute: p.institute ?? "", start: p.start ?? p.end ?? "", end: p.end ?? "", n: p.n ?? null, moe: p.moe ?? null,
    lula: p.lula ?? null, flavio: p.flavio ?? null, cury: null, caiado: null, renan: null, zema: null,
    demais: null, outros: null, indecisos: p.indecisos ?? null, published: p.published,
  };
}

/** Pesquisas de 2º turno, Lula x Flávio (campos dos outros candidatos ficam nulos). */
export async function getPolls2(): Promise<Polls2Result> {
  const { data } = await loadWiki();
  const live = data?.polls2 ?? null;
  const base = live ?? (snapshot2.polls as Partial<Poll>[]).map((p) => ({ ...fillRound2(p), origin: "snapshot" as const }));
  const { merged, manualCount } = mergeManual(base, (manual2 as Partial<Poll>[]).map(fillRound2));
  const version = hash(merged.map((p) => `${p.institute}${p.end}${p.n}${p.lula}${p.flavio}`).join());
  return { polls: merged, source: live ? "wikipedia" : "snapshot", fetchedAt: new Date(data?.at ?? Date.now()).toISOString(), manualCount, version };
}
