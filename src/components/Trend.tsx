import { BY_KEY } from "@/lib/candidates";
import { dmy } from "@/lib/format";
import type { CandKey, Shares } from "@/lib/types";

interface Pt {
  date: string;
  shares: Shares;
}

const W = 600;
const H = 300;
const M = { l: 40, r: 14, t: 14, b: 28 };
const LINES: CandKey[] = ["lula", "flavio"];

export interface Dot {
  end: string;
  v: Shares;
}

export function Trend({ general, certeiros, dots: allDots, from, to }: { general: Pt[]; certeiros: Pt[]; dots: Dot[]; from: string; to: string }) {
  const t0 = Date.parse(from);
  const t1 = Date.parse(to);
  const dots = allDots.filter((d) => d.end >= from && d.end <= to);

  const vals: number[] = [];
  for (const s of [...general, ...certeiros]) for (const k of LINES) vals.push(s.shares[k]);
  for (const d of dots) for (const k of LINES) vals.push(d.v[k]);
  const lo = Math.floor(Math.min(...vals) / 2) * 2 - 2;
  const hi = Math.ceil(Math.max(...vals) / 2) * 2 + 2;
  const x = (d: string) => M.l + ((Date.parse(d) - t0) / (t1 - t0 || 1)) * (W - M.l - M.r);
  const y = (v: number) => M.t + (1 - (v - lo) / (hi - lo)) * (H - M.t - M.b);
  const path = (pts: Pt[], k: CandKey) => pts.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.shares[k]).toFixed(1)}`).join(" ");

  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += 4) ticks.push(v);
  const xt = [0, 0.25, 0.5, 0.75, 1].map((f) => new Date(t0 + f * (t1 - t0)).toISOString().slice(0, 10));

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Evolução da média de Lula e Flávio nos últimos 90 dias">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="#243059" strokeWidth={1} />
            <text x={M.l - 8} y={y(v) + 4} textAnchor="end" fontSize={13} fill="#6b7799">{v}%</text>
          </g>
        ))}
        {xt.map((d, i) => (
          <text key={d} x={x(d)} y={H - 8} textAnchor={i === 0 ? "start" : i === xt.length - 1 ? "end" : "middle"} fontSize={13} fill="#6b7799">{dmy(d)}</text>
        ))}
        {dots.map(({ end, v }, i) =>
          LINES.map((k) => (
            <circle key={`${i}${k}`} cx={x(end)} cy={y(v[k])} r={2.4} fill={BY_KEY[k].color} opacity={0.28} />
          )),
        )}
        {LINES.map((k) => (
          <g key={k}>
            <path d={path(certeiros, k)} fill="none" stroke={BY_KEY[k].color} strokeWidth={2} strokeDasharray="5 4" opacity={0.9} />
            <path d={path(general, k)} fill="none" stroke={BY_KEY[k].color} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
          </g>
        ))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <span>Linha cheia: média de todas as pesquisas</span>
        <span>Tracejada: institutos mais certeiros</span>
        <span>Pontos: cada pesquisa (votos válidos)</span>
        {LINES.map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: BY_KEY[k].color }} />
            {BY_KEY[k].short}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
