import { BY_KEY } from "@/lib/candidates";
import { chance, dec, pct, signed } from "@/lib/format";
import type { CandKey, Forecast, Shares } from "@/lib/types";
import { CandidateDot, orderedKeys } from "./SharesCard";

const SCALE_MAX = 60;

function Prob({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl border border-line bg-[#0f1630] p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="num mt-1 text-xl font-semibold" style={color ? { color } : undefined}>{chance(value)}</div>
    </div>
  );
}

export function ForecastCard({ badge, title, subtitle, fc, base, corrPct }: { badge: string; title: string; subtitle: string; fc: Forecast; base: Shares; corrPct: number }) {
  const keys = orderedKeys(fc.mean);
  const leader: CandKey = fc.pLead.lula >= fc.pLead.flavio ? "lula" : "flavio";
  return (
    <section className="card flex flex-col p-5">
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-[#243059] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-accent">{badge}</span>
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>

      <div className="mt-5">
        <div className="flex items-baseline justify-between text-xs text-muted">
          <span>Chance de terminar na frente</span>
          <span>{BY_KEY[leader].short} favorito</span>
        </div>
        <div className="mt-1.5 flex h-7 overflow-hidden rounded-lg text-xs font-semibold text-[#0b1020]" role="img" aria-label={`Lula ${dec(fc.pLead.lula, 0)}%, Flávio ${dec(fc.pLead.flavio, 0)}%`}>
          <div className="flex items-center pl-2" style={{ width: `${fc.pLead.lula}%`, background: BY_KEY.lula.color }}>Lula {dec(fc.pLead.lula, 0)}%</div>
          <div className="flex items-center justify-end pr-2" style={{ width: `${fc.pLead.flavio}%`, background: BY_KEY.flavio.color }}>{dec(fc.pLead.flavio, 0)}% Flávio</div>
          {fc.pLead.outro > 0.5 && <div style={{ width: `${fc.pLead.outro}%`, background: "#8b95a8" }} />}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Prob label="Haver 2º turno" value={fc.pSecondRound} />
        <Prob label="Lula vence no 1º" value={fc.pWinFirstRound.lula} color={BY_KEY.lula.color} />
        <Prob label="Flávio vence no 1º" value={fc.pWinFirstRound.flavio} color={BY_KEY.flavio.color} />
      </div>

      <div className="mt-4 rounded-xl border border-line bg-[#0f1630] p-3 text-sm">
        <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-faint">De onde vem</div>
        <table className="w-full">
          <thead>
            <tr className="text-xs text-faint">
              <th className="py-1 text-left font-medium" />
              <th className="py-1 text-right font-medium">Média das pesquisas</th>
              <th className="py-1 text-right font-medium">Ajuste ({corrPct}% do viés)</th>
              <th className="py-1 text-right font-medium">Previsão</th>
            </tr>
          </thead>
          <tbody>
            {(["lula", "flavio"] as CandKey[]).map((k) => (
              <tr key={k}>
                <td className="py-1" style={{ color: BY_KEY[k].color }}>{BY_KEY[k].short}</td>
                <td className="num py-1 text-right">{pct(base[k])}</td>
                <td className="num py-1 text-right text-muted">{signed(fc.mean[k] - base[k])}</td>
                <td className="num py-1 text-right font-semibold">{pct(fc.mean[k])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="mb-2 mt-6 text-xs font-medium uppercase tracking-wide text-faint">Votos válidos projetados · faixa de 90%</h3>
      <ul className="space-y-3.5">
        {keys.map((k, i) => {
          const c = BY_KEY[k];
          const big = i < 2;
          return (
            <li key={k}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-2 text-sm">
                  <CandidateDot k={k} size={big ? 34 : 26} />
                  <span className={big ? "font-medium" : "text-muted"}>{c.short}</span>
                </span>
                <span className="flex items-baseline gap-3">
                  {k !== "demais" && <span className="text-xs text-faint">2º turno {chance(fc.pRunoff[k])}</span>}
                  <span className={`num ${big ? "text-2xl font-semibold" : "text-base text-muted"}`}>{pct(fc.mean[k])}</span>
                </span>
              </div>
              <div className="relative mt-1.5 h-2 rounded-full bg-[#1c2650]" role="presentation">
                <div
                  className="absolute top-0 h-full rounded-full opacity-40"
                  style={{ left: `${(fc.lo[k] / SCALE_MAX) * 100}%`, width: `${Math.max(0.8, ((fc.hi[k] - fc.lo[k]) / SCALE_MAX) * 100)}%`, background: c.color }}
                />
                <div className="absolute top-[-2px] h-3 w-[3px] rounded-sm" style={{ left: `calc(${(fc.mean[k] / SCALE_MAX) * 100}% - 1px)`, background: c.color }} />
              </div>
              <div className="mt-0.5 text-[11px] text-faint">entre {dec(fc.lo[k])}% e {dec(fc.hi[k])}%</div>
            </li>
          );
        })}
      </ul>
      <p className="mt-5 border-t border-line pt-3 text-xs text-muted">
        {corrPct === 0 ? "Sem correção do viés histórico." : `Com ${corrPct}% do viés histórico das pesquisas somado.`} Simulação com 20 mil cenários.
      </p>
    </section>
  );
}
