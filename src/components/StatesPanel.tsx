"use client";

import { useState } from "react";
import { BY_KEY } from "@/lib/candidates";
import { BRAZIL_PATHS, BRAZIL_VIEWBOX } from "@/lib/brazilPaths";
import { dec, pct } from "@/lib/format";
import type { LiveCount } from "@/lib/types";
import { REGIONS, UF_NAME, UFS } from "@/lib/ufs";
import { CandidateAvatar } from "./CandidateAvatar";

export type UfCounts = Record<string, LiveCount | null>;
/** Projeção final de Lula (% dos válidos de Lula + Flávio) por UF, quando houver. */
export type UfProjection = Record<string, { lula: number }>;

const SIGLA = Object.fromEntries(UFS.map((u) => [u.code, u.sigla]));
// estados pequenos: sigla menor para caber
const SMALL = new Set(["df", "se", "al", "rn", "pb", "pe", "es", "rj"]);

interface Tally {
  st: number;
  ts: number;
  lula: number;
  flavio: number;
}

function tally(cs: (LiveCount | null | undefined)[]): Tally {
  const t = { st: 0, ts: 0, lula: 0, flavio: 0 };
  for (const c of cs) {
    if (!c) continue;
    t.st += c.sections?.counted ?? 0;
    t.ts += c.sections?.total ?? 0;
    t.lula += c.candidates.find((x) => x.key === "lula")?.votes ?? 0;
    t.flavio += c.candidates.find((x) => x.key === "flavio")?.votes ?? 0;
  }
  return t;
}

const apurado = (t: Tally, c?: LiveCount | null) => (t.ts > 0 ? (t.st / t.ts) * 100 : (c?.pctSections ?? 0));
/** Lula em % dos votos de Lula + Flávio (no 1º turno, só entre os dois). */
const lulaShare = (t: Tally) => (t.lula + t.flavio > 0 ? (t.lula / (t.lula + t.flavio)) * 100 : null);

function fillFor(l: number | null) {
  if (l === null) return "#1a2347";
  const margin = Math.abs(l - 50) * 2;
  const color = l >= 50 ? BY_KEY.lula.color : BY_KEY.flavio.color;
  return `color-mix(in srgb, ${color} ${Math.round((0.4 + Math.min(margin / 25, 1) * 0.6) * 100)}%, #0f1630)`;
}

/** Barra dividida Lula | Flávio, com a marca dos 50%. */
function Split({ lula, thin }: { lula: number | null; thin?: boolean }) {
  return (
    <div className={`relative flex overflow-hidden rounded-full bg-[#1c2650] ${thin ? "h-1.5" : "h-2.5"}`} role="presentation">
      {lula !== null && (
        <>
          <div style={{ width: `${lula}%`, background: BY_KEY.lula.color }} />
          <div style={{ width: `${100 - lula}%`, background: BY_KEY.flavio.color }} />
        </>
      )}
      <div className="absolute inset-y-0 left-1/2 w-px bg-[#0b1020]" />
    </div>
  );
}

function Lead({ lula, label }: { lula: number | null; label?: string }) {
  if (lula === null) return <span className="text-xs text-faint">sem votos</span>;
  const k = lula >= 50 ? "lula" : "flavio";
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted">
      <CandidateAvatar k={k} size={16} />
      {label}
      <span className="num font-medium text-fg">+{dec(Math.abs(lula - (100 - lula)))}</span>
    </span>
  );
}

function StateDetail({ code, counts, proj }: { code: string; counts: UfCounts; proj?: UfProjection }) {
  const c = counts[code];
  const t = tally([c]);
  const l = lulaShare(t);
  const p = proj?.[code]?.lula;
  return (
    <div className="rounded-xl border border-line bg-[#0f1630] p-3" aria-live="polite">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">{UF_NAME[code]}</span>
        <span className="num text-sm text-muted">{pct(apurado(t, c), 0)} apurado</span>
      </div>
      <div className="mt-2 flex items-baseline justify-between text-sm">
        <span style={{ color: BY_KEY.lula.color }}>Lula <strong className="num text-lg text-fg">{l === null ? "—" : pct(l)}</strong></span>
        <span style={{ color: BY_KEY.flavio.color }}><strong className="num text-lg text-fg">{l === null ? "—" : pct(100 - l)}</strong> Flávio</span>
      </div>
      <div className="mt-1.5"><Split lula={l} /></div>
      {p !== undefined && l !== null && (
        <p className="mt-2 text-xs text-muted">
          Projeção ao fim: <span className="num text-fg">Lula {pct(p)} × Flávio {pct(100 - p)}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Mapa + regiões. No celular: toca no estado e os números aparecem logo abaixo do mapa; as regiões ficam
 * recolhidas e abrem a lista de estados. No computador, passar o mouse também mostra o estado.
 */
export function StatesPanel({ counts, proj, note }: { counts: UfCounts; proj?: UfProjection; note?: string }) {
  const [sel, setSel] = useState<string | null>(null);
  const shares = Object.fromEntries(Object.keys(UF_NAME).map((code) => [code, lulaShare(tally([counts[code]]))]));

  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <div>
        <svg
          viewBox={`0 0 ${BRAZIL_VIEWBOX.w} ${BRAZIL_VIEWBOX.h}`}
          className="mx-auto h-auto w-full touch-manipulation"
          style={{ maxWidth: 460 }}
          role="group"
          aria-label="Mapa do Brasil: toque num estado para ver os números"
        >
          {BRAZIL_PATHS.map((p) => (
            <path
              key={p.code}
              d={p.d}
              style={{ fill: fillFor(shares[p.code]) }}
              stroke={sel === p.code ? "#ffffff" : "#0b1020"}
              strokeWidth={sel === p.code ? 2 : 0.8}
              strokeLinejoin="round"
              className="cursor-pointer outline-none"
              tabIndex={0}
              role="button"
              aria-label={UF_NAME[p.code]}
              aria-pressed={sel === p.code}
              onClick={() => setSel(p.code)}
              onMouseEnter={() => setSel(p.code)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSel(p.code)}
            />
          ))}
          {/* o estado escolhido por cima, para a borda branca aparecer inteira */}
          {sel && BRAZIL_PATHS.filter((p) => p.code === sel).map((p) => (
            <path key="sel" d={p.d} fill="none" stroke="#fff" strokeWidth={2} pointerEvents="none" />
          ))}
          {BRAZIL_PATHS.map((p) => (
            <text
              key={`t${p.code}`}
              x={p.cx}
              y={p.cy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={SMALL.has(p.code) ? 6 : 8.5}
              fontWeight={700}
              fill="#fff"
              stroke="#0b1020"
              strokeWidth={1.6}
              paintOrder="stroke"
              pointerEvents="none"
            >
              {SIGLA[p.code]}
            </text>
          ))}
        </svg>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: BY_KEY.lula.color }} />Lula na frente</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: BY_KEY.flavio.color }} />Flávio na frente</span>
          <span>cor mais forte = vantagem maior</span>
        </div>
        <div className="mt-3">
          {sel ? (
            <StateDetail code={sel} counts={counts} proj={proj} />
          ) : (
            <p className="rounded-xl border border-dashed border-line p-3 text-center text-sm text-muted">Toque num estado para ver quanto já foi apurado e quem lidera.</p>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">Por região</h3>
        {note && <p className="mb-2 text-xs text-faint">{note}</p>}
        <ul className="space-y-2">
          {REGIONS.map((r) => {
            const t = tally(r.ufs.map((u) => counts[u]));
            const l = lulaShare(t);
            const a = apurado(t, counts[r.ufs[0]]);
            return (
              <li key={r.key}>
                <details className="group rounded-xl border border-line bg-[#0f1630]">
                  <summary className="flex min-h-12 items-center gap-3 px-3 py-2.5">
                    <span className="w-28 shrink-0 font-medium">{r.name}</span>
                    <span className="flex-1">
                      <span className="flex items-center justify-between text-xs text-muted">
                        <span className="num">{pct(a, 0)} apurado</span>
                        <Lead lula={l} />
                      </span>
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[#1c2650]">
                        <span className="block h-full rounded-full bg-[#cbd5e1]" style={{ width: `${a}%` }} />
                      </span>
                    </span>
                    <span className={`text-faint transition-transform group-open:rotate-90 ${r.ufs.length > 1 ? "" : "invisible"}`} aria-hidden>›</span>
                  </summary>
                  {r.ufs.length > 1 && (
                    <ul className="divide-y divide-line/60 border-t border-line px-3">
                      {r.ufs.map((u) => {
                        const tu = tally([counts[u]]);
                        const lu = lulaShare(tu);
                        const p = proj?.[u]?.lula;
                        return (
                          <li key={u} className="py-2.5">
                            <div>
                              <span className="flex items-baseline justify-between gap-2 text-sm">
                                <span>{UF_NAME[u]}</span>
                                <span className="num text-xs text-muted">{pct(apurado(tu, counts[u]), 0)} apurado</span>
                              </span>
                              <span className="mt-1 flex items-center gap-2">
                                <span className="num w-12 text-xs" style={{ color: BY_KEY.lula.color }}>{lu === null ? "—" : pct(lu)}</span>
                                <span className="flex-1"><Split lula={lu} thin /></span>
                                <span className="num w-12 text-right text-xs" style={{ color: BY_KEY.flavio.color }}>{lu === null ? "—" : pct(100 - lu)}</span>
                              </span>
                              {p !== undefined && lu !== null && (
                                <span className="mt-0.5 block text-[11px] text-faint">projeção: Lula {pct(p)} × Flávio {pct(100 - p)}</span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </details>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
