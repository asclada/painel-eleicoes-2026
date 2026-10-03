import { BY_KEY } from "@/lib/candidates";
import { BRAZIL_PATHS, BRAZIL_VIEWBOX } from "@/lib/brazilPaths";
import type { LiveCount } from "@/lib/types";
import { EXTERIOR, UFS } from "@/lib/ufs";

export type UfCounts = Record<string, LiveCount | null>;

export function ufLeader(c: LiveCount | null | undefined) {
  if (!c?.started || c.candidates.length < 2) return null;
  const [a, b] = c.candidates;
  return { key: a.key, name: a.name, margin: a.pct - b.pct, pct: a.pct };
}

const SIGLA = Object.fromEntries(UFS.map((u) => [u.code, u]));
// estados pequenos: sigla menor para caber
const SMALL = new Set(["df", "se", "al", "rn", "pb", "pe", "es", "rj"]);

/** Mapa do Brasil: cada estado é pintado com a cor de quem lidera; quanto mais forte a cor, maior a vantagem. */
export function BrazilMap({ counts }: { counts: UfCounts | null }) {
  const ext = ufLeader(counts?.[EXTERIOR.code]);
  return (
    <div>
      <svg
        viewBox={`0 0 ${BRAZIL_VIEWBOX.w} ${BRAZIL_VIEWBOX.h}`}
        className="mx-auto h-auto w-full"
        style={{ maxWidth: 520 }}
        role="img"
        aria-label="Mapa do Brasil com o candidato na frente em cada estado"
      >
        {BRAZIL_PATHS.map((p) => {
          const u = SIGLA[p.code];
          const l = ufLeader(counts?.[p.code]);
          const alpha = l ? 0.4 + Math.min(l.margin / 25, 1) * 0.6 : 0;
          const fill = l ? `color-mix(in srgb, ${BY_KEY[l.key].color} ${Math.round(alpha * 100)}%, #0f1630)` : "#1a2347";
          const title = l
            ? `${u.name}: ${BY_KEY[l.key].short} na frente por ${l.margin.toFixed(1).replace(".", ",")} p.p.`
            : `${u.name}: sem votos apurados`;
          return (
            <g key={p.code}>
              <path d={p.d} style={{ fill }} stroke="#0b1020" strokeWidth={0.8} strokeLinejoin="round">
                <title>{title}</title>
              </path>
              <text
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
                {u.sigla}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: BY_KEY.lula.color }} />Lula na frente</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: BY_KEY.flavio.color }} />Flávio na frente</span>
        <span>Cor mais forte = vantagem maior</span>
        {ext && <span>Exterior: {BY_KEY[ext.key].short} +{Math.round(ext.margin)}</span>}
      </div>
    </div>
  );
}
